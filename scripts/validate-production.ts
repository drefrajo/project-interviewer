import {
  readApplicationEnvironment,
} from "../src/infrastructure/environment";

try {
  readApplicationEnvironment({ ...process.env, MODE: "production" });
  process.stdout.write("Production environment contract is valid.\n");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown configuration error.";
  process.stderr.write(`Production environment contract failed: ${message}\n`);
  process.exitCode = 1;
}
