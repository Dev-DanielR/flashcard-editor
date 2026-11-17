import { Card, Deck, Section } from "./types";

function cardJson(card: Card): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: card.id,
    q: card.q,
    a: card.a,
  };
  if (card.tags?.length) {
    o.tags = card.tags;
  }
  return o;
}

function sectionJson(section: Section): Record<string, unknown> {
  return {
    id: section.id,
    name: section.name,
    cards: section.cards.map(cardJson),
  };
}

/** Pretty-print a deck as .flashcard JSON (2-space indent, trailing newline). */
export function serializeDeck(deck: Deck): string {
  const o: Record<string, unknown> = {
    title: deck.title,
  };
  if (deck.description) {
    o.description = deck.description;
  }
  o.sections = deck.sections.map(sectionJson);
  return `${JSON.stringify(o, null, 2)}\n`;
}
