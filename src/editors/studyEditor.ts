import * as vscode from "vscode";
import { parseDeckWithErrors } from "../cards/parse";
import { flattenDeck } from "../cards/types";
import { validateDeck } from "../cards/validate";
import { studyHtml } from "../webview/study.html";

export const STUDY_VIEW_TYPE = "flashcardEditor.study";

export class FlashStudyEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      STUDY_VIEW_TYPE,
      new FlashStudyEditorProvider(context),
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
    webviewPanel.webview.html = studyHtml(nonce, webviewPanel.webview.cspSource);

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

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        postState();
      }
    });
    webviewPanel.onDidDispose(() => changeSub.dispose());

    webviewPanel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "ready") {
        postState();
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
