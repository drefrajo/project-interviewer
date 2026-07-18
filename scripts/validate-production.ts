import {
  EnvironmentConfigurationError,
  readApplicationEnvironment,
} from "../src/infrastructure/environment";

try {
  readApplicationEnvironment(process.env);
  if (process.env.VITE_APP_MODE !== "production") {
    throw new EnvironmentConfigurationError(
      "VITE_APP_MODE must be production for a hosted build or deployment.",
    );
  }
  process.stdout.write("Production environment contract is valid.\n");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown configuration error.";
  process.stderr.write(`Production environment contract failed: ${message}\n`);
  process.exitCode = 1;
}
