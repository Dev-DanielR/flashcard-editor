import * as vscode from "vscode";
import { parseDeckWithErrors } from "../cards/parse";
import { flattenDeck } from "../cards/types";
import { validateDeck } from "../cards/validate";
import { browseHtml } from "../webview/browse.html";
import { STUDY_VIEW_TYPE } from "./studyEditor";

export const BROWSE_VIEW_TYPE = "flashEditor.browse";

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
      void vscode.window.showWarningMessage(`Flashcards parse: ${head}${more}`);
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

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        postState();
      }
    });
    webviewPanel.onDidDispose(() => changeSub.dispose());

    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "ready") {
        postState();
      } else if (msg.type === "openStudy") {
        await vscode.commands.executeCommand("vscode.openWith", document.uri, STUDY_VIEW_TYPE);
      } else if (msg.type === "copy" && typeof msg.id === "string") {
        const { deck } = parseDeckWithErrors(document.getText());
        const card = flattenDeck(deck).find((c) => c.id === msg.id);
        if (!card) {
          return;
        }
        const text = `Q: ${card.q}\nA: ${card.a}`;
        await vscode.env.clipboard.writeText(text);
        void vscode.window.setStatusBarMessage(`Copied ${card.id}`, 2000);
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
