import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostProjectTags, projectTagLabel } from "./PostProjectTags";

describe("PostProjectTags", () => {
  it("makes a readable hashtag from the collection title", () => {
    expect(projectTagLabel("Дом")).toBe("#дом");
    expect(projectTagLabel("Волк-дурак: поиск образа")).toBe(
      "#волк-дурак-поиск-образа",
    );
  });

  it("links the hashtag to the work collection", () => {
    render(
      <PostProjectTags
        projects={[
          {
            id: "home",
            slug: "dom",
            title: "Дом",
            description: "",
            metaTitle: "",
            metaDescription: "",
            updatedAt: new Date("2026-08-14"),
            posts: [],
          },
        ]}
      />,
    );
    const tag = screen.getByRole("link", { name: "#дом" });
    expect(tag).toHaveAttribute("href", "/projects/dom");
    expect(tag).toHaveClass("pointer-events-auto");
  });
});
