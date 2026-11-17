import * as vscode from "vscode";
import { FlashBrowseEditorProvider, BROWSE_VIEW_TYPE } from "./editors/browseEditor";
import { FlashStudyEditorProvider, STUDY_VIEW_TYPE } from "./editors/studyEditor";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(FlashStudyEditorProvider.register(context));
  context.subscriptions.push(FlashBrowseEditorProvider.register(context));

  context.subscriptions.push(
    vscode.commands.registerCommand("flashcardEditor.openStudy", async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        vscode.window.showWarningMessage("Open a .flashcard file first.");
        return;
      }
      await vscode.commands.executeCommand("vscode.openWith", target, STUDY_VIEW_TYPE);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flashcardEditor.openBrowse", async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        vscode.window.showWarningMessage("Open a .flashcard file first.");
        return;
      }
      await vscode.commands.executeCommand("vscode.openWith", target, BROWSE_VIEW_TYPE);
    })
  );
}

export function deactivate(): void {}
