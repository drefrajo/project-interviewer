import { access } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { contrastRatio } from "../src/infrastructure/accessibility-contract";

const baseUrl = "http://localhost";
const candidateExecutables = [
  process.env.BROWSER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((value): value is string => Boolean(value));

const executablePath = await (async () => {
  for (const candidate of candidateExecutables) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next explicitly supported browser path.
    }
  }
  throw new Error(
    "A Chromium browser is required for the rendered accessibility gate. Set BROWSER_EXECUTABLE_PATH to Chrome, Edge, or Chromium.",
  );
})();

const assert = (
  condition: unknown,
  message: string,
): asserts condition => {
  if (!condition) throw new Error(message);
};

const rgbToHex = (color: string) => {
  const channels = color.match(/\d+(?:\.\d+)?/gu)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Could not parse rendered color: ${color}`);
  }
  return `#${channels
    .map((channel) =>
      Math.round(channel).toString(16).padStart(2, "0"),
    )
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
      .filter((element) => element.getAttribute("type") !== "hidden")
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
      liveRegions: document.querySelectorAll("[aria-live], [role=status]")
        .length,
      unlabeledControls,
      undersizedTargets,
    };
  });

let browser: Browser | undefined;
try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const dist = normalize(join(process.cwd(), "dist"));
  const contentTypes: Record<string, string> = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".map": "application/json",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
  };
  await context.route(`${baseUrl}/**`, async (route) => {
    const url = new URL(route.request().url());
    const requested = normalize(
      join(dist, decodeURIComponent(url.pathname).replace(/^\/+/u, "")),
    );
    const path =
      requested.startsWith(dist) &&
      extname(requested) &&
      (await access(requested).then(
        () => true,
        () => false,
      ))
        ? requested
        : join(dist, "index.html");
    await route.fulfill({
      path,
      contentType: contentTypes[extname(path)] ?? "application/octet-stream",
    });
  });
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.abort(),
  );
  await context.route("https://fonts.gstatic.com/**", (route) =>
    route.abort(),
  );
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

  const createButton = desktop.getByRole("button", {
    exact: true,
    name: "Create Project Room",
  });
  await createButton.focus();
  await desktop.keyboard.press("Enter");
  const title = desktop.getByLabel("Project title");
  await title.focus();
  await desktop.keyboard.type("Rendered accessibility fixture");
  const client = desktop.getByLabel("Client name or label");
  await client.focus();
  await desktop.keyboard.type("Synthetic Client");
  const description = desktop.getByLabel("Project Description");
  await description.focus();
  await desktop.keyboard.type(
    "A synthetic local keyboard and responsive verification.",
  );
  const createRoom = desktop.getByRole("button", {
    exact: true,
    name: "Create room",
  });
  await createRoom.focus();
  await desktop.keyboard.press("Enter");
  await desktop.getByRole("heading", {
    exact: true,
    name: "Rendered accessibility fixture",
  }).waitFor();

  const surfaces: Awaited<ReturnType<typeof observableSurface>>[] = [];
  const verifySurface = async (page: Page, label: string) => {
    const surface = await observableSurface(page);
    assert(
      !surface.horizontalOverflow,
      `${label} has horizontal page overflow.`,
    );
    assert(
      surface.unlabeledControls.length === 0,
      `${label} has unlabeled controls: ${surface.unlabeledControls.join(", ")}`,
    );
    assert(
      surface.undersizedTargets.length === 0,
      `${label} has interaction targets below 24px: ${JSON.stringify(surface.undersizedTargets)}`,
    );
    assert(
      surface.liveRegions > 0,
      `${label} must expose a progress live region.`,
    );
    surfaces.push(surface);
    return surface;
  };
  const desktopRoomSurface = await verifySurface(
    desktop,
    "Desktop Project Room",
  );
  const inviteUrl = await desktop.locator(".invite-panel code").innerText();

  const renderedColors = await desktop.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const muted = getComputedStyle(
      document.querySelector<HTMLElement>(".room-intro p")!,
    );
    const primary = getComputedStyle(
      document.querySelector<HTMLElement>(".button.primary")!,
    );
    return {
      rootForeground: root.color,
      rootBackground: root.backgroundColor,
      mutedForeground: muted.color,
      primaryForeground: primary.color,
      primaryBackground: primary.backgroundColor,
    };
  });
  for (const [foreground, background, label] of [
    [
      renderedColors.rootForeground,
      renderedColors.rootBackground,
      "body text",
    ],
    [
      renderedColors.mutedForeground,
      renderedColors.rootBackground,
      "secondary text",
    ],
    [
      renderedColors.primaryForeground,
      renderedColors.primaryBackground,
      "primary action",
    ],
  ] as const) {
    assert(
      contrastRatio(rgbToHex(foreground), rgbToHex(background)) >= 4.5,
      `${label} does not meet WCAG AA contrast.`,
    );
  }
  const primaryButton = desktop.getByRole("button", {
    exact: true,
    name: "Continue without files",
  });
  await primaryButton.focus();
  const focusStyle = await primaryButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: style.outlineWidth,
      color: style.outlineColor,
      background: getComputedStyle(document.documentElement).backgroundColor,
    };
  });
  assert(
    Number.parseFloat(focusStyle.width) >= 3 &&
      contrastRatio(
        rgbToHex(focusStyle.color),
        rgbToHex(focusStyle.background),
      ) >= 3,
    "Keyboard focus is not visibly rendered at non-text contrast.",
  );

  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  const roomCard = desktop.locator(".room-card");
  const normalTransition = await roomCard.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  assert(
    Number.parseFloat(normalTransition) > 0.01,
    "The reduced-motion check requires a normally animated surface.",
  );
  await desktop.emulateMedia({ reducedMotion: "reduce" });
  const reducedTransition = await roomCard.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  assert(
    Number.parseFloat(reducedTransition) <= 0.01,
    "Reduced-motion rendering did not suppress the room-card transition.",
  );
  await desktop.emulateMedia({ reducedMotion: "no-preference" });

  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(inviteUrl, { waitUntil: "networkidle" });
  const displayName = phone.getByLabel("Your display name");
  await displayName.focus();
  await phone.keyboard.type("Synthetic Client");
  const acknowledgement = phone.getByRole("checkbox");
  await acknowledgement.focus();
  await phone.keyboard.press("Space");
  const enterRoom = phone.getByRole("button", {
    exact: true,
    name: "Enter Project Room",
  });
  await enterRoom.focus();
  await phone.keyboard.press("Enter");
  await phone.getByRole("heading", {
    exact: true,
    name: "Rendered accessibility fixture",
  }).waitFor();
  await verifySurface(phone, "Phone Project Material");

  const upload = phone.getByLabel("Add Project Material");
  await upload.focus();
  const chooserPromise = phone.waitForEvent("filechooser");
  await phone.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "accessibility.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "The accessible Project Room must work on phone and desktop.",
    ),
  });
  await phone
    .getByRole("heading", { exact: true, name: "accessibility.txt" })
    .waitFor();
  await phone.getByText("Analyzed", { exact: true }).waitFor();

  const startInterview = phone.getByRole("button", {
    exact: true,
    name: "Start Discovery Interview",
  });
  await startInterview.focus();
  await phone.keyboard.press("Enter");
  await phone.getByLabel("Your answer").waitFor();
  await verifySurface(phone, "Phone Discovery Interview");
  const finishEarly = phone.getByRole("button", {
    exact: true,
    name: "Finish early",
  });
  phone.once("dialog", (dialog) => dialog.accept());
  await finishEarly.focus();
  await phone.keyboard.press("Enter");
  await phone.getByText("Discovery was deliberately finished early.", {
    exact: false,
  }).waitFor();

  await desktop.goto(new URL(inviteUrl).origin, { waitUntil: "networkidle" });
  const desktopRoomLink = desktop.getByRole("button", {
    exact: true,
    name: "Open Rendered accessibility fixture",
  });
  await desktopRoomLink.focus();
  await desktop.keyboard.press("Enter");
  const generateBrief = desktop.getByRole("button", {
    exact: true,
    name: "Generate Project Brief",
  });
  await generateBrief.focus();
  await desktop.keyboard.press("Enter");
  await desktop
    .getByRole("heading", { exact: true, name: "Brief Draft" })
    .waitFor();
  await verifySurface(desktop, "Desktop Project Brief draft");
  const warningButton = desktop.getByRole("button", {
    exact: true,
    name: "Acknowledge open warning",
  });
  while ((await warningButton.count()) > 0) {
    const button = warningButton.first();
    await button.focus();
    await desktop.keyboard.press("Enter");
    await desktop.waitForTimeout(25);
  }
  const sendReview = desktop.getByRole("button", {
    exact: true,
    name: "Send for Client review",
  });
  await sendReview.focus();
  await desktop.keyboard.press("Enter");
  await desktop
    .getByRole("heading", { exact: true, name: "Review Version 1" })
    .waitFor();
  await verifySurface(desktop, "Desktop Project Brief review");

  await phone.reload({ waitUntil: "networkidle" });
  await phone
    .getByRole("heading", { exact: true, name: "Review Version 1" })
    .waitFor();
  const phoneReviewSurface = await verifySurface(
    phone,
    "Phone Project Brief review",
  );
  const approve = phone.getByRole("button", {
    exact: true,
    name: "Approve this Review Version",
  });
  await approve.focus();
  await phone.keyboard.press("Enter");
  await phone.getByText(
    "Approved discovery understanding — not a signature or contract.",
  ).waitFor();
  await verifySurface(phone, "Phone approved Project Brief");

  const phoneNavigation = await phone.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>(
      ".room-sidebar nav",
    );
    return navigation
      ? {
          overflowX: getComputedStyle(navigation).overflowX,
          clientWidth: navigation.clientWidth,
          scrollWidth: navigation.scrollWidth,
        }
      : null;
  });
  assert(
    phoneNavigation?.overflowX === "auto" &&
      phoneNavigation.scrollWidth >= phoneNavigation.clientWidth,
    "Phone Project Room navigation must remain reachable by horizontal scrolling.",
  );

  const germanButton = desktop.getByRole("button", {
    exact: true,
    name: "DE",
  });
  await germanButton.focus();
  await desktop.keyboard.press("Enter");
  assert(
    (await desktop.evaluate(() => document.documentElement.lang)) === "de",
    "German selection did not update the document language.",
  );
  await desktop
    .getByRole("heading", { exact: true, name: "Prüfversion 1" })
    .waitFor();

  const report = {
    schemaVersion: "file-first-discovery-accessibility-v1",
    passed: true,
    browser: executablePath,
    checks: {
      keyboardSkipNavigation: true,
      keyboardRoomCreation: true,
      keyboardProjectMaterialUpload: true,
      keyboardDiscoveryInterview: true,
      keyboardProjectBriefReview: true,
      keyboardClientApproval: true,
      accessibleNames: true,
      liveRegions: true,
      visibleFocus: true,
      reducedMotion: true,
      wcagContrast: true,
      wcagTargetSize: true,
      germanDocumentLanguage: true,
      desktopNoOverflow: true,
      phoneNoOverflow: true,
      phoneNavigationReachable: true,
    },
    viewports: [
      desktopRoomSurface.viewport,
      phoneReviewSurface.viewport,
    ],
  };
  await Bun.write(
    `${process.cwd()}/.scratch/file-first-discovery/accessibility-report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
}
