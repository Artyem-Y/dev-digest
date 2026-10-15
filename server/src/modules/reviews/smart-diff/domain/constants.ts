import type { SmartDiffRole } from '@devdigest/shared';

export const SMART_DIFF_ROLE_ORDER: readonly SmartDiffRole[] = [
  'core',
  'tests',
  'wiring',
  'docs',
  'boilerplate',
];

const BOILERPLATE = [
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)(package-lock\.json|yarn\.lock|[^/]+\.lock)$/i,
  /(^|\/)(dist|build)\//i,
  /(^|\/)__snapshots__\//i,
  /\.snap$/i,
  /\.generated\.[^/]+$/i,
  /\.min\.js$/i,
];

const TESTS = [
  /\.(?:test|spec)\.[cm]?[jt]sx?$/i,
  /\.it\.test\.[cm]?[jt]sx?$/i,
  /(^|\/)(test|tests|__tests__|e2e)\//i,
];

const WIRING = [
  /(^|\/)index\.[cm]?[jt]sx?$/i,
  /(^|\/)[^/]*\.config\.[^/]+$/i,
  /(^|\/)tsconfig[^/]*\.json$/i,
  /(^|\/)\.eslintrc[^/]*$/i,
  /(^|\/)\.env[^/]*$/i,
  /(^|\/)docker-compose[^/]*\.ya?ml$/i,
  /(^|\/)\.github\//i,
  /(^|\/)\.claude\//i,
];

const DOCS = [
  /(^|\/)[^/]+\.md$/i,
  /(^|\/)docs\//i,
  /(^|\/)(README[^/]*|CHANGELOG[^/]*|LICENSE[^/]*)$/i,
];

export const SMART_DIFF_RULES: readonly [SmartDiffRole, readonly RegExp[]][] = [
  ['boilerplate', BOILERPLATE],
  ['tests', TESTS],
  ['wiring', WIRING],
  ['docs', DOCS],
];
