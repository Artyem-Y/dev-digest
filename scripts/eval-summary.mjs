import { readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export function formatSummary(name, benchmark) {
  const arms = ['baseline', 'candidate'];
  const rate = (value) => value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
  const rows = arms.map((arm) => {
    const item = benchmark[arm];
    return `| ${arm} | ${item.valid_runs}/${item.attempted_runs} | ${rate(item.pass_rate)} |`;
  });
  const failures = arms.reduce((sum, arm) => sum + benchmark[arm].attempted_runs - benchmark[arm].valid_runs, 0);
  const baseline = benchmark.baseline.pass_rate;
  const candidate = benchmark.candidate.pass_rate;
  const delta = baseline == null || candidate == null ? 'n/a' : `${candidate >= baseline ? '+' : ''}${((candidate - baseline) * 100).toFixed(1)} pp`;
  return `### ${name}\n\n| Arm | Valid / attempted | Pass rate |\n| --- | --- | --- |\n${rows.join('\n')}\n\nDelta: ${delta}; infrastructure failures: ${failures}.\n`;
}

async function main() {
  const [name, input, output] = process.argv.slice(2);
  if (!name || !input || !output) throw new Error('Usage: eval-summary.mjs <name> <benchmark.json> <summary-file>');
  const benchmark = JSON.parse(await readFile(input, 'utf8'));
  await appendFile(output, `${formatSummary(name, benchmark)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
