import { describe, expect, it } from "vitest";
import {
  drawWanderLabel,
  restoreWanderLabelDeck,
  WANDER_LABEL_RECENT_LIMIT,
  WANDER_NEXT_LABELS,
  type WanderLabelDeck,
} from "./wander-labels";

describe("реплики кнопки прогулки", () => {
  it("содержит 120 уникальных коротких реплик без служебных действий", () => {
    expect(WANDER_NEXT_LABELS).toHaveLength(120);
    expect(new Set(WANDER_NEXT_LABELS).size).toBe(120);
    for (const label of WANDER_NEXT_LABELS) {
      expect(label.length).toBeLessThanOrEqual(18);
      expect(label).toBe(label.trim());
      expect(["дальше", "хватит", "пропустить"]).not.toContain(label);
    }
  });

  it.each([0, 0.5, 0.999])("проходит весь запас без повторов при random=%s", (random) => {
    let deck: WanderLabelDeck = { remaining: [], recent: [] };
    const history: string[] = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      const currentCycle: string[] = [];
      for (let i = 0; i < WANDER_NEXT_LABELS.length; i++) {
        const drawn = drawWanderLabel(deck, () => random);
        expect(history.slice(-WANDER_LABEL_RECENT_LIMIT)).not.toContain(drawn.label);
        history.push(drawn.label);
        currentCycle.push(drawn.label);
        // A page reload retains exactly the same progress through the deck.
        deck = restoreWanderLabelDeck(JSON.stringify({ version: 1, ...drawn.deck }))!;
        expect(deck).toEqual(drawn.deck);
      }
      expect(new Set(currentCycle).size).toBe(120);
      expect(deck.remaining).toHaveLength(0);
      expect(deck.recent).toHaveLength(WANDER_LABEL_RECENT_LIMIT);
    }
  });

  it("оставляет случайности выбор и не мутирует переданное состояние", () => {
    const deck: WanderLabelDeck = { remaining: [], recent: [] };
    expect(drawWanderLabel(deck, () => 0).label).not.toBe(drawWanderLabel(deck, () => 0.99).label);
    expect(deck).toEqual({ remaining: [], recent: [] });
  });

  it.each([null, "broken", "null", "{}", "x".repeat(16_001), '{"version":2,"remaining":[],"recent":[]}'])
  ("игнорирует повреждённую историю %s", (raw) => {
    expect(restoreWanderLabelDeck(raw)).toBeNull();
  });

  it("фильтрует незнакомые строки и дубликаты", () => {
    expect(restoreWanderLabelDeck(JSON.stringify({ version: 1, remaining: ["шмыг", "шмыг", 7, "купить"], recent: [null, "прыг"] })))
      .toEqual({ remaining: ["шмыг"], recent: ["прыг"] });
    expect(drawWanderLabel({ remaining: ["шмыг"], recent: ["шмыг"] }).label).toBe("шмыг");
  });
});
