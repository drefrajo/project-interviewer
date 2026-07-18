import {
  EVALUATION_FIXTURES_V1,
  PILOT_SCENARIOS,
  REQUIRED_EVALUATION_SCENARIOS,
} from "../src/evaluation/fixtures-v1";
import { executeEvaluationCorpus } from "../src/evaluation/execute-fixtures";
import { runStageGateEvaluation } from "../src/evaluation/stage-gates";

const coveredScenarios = new Set(
  EVALUATION_FIXTURES_V1.flatMap((fixture) => fixture.scenarios),
);
const missingScenarios = REQUIRED_EVALUATION_SCENARIOS.filter(
  (scenario) => !coveredScenarios.has(scenario),
);
const coveredPilots = EVALUATION_FIXTURES_V1.flatMap((fixture) =>
  fixture.pilotScenario ? [fixture.pilotScenario] : [],
);
const missingPilots = PILOT_SCENARIOS.filter(
  (scenario) => !coveredPilots.includes(scenario),
);
const observations = await executeEvaluationCorpus(EVALUATION_FIXTURES_V1);
const stageGates = runStageGateEvaluation(observations);
const report = {
  ...stageGates,
  passed:
    stageGates.passed &&
    missingScenarios.length === 0 &&
    missingPilots.length === 0,
  corpus: {
    requiredScenarioCount: REQUIRED_EVALUATION_SCENARIOS.length,
    coveredScenarioCount:
      REQUIRED_EVALUATION_SCENARIOS.length - missingScenarios.length,
    missingScenarios,
    requiredPilotCount: PILOT_SCENARIOS.length,
    coveredPilotCount: PILOT_SCENARIOS.length - missingPilots.length,
    missingPilots,
  },
  humanOnlyCriteria: {
    status: "pending",
    blocksMachineCompletion: false,
    criteria: [
      "English and German absolute human usefulness threshold",
      "Five representative end-to-end pilot projects",
      "Satisfactory Review Version within 15 minutes of Freelancer editing",
    ],
  },
};
const outputPath =
  process.argv[2] ??
  `${process.cwd()}/.scratch/file-first-discovery/evaluation-report.json`;

await Bun.write(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (!report.passed) process.exitCode = 1;
