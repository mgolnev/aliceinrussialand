import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostRichText } from "./PostRichText";

describe("PostRichText", () => {
  it("renders post links as standard blue links", () => {
    render(<PostRichText value="[Деколью](https://example.com)" />);
    const link = screen.getByRole("link", { name: "Деколью" });
    expect(link).toHaveAttribute("href", "https://example.com/");
    expect(link).toHaveClass("text-blue-600", "decoration-blue-400");
  });
});
