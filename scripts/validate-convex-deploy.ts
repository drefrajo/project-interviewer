import { readStripeConfiguration } from "../convex/lib/stripe_catalog";

const deployKey = process.env.CONVEX_DEPLOY_KEY?.trim();

if (!deployKey) {
  process.stderr.write(
    "Convex deploy validation failed: missing CONVEX_DEPLOY_KEY.\n",
  );
  process.exitCode = 1;
} else {
  try {
    readStripeConfiguration(process.env);
  } catch (error) {
    process.stderr.write(
      `Convex deploy validation failed: ${
        error instanceof Error ? error.message : "invalid Stripe configuration"
      }\n`,
    );
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    process.stdout.write("Convex deploy-machine and Stripe environment are valid.\n");
  }
}
