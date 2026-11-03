import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readIfPresent(file) {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

function check(id, passed, evidence) {
  return { id, passed, evidence };
}

export async function gradeWorkflow({ root, expected, initialImmutable = {} }) {
  const checks = [];
  const completionText = await readIfPresent(path.join(root, 'result/completion.json'));
  let completion = null;
  try {
    completion = completionText ? JSON.parse(completionText) : null;
  } catch {
    completion = null;
  }
  checks.push(check('completion-contract', Array.isArray(completion?.changed_paths) && Array.isArray(completion?.verification), completion || null));

  for (const requiredPath of expected.required_paths || []) {
    const content = await readIfPresent(path.join(root, requiredPath));
    checks.push(check(`path:${requiredPath}`, content !== null, content === null ? null : requiredPath));
    checks.push(check(
      `reported-change:${requiredPath}`,
      Array.isArray(completion?.changed_paths) && completion.changed_paths.includes(requiredPath),
      completion?.changed_paths || null,
    ));
  }

  for (const [relativePath, snippets] of Object.entries(expected.required_text || {})) {
    const content = await readIfPresent(path.join(root, relativePath));
    for (const snippet of snippets) {
      checks.push(check(`content:${relativePath}:${snippet}`, Boolean(content?.includes(snippet)), relativePath));
    }
  }

  for (const [relativePath, snippets] of Object.entries(expected.required_any_text || {})) {
    const content = await readIfPresent(path.join(root, relativePath));
    checks.push(check(
      `content-any:${relativePath}`,
      snippets.some((snippet) => content?.includes(snippet)),
      relativePath,
    ));
  }

  for (const immutablePath of expected.immutable_paths || []) {
    const content = await readIfPresent(path.join(root, immutablePath));
    checks.push(check(
      `immutable:${immutablePath}`,
      content !== null && content === initialImmutable[immutablePath],
      immutablePath,
    ));
  }

  const verificationRequirements = expected.verification || (expected.verification_commands || []).map((command_fragment) => ({ command_fragment }));
  for (const requirement of verificationRequirements) {
    const commandFragment = requirement.command_fragment;
    const receipt = (completion?.verification || []).find(
      (item) => typeof item?.command === 'string' && item.command.includes(commandFragment),
    );
    const blockedReceipt = (completion?.verification || []).find((item) => item?.status === 'blocked');
    const blockText = `${blockedReceipt?.command || ''} ${blockedReceipt?.scope || ''} ${(completion?.environment_blocks || []).join(' ')}`.toLowerCase();
    const allowedBlocked = Boolean(requirement.allow_blocked_when) && blockedReceipt && blockText.includes(requirement.allow_blocked_when.toLowerCase());
    checks.push(check(
      `verification:${requirement.id || commandFragment}`,
      receipt?.status === 'passed' || allowedBlocked,
      receipt || blockedReceipt || null,
    ));
  }

  const passed = checks.filter((item) => item.passed).length;
  return {
    pass: passed === checks.length,
    totals: { passed, required: checks.length },
    checks,
  };
}
