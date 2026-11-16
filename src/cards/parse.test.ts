import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
