import { spawn } from "node:child_process";

const localEnvironment = {
  SITE_URL: "http://localhost:5173",
  BETTER_AUTH_SECRET:
    "local-development-only-better-auth-secret-do-not-use-hosted",
  CAPABILITY_ENCRYPTION_SECRET:
    "local-development-only-capability-secret-do-not-use-hosted",
  CREATOR_ALLOWLIST: "all",
  LOCAL_DEV_AUTH_BYPASS: "true",
} as const;

const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("bunx", ["convex", ...args], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`bunx convex ${args.join(" ")} exited with ${code}`));
    });
  });

await run(["deployment", "select", "local"]);

for (const [name, value] of Object.entries(localEnvironment)) {
  await run(["env", "set", name, value]);
}

await run(["dev"]);
