/**
 * Mutating browser flows may run only under the isolated stack launched by
 * scripts/e2e.sh. These checks are intentionally stricter than one boolean so
 * accidentally exporting E2E_HERMETIC against a developer stack cannot enable
 * its POST request.
 */
export const HERMETIC_RUNNER_ATTESTATION = 'scripts-e2e-sh-v1';

export function isAttestedHermeticBriefRun(env: NodeJS.ProcessEnv, baseUrl: string): boolean {
  const port = env.E2E_HERMETIC_WEB_PORT;
  return env.E2E_HERMETIC === '1'
    && env.NODE_ENV === 'test'
    && env.DEVDIGEST_E2E_BRIEF_FIXTURE === '1'
    && env.E2E_HERMETIC_RUNNER === HERMETIC_RUNNER_ATTESTATION
    && typeof port === 'string'
    && /^\d+$/.test(port)
    && port !== '3000'
    && baseUrl.replace(/\/+$/, '') === `http://localhost:${port}`;
}

export function shouldRunFlow(file: string, env: NodeJS.ProcessEnv, baseUrl: string): boolean {
  if (file === '14-onboarding-tour.flow.json') return isAttestedHermeticBriefRun(env, baseUrl) && env.DEVDIGEST_E2E_ONBOARDING_FIXTURE === '1';
  return !['11-pr-brief.flow.json', '12-project-context.flow.json', '13-skill-context.flow.json'].includes(file) || isAttestedHermeticBriefRun(env, baseUrl);
}
