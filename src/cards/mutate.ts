import { Card, Deck, Section } from "./types";

/** Clone a deck (shallow sections/cards replaced by callers as needed). */
export function cloneDeck(deck: Deck): Deck {
  return {
    title: deck.title,
    description: deck.description,
    sections: deck.sections.map((s) => ({
      id: s.id,
      name: s.name,
      cards: s.cards.map((c) => ({
        id: c.id,
        q: c.q,
        a: c.a,
        tags: c.tags ? [...c.tags] : undefined,
      })),
    })),
  };
}

/** Stable-ish id from a label; falls back to random suffix. */
export function slugId(label: string, prefix: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const core = base || prefix;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${core}-${suffix}`;
}

function allIds(deck: Deck): Set<string> {
  const ids = new Set<string>();
  for (const s of deck.sections) {
    ids.add(s.id);
    for (const c of s.cards) {
      ids.add(c.id);
    }
  }
  return ids;
}

function uniqueId(deck: Deck, label: string, prefix: string): string {
  const used = allIds(deck);
  let id = slugId(label, prefix);
  while (used.has(id)) {
    id = slugId(label, prefix);
  }
  return id;
}

export function updateDeckMeta(
  deck: Deck,
  meta: { title: string; description?: string }
): Deck {
  const next = cloneDeck(deck);
  next.title = meta.title.trim() || "Untitled deck";
  const desc = meta.description?.trim();
  if (desc) {
    next.description = desc;
  } else {
    delete next.description;
  }
  return next;
}

export function addSection(deck: Deck, name: string): { deck: Deck; sectionId: string } {
  const next = cloneDeck(deck);
  const trimmed = name.trim() || "New section";
  const id = uniqueId(next, trimmed, "section");
  next.sections.push({ id, name: trimmed, cards: [] });
  return { deck: next, sectionId: id };
}

export function renameSection(deck: Deck, sectionId: string, name: string): Deck | undefined {
  const next = cloneDeck(deck);
  const section = next.sections.find((s) => s.id === sectionId);
  if (!section) {
    return undefined;
  }
  section.name = name.trim() || section.name;
  return next;
}

export function deleteSection(deck: Deck, sectionId: string): Deck | undefined {
  const next = cloneDeck(deck);
  const idx = next.sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) {
    return undefined;
  }
  next.sections.splice(idx, 1);
  return next;
}

function ensureSection(deck: Deck, sectionId?: string): Section {
  if (sectionId) {
    const found = deck.sections.find((s) => s.id === sectionId);
    if (found) {
      return found;
    }
  }
  if (deck.sections.length === 0) {
    const id = uniqueId(deck, "general", "section");
    const section: Section = { id, name: "General", cards: [] };
    deck.sections.push(section);
    return section;
  }
  return deck.sections[0];
}

function normalizeTags(tags: string[] | string | undefined): string[] | undefined {
  let list: string[];
  if (typeof tags === "string") {
    list = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  } else if (Array.isArray(tags)) {
    list = tags.map((t) => String(t).trim()).filter(Boolean);
  } else {
    return undefined;
  }
  return list.length ? list : undefined;
}

export interface CardInput {
  q: string;
  a: string;
  tags?: string[] | string;
  sectionId?: string;
}

/** Update an existing card (optionally move section). */
export function updateCard(deck: Deck, cardId: string, input: CardInput): Deck | undefined {
  const next = cloneDeck(deck);
  let card: Card | undefined;
  let from: Section | undefined;
  for (const section of next.sections) {
    const idx = section.cards.findIndex((c) => c.id === cardId);
    if (idx >= 0) {
      card = section.cards[idx];
      from = section;
      section.cards.splice(idx, 1);
      break;
    }
  }
  if (!card || !from) {
    return undefined;
  }
  card.q = input.q;
  card.a = input.a;
  const tags = normalizeTags(input.tags);
  if (tags) {
    card.tags = tags;
  } else {
    delete card.tags;
  }
  const target = ensureSection(next, input.sectionId ?? from.id);
  target.cards.push(card);
  return next;
}

/** Add a new card; creates General section if needed. */
export function addCard(deck: Deck, input: CardInput): { deck: Deck; cardId: string } {
  const next = cloneDeck(deck);
  const target = ensureSection(next, input.sectionId);
  const id = uniqueId(next, input.q || "card", "card");
  const card: Card = { id, q: input.q, a: input.a };
  const tags = normalizeTags(input.tags);
  if (tags) {
    card.tags = tags;
  }
  target.cards.push(card);
  return { deck: next, cardId: id };
}

export function deleteCard(deck: Deck, cardId: string): Deck | undefined {
  const next = cloneDeck(deck);
  for (const section of next.sections) {
    const idx = section.cards.findIndex((c) => c.id === cardId);
    if (idx >= 0) {
      section.cards.splice(idx, 1);
      return next;
    }
  }
  return undefined;
}
