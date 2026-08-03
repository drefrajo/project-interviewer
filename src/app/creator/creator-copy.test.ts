import { describe, expect, it } from "vitest";
import { creatorCopy } from "./creator-copy";

describe("Creator monetization copy", () => {
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
      expect(text.billing.buyOne).toMatch(/29/);
      expect(text.billing.buyFive).toMatch(/99/);
      expect(text.billing.taxes).toMatch(/tax|Steuer/i);
      expect(text.detail.reservationDescription).toMatch(
        /pass|Pass/i,
      );
    },
  );
});
