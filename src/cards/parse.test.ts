import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCard,
  addSection,
  deleteCard,
  deleteSection,
  renameSection,
  updateCard,
  updateDeckMeta,
} from "./mutate";
import { parseDeckWithErrors } from "./parse";
import { serializeDeck } from "./serialize";
import { validateDeck } from "./validate";
import { flattenDeck } from "./types";

const sample = `{
  "title": "Demo",
  "description": "A tiny deck",
  "sections": [
    {
      "id": "basics",
      "name": "Basics",
      "cards": [
        { "id": "b1", "q": "What is 2+2?", "a": "4", "tags": ["math"] },
        { "id": "b2", "q": "Capital of France?", "a": "Paris" }
      ]
    }
  ]
}
`;

describe("parseDeckWithErrors", () => {
  it("parses a valid deck", () => {
    const { deck, errors } = parseDeckWithErrors(sample);
    assert.equal(errors.length, 0);
    assert.equal(deck.title, "Demo");
    assert.equal(deck.sections.length, 1);
    assert.equal(flattenDeck(deck).length, 2);
  });

  it("reports invalid JSON", () => {
    const { errors } = parseDeckWithErrors("{ nope");
    assert.ok(errors.length >= 1);
    assert.match(errors[0].error, /Invalid JSON/);
  });

  it("round-trips through serialize", () => {
    const { deck } = parseDeckWithErrors(sample);
    const again = parseDeckWithErrors(serializeDeck(deck));
    assert.equal(again.errors.length, 0);
    assert.deepEqual(again.deck, deck);
  });
});

describe("validateDeck", () => {
  it("flags duplicate ids", () => {
    const { deck } = parseDeckWithErrors(`{
      "title": "Dup",
      "sections": [{
        "id": "s",
        "name": "S",
        "cards": [
          { "id": "x", "q": "Q1", "a": "A1" },
          { "id": "x", "q": "Q2", "a": "A2" }
        ]
      }]
    }`);
    const v = validateDeck(deck);
    assert.equal(v.ok, false);
    assert.deepEqual(v.duplicateIds, ["x"]);
  });
});

describe("mutate", () => {
  function sampleDeck() {
    return parseDeckWithErrors(sample).deck;
  }

  it("updates deck meta", () => {
    const next = updateDeckMeta(sampleDeck(), { title: "  New  ", description: "  " });
    assert.equal(next.title, "New");
    assert.equal(next.description, undefined);
  });

  it("adds and renames sections", () => {
    const { deck, sectionId } = addSection(sampleDeck(), "Defense");
    assert.ok(deck.sections.some((s) => s.id === sectionId));
    const renamed = renameSection(deck, sectionId, "Defense traps");
    assert.equal(renamed?.sections.find((s) => s.id === sectionId)?.name, "Defense traps");
  });

  it("adds updates and deletes cards", () => {
    let deck = sampleDeck();
    const added = addCard(deck, { q: "Q?", a: "A", tags: "x, y", sectionId: "basics" });
    deck = added.deck;
    assert.ok(flattenDeck(deck).some((c) => c.id === added.cardId));

    const updated = updateCard(deck, added.cardId, {
      q: "Q2?",
      a: "A2",
      tags: [],
      sectionId: "basics",
    });
    assert.ok(updated);
    const card = flattenDeck(updated).find((c) => c.id === added.cardId);
    assert.equal(card?.q, "Q2?");
    assert.deepEqual(card?.tags, []);

    const deleted = deleteCard(updated, added.cardId);
    assert.ok(deleted);
    assert.equal(flattenDeck(deleted).some((c) => c.id === added.cardId), false);
  });

  it("deletes a section and its cards", () => {
    const next = deleteSection(sampleDeck(), "basics");
    assert.ok(next);
    assert.equal(next.sections.length, 0);
    assert.equal(flattenDeck(next).length, 0);
  });

  it("creates General when adding a card to an empty deck", () => {
    const { deck } = addCard(
      { title: "Empty", sections: [] },
      { q: "Q", a: "A" }
    );
    assert.equal(deck.sections.length, 1);
    assert.equal(deck.sections[0].name, "General");
    assert.equal(deck.sections[0].cards.length, 1);
  });
});
