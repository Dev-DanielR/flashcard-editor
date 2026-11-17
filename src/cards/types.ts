/** One Q/A flashcard. */
export interface Card {
  id: string;
  q: string;
  a: string;
  tags?: string[];
}

/** Named group of cards. */
export interface Section {
  id: string;
  name: string;
  cards: Card[];
}

/** Root .flashcard deck document. */
export interface Deck {
  title: string;
  description?: string;
  sections: Section[];
}

/** Flat card with section context for study/browse. */
export interface FlatCard {
  id: string;
  q: string;
  a: string;
  tags: string[];
  sectionId: string;
  sectionName: string;
}

export function flattenDeck(deck: Deck): FlatCard[] {
  const out: FlatCard[] = [];
  for (const section of deck.sections) {
    for (const card of section.cards) {
      out.push({
        id: card.id,
        q: card.q,
        a: card.a,
        tags: card.tags ?? [],
        sectionId: section.id,
        sectionName: section.name,
      });
    }
  }
  return out;
}

export function emptyDeck(): Deck {
  return { title: "Untitled deck", sections: [] };
}
