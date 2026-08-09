import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Price updates normally refresh the cached UI catalog through Stripe's price
// webhooks. This low-frequency read-only fallback also repairs missed webhooks.
crons.interval(
  "refresh Stripe Interview Pass catalog",
  { hours: 1 },
  internal.billing.syncCatalog,
  {},
);

crons.cron(
  "delete Interviews past their retention deadline",
  "15 2 * * *",
  internal.retention.runSweep,
  {},
);

export default crons;
