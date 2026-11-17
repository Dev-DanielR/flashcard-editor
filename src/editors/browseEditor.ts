import * as vscode from "vscode";
import {
  addCard,
  addSection,
  deleteCard,
  deleteSection,
  renameSection,
  updateCard,
  updateDeckMeta,
} from "../cards/mutate";
import { parseDeckWithErrors } from "../cards/parse";
import { serializeDeck } from "../cards/serialize";
import { Deck, flattenDeck } from "../cards/types";
import { validateDeck } from "../cards/validate";
import { browseHtml } from "../webview/browse.html";
import { STUDY_VIEW_TYPE } from "./studyEditor";

export const BROWSE_VIEW_TYPE = "flashcardEditor.browse";

export class FlashBrowseEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      BROWSE_VIEW_TYPE,
      new FlashBrowseEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    );
  }

  private constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    const nonce = getNonce();
    webviewPanel.webview.html = browseHtml(nonce, webviewPanel.webview.cspSource);

    let lastErrorSig = "";

    const reportErrors = (errors: { error: string }[]) => {
      if (!errors.length) {
        lastErrorSig = "";
        return;
      }
      const sig = errors.map((e) => e.error).join("|");
      if (sig === lastErrorSig) {
        return;
      }
      lastErrorSig = sig;
      const head = errors[0].error;
      const more = errors.length > 1 ? ` (+${errors.length - 1} more)` : "";
      void vscode.window.showWarningMessage(`Flashcard parse: ${head}${more}`);
    };

    const postState = () => {
      const { deck, errors } = parseDeckWithErrors(document.getText());
      reportErrors(errors);
      const v = validateDeck(deck);
      if (v.duplicateIds.length) {
        void vscode.window.setStatusBarMessage(
          `Duplicate card ids: ${v.duplicateIds.join(", ")}`,
          4000
        );
      }
      const cards = flattenDeck(deck);
      const sections = deck.sections.map((s) => ({
        id: s.id,
        name: s.name,
        count: s.cards.length,
      }));
      webviewPanel.webview.postMessage({
        type: "setState",
        title: deck.title,
        description: deck.description ?? "",
        cards,
        sections,
      });
    };

    const writeDeck = async (deck: Deck): Promise<boolean> => {
      const text = serializeDeck(deck);
      const full = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, full, text);
      return vscode.workspace.applyEdit(edit);
    };

    const withDeck = async (fn: (deck: Deck) => Deck | undefined | { deck: Deck }): Promise<void> => {
      const { deck, errors } = parseDeckWithErrors(document.getText());
      if (errors.some((e) => e.error.startsWith("Invalid JSON"))) {
        void vscode.window.showErrorMessage("Fix invalid JSON before editing in Browse.");
        return;
      }
      const result = fn(deck);
      if (!result) {
        void vscode.window.showWarningMessage("Could not apply edit (item missing).");
        return;
      }
      const next = "deck" in result ? result.deck : result;
      await writeDeck(next);
    };

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        postState();
      }
    });
    webviewPanel.onDidDispose(() => changeSub.dispose());

    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "ready") {
        postState();
        return;
      }
      if (msg.type === "openStudy") {
        await vscode.commands.executeCommand("vscode.openWith", document.uri, STUDY_VIEW_TYPE);
        return;
      }
      if (msg.type === "copy" && typeof msg.id === "string") {
        const { deck } = parseDeckWithErrors(document.getText());
        const card = flattenDeck(deck).find((c) => c.id === msg.id);
        if (!card) {
          return;
        }
        await vscode.env.clipboard.writeText(`Q: ${card.q}\nA: ${card.a}`);
        void vscode.window.setStatusBarMessage(`Copied ${card.id}`, 2000);
        return;
      }
      if (msg.type === "updateMeta") {
        await withDeck((deck) =>
          updateDeckMeta(deck, {
            title: String(msg.title ?? ""),
            description: String(msg.description ?? ""),
          })
        );
        return;
      }
      if (msg.type === "addSection") {
        const name = await vscode.window.showInputBox({
          title: "Add section",
          prompt: "Section name",
          value: "New section",
          ignoreFocusOut: true,
        });
        if (name === undefined) {
          return;
        }
        await withDeck((deck) => addSection(deck, name));
        return;
      }
      if (msg.type === "renameSection" && typeof msg.id === "string") {
        await withDeck((deck) => renameSection(deck, msg.id, String(msg.name ?? "")));
        return;
      }
      if (msg.type === "deleteSection" && typeof msg.id === "string") {
        const label = typeof msg.name === "string" && msg.name ? msg.name : msg.id;
        const pick = await vscode.window.showWarningMessage(
          `Delete section "${label}" and all of its cards?`,
          { modal: true },
          "Delete"
        );
        if (pick !== "Delete") {
          return;
        }
        await withDeck((deck) => deleteSection(deck, msg.id));
        return;
      }
      if (msg.type === "addCard") {
        await withDeck((deck) =>
          addCard(deck, {
            q: String(msg.q ?? ""),
            a: String(msg.a ?? ""),
            tags: msg.tags,
            sectionId: typeof msg.sectionId === "string" ? msg.sectionId : undefined,
          })
        );
        return;
      }
      if (msg.type === "updateCard" && typeof msg.id === "string") {
        await withDeck((deck) =>
          updateCard(deck, msg.id, {
            q: String(msg.q ?? ""),
            a: String(msg.a ?? ""),
            tags: msg.tags,
            sectionId: typeof msg.sectionId === "string" ? msg.sectionId : undefined,
          })
        );
        return;
      }
      if (msg.type === "deleteCard" && typeof msg.id === "string") {
        const pick = await vscode.window.showWarningMessage(
          `Delete card ${msg.id}?`,
          { modal: true },
          "Delete"
        );
        if (pick !== "Delete") {
          return;
        }
        await withDeck((deck) => deleteCard(deck, msg.id));
      }
    });
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
