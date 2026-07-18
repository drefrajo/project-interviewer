import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "playwright-core";
import {
  resolveBrowserExecutable,
  runtimeBaseUrl,
  runtimeStorageStatePath,
} from "./runtime-browser";

const baseUrl = runtimeBaseUrl();
const storageStatePath = runtimeStorageStatePath();
const browser = await chromium.launch({
  executablePath: await resolveBrowserExecutable(),
  headless: false,
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  process.stdout.write(
    "Complete Freelancer sign-in in the opened browser. The session will be saved when the Project Rooms workspace appears.\n",
  );
  await page
    .getByRole("heading", { name: /Project Rooms|Projekträume/u })
    .waitFor({ timeout: 10 * 60_000 });
  await mkdir(dirname(storageStatePath), { recursive: true });
  await context.storageState({ path: storageStatePath });
  process.stdout.write(`Saved runtime session to ${storageStatePath}.\n`);
} finally {
  await browser.close();
}
