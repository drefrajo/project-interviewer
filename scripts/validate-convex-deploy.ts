const deployKey = process.env.CONVEX_DEPLOY_KEY?.trim();

if (!deployKey) {
  process.stderr.write(
    "Convex deploy validation failed: missing CONVEX_DEPLOY_KEY.\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Convex deploy-machine environment is valid.\n");
}
