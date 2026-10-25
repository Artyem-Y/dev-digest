import assert from 'node:assert/strict';
import test from 'node:test';
import { HERMETIC_RUNNER_ATTESTATION, isAttestedHermeticBriefRun, shouldRunFlow } from './hermetic.js';

const attested = {
  E2E_HERMETIC: '1',
  NODE_ENV: 'test',
  DEVDIGEST_E2E_BRIEF_FIXTURE: '1',
  E2E_HERMETIC_RUNNER: HERMETIC_RUNNER_ATTESTATION,
  E2E_HERMETIC_WEB_PORT: '3100',
};

test('Brief flow needs the complete script attestation, not E2E_HERMETIC alone', () => {
  assert.equal(isAttestedHermeticBriefRun({ E2E_HERMETIC: '1' }, 'http://localhost:3000'), false);
  assert.equal(isAttestedHermeticBriefRun({ ...attested, E2E_HERMETIC_RUNNER: undefined }, 'http://localhost:3100'), false);
  assert.equal(isAttestedHermeticBriefRun({ ...attested, E2E_HERMETIC_WEB_PORT: '3000' }, 'http://localhost:3000'), false);
  assert.equal(isAttestedHermeticBriefRun(attested, 'http://localhost:3100'), true);
  assert.equal(shouldRunFlow('11-pr-brief.flow.json', { E2E_HERMETIC: '1' }, 'http://localhost:3000'), false);
  assert.equal(shouldRunFlow('10-smart-diff.flow.json', {}, 'http://localhost:3000'), true);
});
