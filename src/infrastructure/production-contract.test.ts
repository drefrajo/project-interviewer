import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCTION_LIMITS,
  safeOperationalMetadata,
} from "./production-contract";

describe("production boundary contract", () => {
  it("keeps quota and retry limits bounded", () => {
    expect(DEFAULT_PRODUCTION_LIMITS).toMatchObject({
      maxFilesPerRoom: 20,
      maxFileBytes: 25 * 1024 * 1024,
      maxRoomBytes: 100 * 1024 * 1024,
      maxConcurrentFileWorkflows: 3,
      maxWorkflowAttempts: 3,
      deletionRecoveryDays: 7,
    });
  });

  it("allows only scrubbed operational metadata", () => {
    expect(
      safeOperationalMetadata({
        operationType: "brief_generation",
        roomId: "room_1",
        status: "succeeded",
        model: "model",
        provider: "provider",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 100,
        prompt: "must be discarded",
        inviteToken: "must be discarded",
        excerpt: "must be discarded",
        storageUrl: "must be discarded",
      }),
    ).toEqual({
      operationType: "brief_generation",
      roomId: "room_1",
      status: "succeeded",
      model: "model",
      provider: "provider",
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 100,
    });
  });

  it("configures a portable static Cloudflare SPA with history fallback", async () => {
    const configuration = JSON.parse(
      await readFile(
        `${process.cwd()}/wrangler.json`,
        "utf8",
      ),
    );
    expect(configuration).toMatchObject({
      assets: {
        directory: "./dist",
        not_found_handling: "single-page-application",
      },
    });
    expect(configuration.main).toBeUndefined();
  });
});
