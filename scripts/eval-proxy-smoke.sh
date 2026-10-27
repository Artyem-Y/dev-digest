#!/bin/sh
set -eu

# Linux integration smoke test. Uses a synthetic key and a local mock upstream.
test_dir=$(mktemp -d /tmp/eval-proxy-smoke.XXXXXX)
chmod 755 "$test_dir"
node -e '
  const http = require("node:http");
  http.createServer((req, res) => {
    if (req.headers.authorization !== "Bearer synthetic-eval-key") {
      res.writeHead(401).end();
      return;
    }
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      if (!JSON.parse(body).stream) {
        res.writeHead(200, {"content-type": "application/json"}).end("{\"ok\":true}");
        return;
      }
      const item = {id:"msg_test", type:"message", role:"assistant", status:"completed", content:[{type:"output_text", text:"Proxy smoke test complete", annotations:[]}]};
      const response = {id:"resp_test", object:"response", status:"completed", model:"gpt-6-luna", output:[item], usage:{input_tokens:1,output_tokens:1,total_tokens:2}};
      res.writeHead(200, {"content-type":"text/event-stream"});
      for (const event of [{type:"response.output_item.done", output_index:0, item}, {type:"response.completed", response}]) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    });
  }).listen(45678, "127.0.0.1");
' &
upstream_pid=$!
printf '%s' synthetic-eval-key | NODE_OPTIONS=--disable-sigusr1 codex-responses-api-proxy \
  --upstream-url http://127.0.0.1:45678/v1/responses \
  --server-info "$test_dir/info.json" >/dev/null 2>&1 &
proxy_launcher_pid=$!
trap 'kill "$upstream_pid" "$proxy_launcher_pid" 2>/dev/null || true' EXIT
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  [ -s "$test_dir/info.json" ] && break
  sleep 1
done
[ -s "$test_dir/info.json" ]
proxy_pid=$(node -p "require('$test_dir/info.json').pid")
proxy_port=$(node -p "require('$test_dir/info.json').port")
runuser -u node -- test ! -r "/proc/$proxy_pid/environ"
runuser -u node -- env -i PATH=/usr/bin:/bin curl -fsS \
  -H 'content-type: application/json' -d '{}' "http://127.0.0.1:$proxy_port/v1/responses" \
  | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{if(!JSON.parse(s).ok)process.exit(1)})'
echo 'Synthetic proxy and process-isolation smoke test passed'

if command -v codex >/dev/null 2>&1; then
  mkdir -p "$test_dir/home/.codex" "$test_dir/work"
  chown -R node:node "$test_dir/home" "$test_dir/work"
  printf 'model_provider = "eval-proxy"\n[model_providers.eval-proxy]\nname = "Eval Proxy"\nbase_url = "http://127.0.0.1:%s/v1"\nwire_api = "responses"\n' "$proxy_port" > "$test_dir/home/.codex/config.toml"
  runuser -u node -- env -i HOME="$test_dir/home" PATH=/usr/local/bin:/usr/bin:/bin \
    codex exec --json --ephemeral --skip-git-repo-check --sandbox workspace-write \
    --cd "$test_dir/work" --model gpt-6-luna 'Reply with a short confirmation.' > "$test_dir/codex.jsonl"
  node -e 'const fs=require("fs");const text=fs.readFileSync(process.argv[1],"utf8");if(!text.includes("Proxy smoke test complete"))process.exit(1)' "$test_dir/codex.jsonl"
  echo 'Codex through proxy smoke test passed'
fi
