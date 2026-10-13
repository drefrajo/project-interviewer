import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [".scratch/interview-evaluation/replay.test.ts"],
    environment: "edge-runtime",
    restoreMocks: true,
  },
});
