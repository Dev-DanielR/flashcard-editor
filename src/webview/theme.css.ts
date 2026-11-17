/** Shared VS Code theme-token stylesheet for flash webviews. */
export const THEME_CSS = `
:root {
  color-scheme: light dark;
}
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  font-weight: var(--vscode-font-weight);
}
body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
* { box-sizing: border-box; }
button, input, select, textarea {
  font: inherit;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
  border-radius: 2px;
}
button {
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  border: 1px solid transparent;
  padding: 4px 10px;
  cursor: pointer;
}
button:hover { background: var(--vscode-button-hoverBackground); }
button.secondary {
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
}
button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
button:disabled {
  opacity: 0.5;
  cursor: default;
}
input[type="search"], input[type="text"], textarea, select {
  padding: 4px 8px;
  outline: none;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--vscode-focusBorder);
  outline: 1px solid var(--vscode-focusBorder);
}
.top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
  background: var(--vscode-sideBar-background, var(--vscode-editor-background));
  flex: 0 0 auto;
  z-index: 2;
}
.top .search {
  flex: 1 1 180px;
  min-width: 120px;
}
.top .count {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
.top .actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 8px 12px 24px;
  overflow: auto;
}
.muted { color: var(--vscode-descriptionForeground); }
.empty { padding: 24px 8px; color: var(--vscode-descriptionForeground); }
.badge {
  display: inline-block;
  margin-left: 8px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 18px;
  color: var(--vscode-descriptionForeground);
  background: var(--vscode-badge-background, transparent);
  border: 1px solid var(--vscode-widget-border, transparent);
}
`;
