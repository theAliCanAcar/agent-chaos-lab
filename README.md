# Agent Chaos Lab

Inject reproducible faults and measure detection and recovery.

Standalone ES module. No npm install required. Works in **Node.js 20+** and modern browsers (serve over HTTP for browser demos).

## Included files

This repository vendors local dependencies needed by the module:

- `agent-chaos-lab.js` (main)
- `retry-replan-controller.js`
- `dod-contract.js`

## Install / import

Copy the files into your project, or clone this repository:

```js
import { runChaosSuite } from './agent-chaos-lab.js';
// Use case: regression-test a bounded controller before connecting live inference.
console.log(await runChaosSuite({ maxRetries: 2, recovery: true }));
```

## Use cases

### 1. Crash-test response validation

- **Scenario:** An otherwise valid structured model response is truncated.
- **Outcome:** Record fault injection, rejection, bounded recovery, and the final verified outcome.

### 2. Build a reproducible resilience suite

- **Scenario:** Timeouts, missing results, stale state, and partial effects appear in production.
- **Outcome:** Replay deterministic faults locally and turn observed failures into regression cases.

## Exports

- `CHAOS_SCENARIOS`
- `runChaosScenario`
- `runChaosSuite`

## Notes

- Keep API keys and secrets out of this module and out of browser storage.
- Treat verification callbacks, ledger writers, and permission checks as trusted application code.
- This library is intentional local reliability plumbing, not a claim of cryptographic attestation unless stated in the source comments.

## License

MIT
