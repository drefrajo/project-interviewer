import { describe, expect, it } from "vitest";
import {
  EVALUATION_FIXTURES_V1,
  PILOT_SCENARIOS,
  REQUIRED_EVALUATION_SCENARIOS,
} from "./fixtures-v1";
import { executeEvaluationCorpus } from "./execute-fixtures";
import { runStageGateEvaluation } from "./stage-gates";

describe("File-First Discovery evaluation corpus", () => {
  it("covers every specified synthetic scenario and all five pilot-shaped flows", () => {
    const coveredScenarios = new Set(
      EVALUATION_FIXTURES_V1.flatMap((fixture) => fixture.scenarios),
    );
    expect(
      REQUIRED_EVALUATION_SCENARIOS.filter(
        (scenario) => !coveredScenarios.has(scenario),
      ),
    ).toEqual([]);
    expect(
      EVALUATION_FIXTURES_V1.filter((fixture) => fixture.pilotScenario).map(
        (fixture) => fixture.pilotScenario,
      ),
    ).toEqual(PILOT_SCENARIOS);
    expect(
      EVALUATION_FIXTURES_V1.every(
        (fixture) =>
          fixture.version === "file-first-discovery-eval-v1" &&
          fixture.synthetic &&
          fixture.deidentified,
      ),
    ).toBe(true);
  });

  it("passes every machine-verifiable launch gate for the executed corpus", async () => {
    const observations = await executeEvaluationCorpus(
      EVALUATION_FIXTURES_V1,
    );
    const report = runStageGateEvaluation(observations);

    expect(report.schemaVersion).toBe("file-first-discovery-stage-gates-v1");
    expect(report.fixtureVersion).toBe("file-first-discovery-eval-v1");
    expect(report.passed).toBe(true);
    expect(report.gates.map(({ id }) => id)).toEqual([
      "file-analysis",
      "retrieval",
      "interview",
      "brief",
      "language",
      "state-security",
    ]);
    expect(report.gates.every(({ passed }) => passed)).toBe(true);
  });

  it("fails closed when observed evidence, traceability, or isolation regresses", async () => {
    const observations = await executeEvaluationCorpus(
      EVALUATION_FIXTURES_V1,
    );
    const first = observations[0]!;
    const regressed = [
      {
        ...first,
        fileAnalysis: {
          ...first.fileAnalysis,
          claims: [{ text: "Invented claim", sourceSupported: false }],
        },
        retrieval: {
          ...first.retrieval,
          crossRoomResults: 1,
        },
        brief: {
          ...first.brief,
          unsupportedAgreedRequirements: 1,
          substantiveClaims: 1,
          tracedSubstantiveClaims: 0,
        },
        stateSecurity: {
          ...first.stateSecurity,
          revokedLinkRejected: false,
        },
      },
      ...observations.slice(1),
    ];

    const report = runStageGateEvaluation(regressed);

    expect(report.passed).toBe(false);
    expect(
      report.gates
        .filter(({ passed }) => !passed)
        .map(({ id }) => id),
    ).toEqual(expect.arrayContaining(["brief", "state-security"]));
  });
});
