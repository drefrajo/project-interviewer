import { access } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright-core";
import { contrastRatio } from "../src/infrastructure/accessibility-contract";
import {
  resolveBrowserExecutable,
  runtimeBaseUrl,
  runtimeStorageStatePath,
} from "./runtime-browser";

const baseUrl = runtimeBaseUrl();
const storageStatePath = runtimeStorageStatePath();
await access(storageStatePath).catch(() => {
  throw new Error(
    `No authenticated Freelancer session exists at ${storageStatePath}. Run bun run runtime:capture-session first.`,
  );
});
const executablePath = await resolveBrowserExecutable();

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const rgbToHex = (color: string) => {
  const channels = color.match(/\d+(?:\.\d+)?/gu)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Could not parse rendered color: ${color}`);
  }
  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
};

const observableSurface = async (page: Page) =>
  page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        "a, button, input, select, textarea",
      ),
    ).filter((element) => {
      const style = getComputedStyle(element);
      const rectangle = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rectangle.width > 0 &&
        rectangle.height > 0
      );
    });
    const unlabeledControls = controls
      .filter((element) => {
        if (element.getAttribute("aria-label")) return false;
        if (element.getAttribute("aria-labelledby")) return false;
        if (element.closest("label")) return false;
        if (
          element.id &&
          document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
        ) {
          return false;
        }
        return !(element.textContent?.trim() || element.getAttribute("title"));
      })
      .map((element) => element.outerHTML.slice(0, 180));
    const undersizedTargets = controls
      .filter(
        (element) =>
          element.getAttribute("type") !== "hidden" &&
          element.getAttribute("type") !== "file",
      )
      .map((element) => {
        const rectangle = element.getBoundingClientRect();
        return {
          name:
            element.getAttribute("aria-label") ??
            element.textContent?.trim().slice(0, 50) ??
            element.tagName,
          width: rectangle.width,
          height: rectangle.height,
        };
      })
      .filter(({ width, height }) => width < 24 || height < 24);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      unlabeledControls,
      undersizedTargets,
    };
  });

const verifySurface = async (page: Page, label: string) => {
  const surface = await observableSurface(page);
  assert(!surface.horizontalOverflow, `${label} has horizontal page overflow.`);
  assert(
    surface.unlabeledControls.length === 0,
    `${label} has unlabeled controls: ${surface.unlabeledControls.join(", ")}`,
  );
  assert(
    surface.undersizedTargets.length === 0,
    `${label} has interaction targets below 24px: ${JSON.stringify(surface.undersizedTargets)}`,
  );
  return surface;
};

let browser: Browser | undefined;
try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ storageState: storageStatePath });
  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1280, height: 720 });
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });

  await desktop.keyboard.press("Tab");
  const firstFocus = await desktop.evaluate(() => ({
    text: document.activeElement?.textContent?.trim(),
    href: document.activeElement?.getAttribute("href"),
  }));
  assert(
    firstFocus.href === "#main-content",
    "The skip link must be the first keyboard focus target.",
  );
  await desktop.keyboard.press("Enter");
  assert(
    (await desktop.evaluate(() => location.hash)) === "#main-content",
    "The skip link must navigate to the main content.",
  );

  const fixtureId = Date.now();
  const roomTitle = `Runtime verification ${fixtureId}`;
  await desktop
    .getByRole("button", { exact: true, name: "Create Project Room" })
    .click();
  await desktop.getByLabel("Project title").fill(roomTitle);
  await desktop.getByLabel("Client name or label").fill("Runtime Client");
  await desktop
    .getByLabel("Project Description")
    .fill("Verify the complete hosted Project Interviewer workflow.");
  await desktop
    .getByRole("button", { exact: true, name: "Create room" })
    .click();
  await desktop
    .getByRole("heading", { exact: true, name: roomTitle })
    .waitFor();

  const desktopRoomSurface = await verifySurface(
    desktop,
    "Desktop Project Home",
  );
  const tablist = desktop.getByRole("tablist", { name: "Project Room" });
  assert((await tablist.getByRole("tab").count()) === 4, "Project Home must expose four real tabs.");
  const tabPosition = await tablist.evaluate((element) =>
    getComputedStyle(element.closest("aside")!).position,
  );
  assert(tabPosition === "sticky", "Desktop Project Room tabs must remain sticky.");
  const inviteUrl = await desktop
    .getByRole("heading", { name: "Invite Link created" })
    .locator("..")
    .locator("code")
    .innerText();

  await desktop.getByRole("tab", { name: "Project Material" }).click();
  assert(
    (await desktop.getByRole("button", { name: "Continue without files" }).count()) === 0,
    "The Freelancer must not be offered the no-material path.",
  );
  await verifySurface(desktop, "Desktop Project Material");

  const activeTabColors = await desktop
    .getByRole("tab", { name: "Project Material" })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor };
    });
  assert(
    contrastRatio(
      rgbToHex(activeTabColors.foreground),
      rgbToHex(activeTabColors.background),
    ) >= 4.5,
    "The active Project Room tab does not meet WCAG AA text contrast.",
  );
  const focusedTab = desktop.getByRole("tab", { name: "Project Material" });
  await focusedTab.focus();
  const focusStyle = await focusedTab.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, color: style.outlineColor };
  });
  assert(
    Number.parseFloat(focusStyle.width) >= 3,
    "Keyboard focus must have a visible three-pixel outline.",
  );

  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(inviteUrl, { waitUntil: "networkidle" });
  await phone.getByLabel("Your display name").fill("Runtime Client");
  await phone.getByRole("checkbox").check();
  await phone
    .getByRole("button", { exact: true, name: "Enter Project Room" })
    .click();
  await phone
    .getByRole("heading", { exact: true, name: roomTitle })
    .waitFor();
  await verifySurface(phone, "Phone Project Home");

  await phone.getByRole("tab", { name: "Project Material" }).click();
  await phone.getByLabel("Add Project Material").setInputFiles({
    name: "runtime-verification.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "The hosted Project Room must support a conversational interview, Markdown Project Brief review, and Client approval.",
    ),
  });
  await phone
    .getByRole("heading", { exact: true, name: "runtime-verification.txt" })
    .waitFor({ timeout: 120_000 });
  await phone
    .getByText("Analyzed", { exact: true })
    .waitFor({ timeout: 120_000 });

  await phone.getByRole("tab", { name: "Discovery Interview" }).click();
  await phone
    .getByRole("button", { exact: true, name: "Start conversation" })
    .click();
  await phone.getByLabel("Your reply").waitFor({ timeout: 120_000 });
  await verifySurface(phone, "Phone conversational interview");
  await phone.getByText("Conversation options", { exact: true }).click();
  phone.once("dialog", (dialog) => dialog.accept());
  await phone
    .getByRole("button", { exact: true, name: "Finish early" })
    .click();
  await phone
    .getByText("This conversation was deliberately finished early.", {
      exact: false,
    })
    .waitFor();

  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop
    .getByRole("button", { exact: true, name: `Open ${roomTitle}` })
    .click();
  await desktop.getByRole("tab", { name: "Project Brief" }).click();
  await desktop
    .getByRole("button", { exact: true, name: "Generate Project Brief" })
    .click();
  await desktop
    .getByLabel("Project Brief Markdown")
    .waitFor({ timeout: 120_000 });
  await verifySurface(desktop, "Desktop Markdown Brief Draft");
  assert(
    (await desktop.getByLabel("Project Brief Markdown").inputValue()).startsWith("# Project Brief"),
    "The Brief Draft must expose one Markdown document.",
  );
  const acknowledge = desktop.getByRole("button", {
    exact: true,
    name: "Acknowledge",
  });
  while ((await acknowledge.count()) > 0) {
    await acknowledge.first().click();
  }
  await desktop
    .getByRole("button", { exact: true, name: "Send for Client review" })
    .click();
  await desktop
    .getByRole("heading", { exact: true, name: "Review Version 1" })
    .waitFor();
  await verifySurface(desktop, "Desktop Project Brief Review Version");

  const phoneBriefUrl = new URL(phone.url());
  phoneBriefUrl.searchParams.set("tab", "brief");
  await phone.goto(phoneBriefUrl.toString(), { waitUntil: "networkidle" });
  await phone
    .getByRole("heading", { exact: true, name: "Review Version 1" })
    .waitFor();
  assert(
    (await phone.getByLabel("Change Request").count()) === 1,
    "Client review must place one Change Request field below the Review Version.",
  );
  const phoneReviewSurface = await verifySurface(
    phone,
    "Phone Project Brief Review Version",
  );
  await phone
    .getByRole("button", {
      exact: true,
      name: "Approve this Review Version",
    })
    .click();
  await phone.getByText("approved", { exact: true }).waitFor();
  await verifySurface(phone, "Phone approved Project Brief");

  const phoneNavigation = await phone
    .getByRole("tablist", { name: "Project Room" })
    .evaluate((navigation) => ({
      overflowX: getComputedStyle(navigation).overflowX,
      clientWidth: navigation.clientWidth,
      scrollWidth: navigation.scrollWidth,
    }));
  assert(
    phoneNavigation.overflowX === "auto" &&
      phoneNavigation.scrollWidth >= phoneNavigation.clientWidth,
    "Phone Project Room navigation must remain reachable by horizontal scrolling.",
  );

  await phone.getByRole("button", { exact: true, name: "DE" }).click();
  assert(
    (await phone.evaluate(() => document.documentElement.lang)) === "de",
    "German selection did not update the document language.",
  );

  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  const roomCard = desktop
    .getByRole("button", { exact: true, name: `Open ${roomTitle}` })
    .locator("..");
  const normalTransition = await roomCard.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  assert(
    Number.parseFloat(normalTransition) > 0.01,
    "The reduced-motion check requires a normally animated room card.",
  );
  await desktop.emulateMedia({ reducedMotion: "reduce" });
  const reducedTransition = await roomCard.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  assert(
    Number.parseFloat(reducedTransition) <= 0.01,
    "Reduced-motion rendering did not suppress the room-card transition.",
  );

  const report = {
    schemaVersion: "convex-runtime-accessibility-v2",
    passed: true,
    runtime: baseUrl,
    browser: executablePath,
    checks: {
      authenticatedConvexRuntime: true,
      keyboardSkipNavigation: true,
      realStickyTabs: true,
      freelancerNoMaterialRestriction: true,
      hostedProjectMaterialAnalysis: true,
      conversationalInterview: true,
      markdownBriefDraft: true,
      clientReviewAndApproval: true,
      accessibleNames: true,
      visibleFocus: true,
      reducedMotion: true,
      wcagContrast: true,
      wcagTargetSize: true,
      germanDocumentLanguage: true,
      desktopNoOverflow: true,
      phoneNoOverflow: true,
      phoneNavigationReachable: true,
    },
    viewports: [desktopRoomSurface.viewport, phoneReviewSurface.viewport],
  };
  await Bun.write(
    `${process.cwd()}/.scratch/file-first-discovery/accessibility-report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
}
