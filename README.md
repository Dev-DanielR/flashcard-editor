# Flashcard Editor

VS Code / VSCodium custom editors for `*.cards` flashcard decks:

- **Flashcard Study** — flip through cards (default when opening `.cards`)
- **Flashcard Browse** — searchable Q/A list
- **Text Editor** — edit the JSON directly

Use **View: Reopen Editor With…** on a `.cards` file to switch modes.

## File format

`.cards` is pretty-printed JSON:

```json
{
  "title": "Demo deck",
  "description": "Optional blurb",
  "sections": [
    {
      "id": "basics",
      "name": "Basics",
      "cards": [
        { "id": "b1", "q": "What is 2+2?", "a": "4", "tags": ["math"] }
      ]
    }
  ]
}
```

- `id` values should be unique across the deck.
- `tags` is optional.
- Answers may contain newlines (JSON strings).

## Study shortcuts

- `Space` / click — flip
- `←` `→` — previous / next
- `K` — toggle known (session only)
- `/` — focus search

Top bar: section filter, search, shuffle, reset order.

## Browse

Search and filter by section. Expand/collapse answers. **Copy Q/A** or jump to **Study**.

## Install

```bash
npm install
npm run package
codium --install-extension dist/flash-editor-0.1.0.vsix --force
```

Or `code --install-extension …`. Then **Developer: Reload Window** and open a `.cards` file.

## Develop

```bash
npm install
npm run compile
npm test
```

Press F5 in this folder to run the Extension Development Host.

## License

MIT
