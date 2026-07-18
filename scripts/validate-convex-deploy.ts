import {
  readDeploymentEnvironment,
} from "../src/infrastructure/environment";

try {
  readDeploymentEnvironment(process.env);
  process.stdout.write("Convex deploy-machine environment is valid.\n");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown configuration error.";
  process.stderr.write(`Convex deploy validation failed: ${message}\n`);
  process.exitCode = 1;
}
