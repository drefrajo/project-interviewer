import { describe, expect, it } from "vitest";
import { CLIENT_COPY } from "./client-copy";

describe("Client reservation copy", () => {
  it.each(["en", "de"] as const)(
    "explains that an unreserved Interview cannot begin in %s",
    (language) => {
      expect(CLIENT_COPY[language].reservationRequiredTitle).toBeTruthy();
      expect(CLIENT_COPY[language].reservationRequiredDescription).toMatch(
        /reserv|reservier/i,
      );
    },
  );
});
