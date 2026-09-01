import type { WanderCatalogue } from "@/lib/wander";

export function wanderFixture(): WanderCatalogue {
  return {
    posts: [
      { id: "a", slug: "portret", title: "Первый портрет", images: [{ id: "a-1", src: "/a.webp", thumbnail: "/a-small.webp", alt: "Портрет", width: 800, height: 1000 }], projectIds: ["portrait"] },
      { id: "b", slug: "bridge", title: "Портрет ручкой", images: [{ id: "b-1", src: "/b.webp", thumbnail: "/b-small.webp", alt: "Портрет ручкой", width: 1000, height: 800 }], projectIds: ["portrait", "pen"] },
      { id: "c", slug: "pen", title: "Рисунок ручкой", images: [{ id: "c-1", src: "/c.webp", thumbnail: "/c-small.webp", alt: "Рисунок", width: 800, height: 1000 }], projectIds: ["pen"] },
      { id: "d", slug: "wolf", title: "Волк-дурень", images: [{ id: "d-1", src: "/d.webp", thumbnail: "/d-small.webp", alt: "Волк", width: null, height: null }], projectIds: ["wolf"] },
    ],
    projects: [
      { id: "portrait", slug: "portret", title: "портрет", postIds: ["a", "b"] },
      { id: "pen", slug: "ruchka", title: "ручка", postIds: ["b", "c"] },
      { id: "wolf", slug: "volk-duren", title: "волк-дурень", postIds: ["d"] },
    ],
  };
}
