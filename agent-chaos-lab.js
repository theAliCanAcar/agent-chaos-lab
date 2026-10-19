import { createController } from './retry-replan-controller.js';

export const CHAOS_SCENARIOS = Object.freeze(['timeout', 'truncation', 'corruption', 'omission', 'stale', 'repeated', 'partial', 'false-success']);
const contract = { id: 'chaos-output', task: 'Produce a verified answer', criteria: [{ id: 'answer', description: 'Answer is 42 and local effects are consistent' }] };

/** Deterministic local fault injection. No external APIs or real side effects.
 * Recovery is measured from actual parsed output, artifact revision and local state.
 * A timeout is a controlled rejected adapter request, not a real wall-clock delay.
 */
export async function runChaosScenario({ scenario = 'truncation', maxRetries = 2, recovery = true } = {}) {
  if (!CHAOS_SCENARIOS.includes(scenario)) throw new TypeError('Unknown chaos scenario');
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 20) throw new TypeError('maxRetries must be 0..20');
  if (typeof recovery !== 'boolean') throw new TypeError('recovery must be boolean');
  const controller = createController({ contract, maxRetries, maxSteps: 100, now: () => 0 });
  const events = [];
  let attempts = 0, injected = false, detected = false, revision = 1, effects = [], compensated = false, lastVerified = false;
  controller.transition('BUILD');
  while (controller.snapshot().state === 'BUILD') {
    attempts++;
    let payload, testedRevision, error;
    const inject = attempts === 1 || scenario === 'repeated';
    try {
      payload = { answer: 42, revision };
      testedRevision = revision;
      if (inject) {
        injected = true;
        events.push({ type: 'fault-injected', scenario, attempt: attempts });
        if (scenario === 'timeout') throw new Error('Adapter deadline exceeded');
        if (scenario === 'truncation') payload = JSON.parse('{"answer":');
        if (scenario === 'corruption') payload.answer = 'forty-two';
        if (scenario === 'omission') payload = undefined;
        if (scenario === 'stale') revision++;
        if (scenario === 'repeated') payload.answer = -1;
        if (scenario === 'partial') { effects.push('reserved'); throw new Error('Second local action failed'); }
        if (scenario === 'false-success') payload = { answer: 0, claimedDone: true, revision };
      }
      if (!payload || typeof payload.answer !== 'number' || payload.answer !== 42) throw new Error('Independent answer check failed');
      if (testedRevision !== revision) throw new Error('Verification refers to a stale revision');
      if (effects.length) throw new Error('Unreconciled local effects');
    } catch (cause) {
      error = cause.message;
      detected = true;
      events.push({ type: 'verification-rejected', attempt: attempts, reason: error });
    }
    lastVerified = !error && payload?.answer === 42 && testedRevision === revision && effects.length === 0;
    controller.transition('VERIFY');
    if (!error) {
      events.push({ type: 'verification-passed', attempt: attempts, revision, answer: payload.answer });
      controller.transition('FINISH', { verification: { verified: true, recorded: true, current: testedRevision === revision, criteria: [{ criterionId: 'answer', passed: payload.answer === 42, evidenceId: `attempt-${attempts}-revision-${revision}` }] } });
    } else if (!recovery || (scenario === 'repeated' && attempts >= 3)) {
      controller.transition('ESCALATE');
    } else {
      if (effects.length) { effects = []; compensated = true; events.push({ type: 'compensated', attempt: attempts }); }
      controller.transition('RETRY');
      if (controller.snapshot().state === 'RETRY') controller.transition('BUILD');
    }
  }
  const state = controller.snapshot();
  return { scenario, injected, detected, recovered: injected && detected && state.state === 'FINISH', falseCompletion: state.state === 'FINISH' && !lastVerified, attempts, compensated, remainingEffects: effects, finalState: state.state, reason: state.reason, events };
}
export async function runChaosSuite(options = {}) {
  const baseline = await runBaseline();
  const scenarios = [];
  for (const scenario of CHAOS_SCENARIOS) scenarios.push(await runChaosScenario({ ...options, scenario }));
  const injected = scenarios.filter(item => item.injected);
  return { baseline, scenarios, metrics: { injected: injected.length, detectionRate: injected.filter(item => item.detected).length / injected.length, recoveryRate: injected.filter(item => item.recovered).length / injected.length, falseCompletionRate: injected.filter(item => item.falseCompletion).length / injected.length } };
}
async function runBaseline() {
  const output = JSON.parse('{"answer":42}');
  return { passed: output.answer === 42, output, faultInjected: false };
}
