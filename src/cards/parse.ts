import { Card, Deck, Section, emptyDeck } from "./types";

export interface ParseError {
  error: string;
}

export interface ParseResult {
  deck: Deck;
  errors: ParseError[];
}

function asString(v: unknown, field: string, errors: ParseError[]): string {
  if (typeof v === "string") {
    return v;
  }
  errors.push({ error: `${field} must be a string` });
  return "";
}

function asOptionalString(v: unknown, field: string, errors: ParseError[]): string | undefined {
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v === "string") {
    return v;
  }
  errors.push({ error: `${field} must be a string when present` });
  return undefined;
}

function asTags(v: unknown, field: string, errors: ParseError[]): string[] | undefined {
  if (v === undefined || v === null) {
    return undefined;
  }
  if (!Array.isArray(v)) {
    errors.push({ error: `${field} must be an array of strings` });
    return undefined;
  }
  const tags: string[] = [];
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "string") {
      errors.push({ error: `${field}[${i}] must be a string` });
      continue;
    }
    tags.push(v[i] as string);
  }
  return tags;
}

function parseCard(raw: unknown, path: string, errors: ParseError[]): Card | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push({ error: `${path} must be an object` });
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const id = asString(o.id, `${path}.id`, errors);
  const q = asString(o.q, `${path}.q`, errors);
  const a = asString(o.a, `${path}.a`, errors);
  const tags = asTags(o.tags, `${path}.tags`, errors);
  if (!id || !q) {
    return undefined;
  }
  const card: Card = { id, q, a };
  if (tags?.length) {
    card.tags = tags;
  }
  return card;
}

function parseSection(raw: unknown, path: string, errors: ParseError[]): Section | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push({ error: `${path} must be an object` });
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const id = asString(o.id, `${path}.id`, errors);
  const name = asString(o.name, `${path}.name`, errors);
  if (!Array.isArray(o.cards)) {
    errors.push({ error: `${path}.cards must be an array` });
    return undefined;
  }
  const cards: Card[] = [];
  for (let i = 0; i < o.cards.length; i++) {
    const card = parseCard(o.cards[i], `${path}.cards[${i}]`, errors);
    if (card) {
      cards.push(card);
    }
  }
  if (!id || !name) {
    return undefined;
  }
  return { id, name, cards };
}

/** Parse a .flashcard JSON document. Returns a deck plus soft errors. */
export function parseDeckWithErrors(text: string): ParseResult {
  const errors: ParseError[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return { deck: emptyDeck(), errors: [{ error: "Empty document" }] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { deck: emptyDeck(), errors: [{ error: `Invalid JSON: ${msg}` }] };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { deck: emptyDeck(), errors: [{ error: "Root must be a JSON object" }] };
  }

  const o = raw as Record<string, unknown>;
  const title = asString(o.title, "title", errors) || "Untitled deck";
  const description = asOptionalString(o.description, "description", errors);

  if (!Array.isArray(o.sections)) {
    errors.push({ error: "sections must be an array" });
    return { deck: { title, description, sections: [] }, errors };
  }

  const sections: Section[] = [];
  for (let i = 0; i < o.sections.length; i++) {
    const section = parseSection(o.sections[i], `sections[${i}]`, errors);
    if (section) {
      sections.push(section);
    }
  }

  const deck: Deck = { title, sections };
  if (description !== undefined) {
    deck.description = description;
  }
  return { deck, errors };
}

export function parseDeck(text: string): Deck {
  return parseDeckWithErrors(text).deck;
}
