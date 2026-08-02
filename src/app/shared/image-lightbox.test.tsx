import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ImageLightbox } from "./image-lightbox";

describe("ImageLightbox", () => {
  it("opens a focused image and closes it again", async () => {
    const user = userEvent.setup();
    render(
      <ImageLightbox
        alt="Editorial concept"
        closeLabel="Close image"
        openLabel="View larger"
        src="https://example.com/concept.png"
      />,
    );

    await user.click(screen.getByRole("button", { name: "View larger: Editorial concept" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close image" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
