import { describe, expect, it } from "vitest";
import { creatorCopy } from "./creator-copy";

describe("Creator monetization copy", () => {
  it("explains account creation and privacy acknowledgement on sign-in", () => {
    expect(creatorCopy.en.auth.accountCreation).toBe(
      "If you don't have an account yet, we'll create one for you.",
    );
    expect(creatorCopy.en.auth.privacyAcknowledgementBefore).toBe(
      "By logging in, you acknowledge our",
    );
    expect(creatorCopy.en.auth.privacyPolicy).toBe("privacy policy");
    expect(creatorCopy.de.auth.accountCreation).toBe(
      "Wenn Sie noch kein Konto haben, erstellen wir automatisch eines für Sie.",
    );
    expect(creatorCopy.de.auth.privacyAcknowledgementBefore).toBe(
      "Mit der Anmeldung nehmen Sie unsere",
    );
    expect(creatorCopy.de.auth.privacyAcknowledgementAfter).toBe(
      " zur Kenntnis.",
    );
  });

  it("localizes the pass balance badge in singular and plural forms", () => {
    expect(creatorCopy.en.shell.passBalance(1)).toBe("1 Interview Pass");
    expect(creatorCopy.en.shell.passBalance(2)).toBe("2 Interview Passes");
    expect(creatorCopy.de.shell.passBalance(1)).toBe("1 Interview-Pass");
    expect(creatorCopy.de.shell.passBalance(2)).toBe("2 Interview-Pässe");
  });

  it("localizes the created Interview badge states", () => {
    expect(creatorCopy.en.interviews.reservationRequired).toBe(
      "Needs pass reservation",
    );
    expect(creatorCopy.en.interviews.ready).toBe("Ready");
    expect(creatorCopy.de.interviews.reservationRequired).toBe(
      "Pass-Reservierung erforderlich",
    );
    expect(creatorCopy.de.interviews.ready).toBe("Bereit");
  });

  it("uses the concise German reservation wording", () => {
    expect(creatorCopy.de.detail.reservationDescription).toBe(
      "Die Vorbereitung ist kostenlos. Beim ersten Kopieren oder Teilen wird ein Interview-Pass reserviert. Erst der bewusste Start durch den Client verbraucht ihn.",
    );
    expect(creatorCopy.de.detail.reservationConfirmDescription(1)).toBe(
      "Sie haben derzeit 1 verfügbaren Pass. Dadurch wird ein Pass reserviert; verbraucht wird er erst beim Start durch den Client.",
    );
  });

  it("uses translated interview and creator language labels", () => {
    expect(creatorCopy.en.form.interviewLanguage).toBe("Interview language");
    expect(creatorCopy.de.form.interviewLanguage).toBe("Interview-Sprache");
    expect(creatorCopy.en.settings.language).toBe("Language");
    expect(creatorCopy.de.settings.language).toBe("Sprache");
  });

  it.each(["en", "de"] as const)(
    "includes prices, tax disclosure, and reservation language in %s",
    (language) => {
      const text = creatorCopy[language];
      expect(text.billing.buyFor("€29")).toMatch(/29/);
      expect(text.billing.buyFor("€99")).toMatch(/99/);
      expect(text.billing.taxes).toMatch(/tax|Steuer/i);
      expect(text.detail.reservationDescription).toMatch(
        /pass|Pass/i,
      );
    },
  );

  it("states that prices include tax", () => {
    expect(creatorCopy.en.billing.taxes).toBe("including tax");
    expect(creatorCopy.de.billing.taxes).toBe("inkl. Steuern");
  });

  it.each(["en", "de"] as const)(
    "states that Settings must be complete before Interview creation in %s",
    (language) => {
      const text = creatorCopy[language];
      expect(text.shell.profileIncompleteTitle).toMatch(
        /Settings|Einstellungen/,
      );
      expect(text.shell.profileIncompleteDescription).toMatch(
        /before you can create|bevor Sie ein Interview erstellen können/i,
      );
      expect(text.settings.intro).toMatch(
        /before you can create|bevor Sie ein Interview erstellen können/i,
      );
    },
  );

  it.each(["en", "de"] as const)(
    "states that scheduled and manual deletion cannot be restored in %s",
    (language) => {
      const text = creatorCopy[language].detail;
      expect(text.deleteDescription).toMatch(/restored|wiederhergestellt/i);
      expect(text.retentionDescription("9 August 2027")).toMatch(
        /restored|wiederhergestellt/i,
      );
      expect(text.exportEverything).toMatch(/export|exportieren/i);
    },
  );
});
