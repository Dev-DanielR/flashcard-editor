import { Deck, flattenDeck } from "./types";

export interface ValidateResult {
  ok: boolean;
  duplicateIds: string[];
  emptyQuestions: number;
  emptyAnswers: number;
  cardCount: number;
}

export function validateDeck(deck: Deck): ValidateResult {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  let emptyQuestions = 0;
  let emptyAnswers = 0;

  const flat = flattenDeck(deck);
  for (const card of flat) {
    if (seen.has(card.id)) {
      if (!duplicateIds.includes(card.id)) {
        duplicateIds.push(card.id);
      }
    } else {
      seen.add(card.id);
    }
    if (!card.q.trim()) {
      emptyQuestions += 1;
    }
    if (!card.a.trim()) {
      emptyAnswers += 1;
    }
  }

  return {
    ok: duplicateIds.length === 0 && emptyQuestions === 0,
    duplicateIds,
    emptyQuestions,
    emptyAnswers,
    cardCount: flat.length,
  };
}
