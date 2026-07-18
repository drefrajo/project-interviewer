import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();

crons.hourly(
  "purge expired project rooms",
  { minuteUTC: 17 },
  makeFunctionReference<"mutation">("deletion:purgeExpiredRooms"),
);

export default crons;
