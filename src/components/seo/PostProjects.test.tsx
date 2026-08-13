import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostProjects } from "./PostProjects";

describe("PostProjects", () => {
  it("renders the author-defined reading order and marks the current post", () => {
    render(
      <PostProjects
        currentPostId="process"
        projects={[
          {
            id: "volk",
            slug: "volk-durak",
            title: "Волк-дурак",
            description: "Комикс и заметки о его создании.",
            metaTitle: "",
            metaDescription: "",
            updatedAt: new Date("2026-08-14"),
            posts: [
              {
                id: "search",
                slug: "poisk-volka",
                title: "Поиск образа",
                body: "",
                updatedAt: new Date("2026-08-14"),
                publishedAt: new Date("2026-08-14"),
              },
              {
                id: "process",
                slug: "process-volka",
                title: "Процесс работы",
                body: "",
                updatedAt: new Date("2026-08-14"),
                publishedAt: new Date("2026-08-14"),
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Поиск образа" })).toHaveAttribute(
      "href",
      "/p/poisk-volka",
    );
    expect(screen.getByText("Процесс работы")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Все материалы цикла" })).toHaveAttribute(
      "href",
      "/projects/volk-durak",
    );
  });
});
