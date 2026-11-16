import { THEME_CSS } from "./theme.css";

export function browseHtml(nonce: string, cspSource: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Flashcard Browse</title>
<style>
${THEME_CSS}
.card {
  border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: var(--vscode-editor-background);
}
.card .section {
  font-size: 12px;
  margin-bottom: 4px;
}
.card .q {
  font-weight: 600;
  margin: 2px 0 8px;
  white-space: pre-wrap;
}
.card .a {
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  color: var(--vscode-descriptionForeground);
}
.card .a summary {
  cursor: pointer;
  color: var(--vscode-textLink-foreground);
  margin-bottom: 4px;
}
.card .tags { margin-top: 8px; }
.card .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.card .actions button {
  font-size: 12px;
  padding: 3px 8px;
}
.section-header {
  font-weight: 600;
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
}
.section-header:first-child { margin-top: 4px; }
</style>
</head>
<body>
  <div class="top">
    <select id="section" title="Filter by section"></select>
    <input class="search" id="search" type="search" placeholder="Search question, answer, tags…"/>
    <span class="count" id="count"></span>
    <div class="actions">
      <button type="button" class="secondary" id="expandAll">Expand answers</button>
      <button type="button" class="secondary" id="collapseAll">Collapse</button>
    </div>
  </div>
  <div class="body" id="list"></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let state = { title: '', cards: [], sections: [], query: '', sectionId: '', expandAll: false };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function matches(card, q) {
  if (!q) return true;
  const hay = [card.q, card.a, card.sectionName, ...(card.tags || [])].join('\\n').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function updateCount(total, shown, querying) {
  const el = document.getElementById('count');
  el.textContent = querying
    ? shown + ' of ' + total + ' cards'
    : total + ' card' + (total === 1 ? '' : 's');
}

function updateSectionSelect() {
  const sel = document.getElementById('section');
  const cur = state.sectionId;
  sel.innerHTML = '<option value="">All sections</option>' +
    state.sections.map(s => '<option value="'+esc(s.id)+'">'+esc(s.name)+' ('+s.count+')</option>').join('');
  sel.value = cur;
  if (sel.value !== cur) state.sectionId = '';
}

function filtered() {
  let cards = state.cards;
  if (state.sectionId) cards = cards.filter(c => c.sectionId === state.sectionId);
  return cards.filter(c => matches(c, state.query.trim()));
}

function render() {
  const list = document.getElementById('list');
  const q = state.query.trim();
  const all = state.sectionId
    ? state.cards.filter(c => c.sectionId === state.sectionId)
    : state.cards;
  const cards = filtered();
  updateCount(all.length, cards.length, !!q || !!state.sectionId);

  if (!cards.length) {
    list.innerHTML = '<div class="empty">No cards match.</div>';
    return;
  }

  let html = '';
  let lastSection = null;
  for (const c of cards) {
    if (c.sectionId !== lastSection) {
      lastSection = c.sectionId;
      html += '<div class="section-header">'+esc(c.sectionName)+'</div>';
    }
    const tags = (c.tags || []).map(t => '<span class="badge">'+esc(t)+'</span>').join('');
    const open = state.expandAll ? ' open' : '';
    html += '<div class="card" data-id="'+esc(c.id)+'">'+
      '<div class="section muted">'+esc(c.id)+'</div>'+
      '<div class="q">'+esc(c.q)+'</div>'+
      '<details class="a"'+open+'><summary>Answer</summary><div>'+esc(c.a)+'</div></details>'+
      (tags ? '<div class="tags">'+tags+'</div>' : '')+
      '<div class="actions">'+
        '<button type="button" class="secondary" data-copy="qa" data-id="'+esc(c.id)+'">Copy Q/A</button>'+
        '<button type="button" class="secondary" data-study="1" data-id="'+esc(c.id)+'">Study</button>'+
      '</div></div>';
  }
  list.innerHTML = html;
}

document.getElementById('section').addEventListener('change', (ev) => {
  state.sectionId = ev.target.value;
  render();
});
document.getElementById('search').addEventListener('input', (ev) => {
  state.query = ev.target.value;
  render();
});
document.getElementById('expandAll').addEventListener('click', () => {
  state.expandAll = true;
  render();
});
document.getElementById('collapseAll').addEventListener('click', () => {
  state.expandAll = false;
  render();
});

document.getElementById('list').addEventListener('click', (ev) => {
  const copyBtn = ev.target.closest('[data-copy]');
  if (copyBtn) {
    ev.preventDefault();
    vscode.postMessage({ type: 'copy', kind: copyBtn.getAttribute('data-copy'), id: copyBtn.getAttribute('data-id') });
    return;
  }
  const studyBtn = ev.target.closest('[data-study]');
  if (studyBtn) {
    ev.preventDefault();
    vscode.postMessage({ type: 'openStudy', id: studyBtn.getAttribute('data-id') });
  }
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === '/' && ev.target.tagName !== 'INPUT') {
    ev.preventDefault();
    document.getElementById('search').focus();
  }
});

window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (msg.type === 'setState') {
    state.title = msg.title || '';
    state.cards = msg.cards || [];
    state.sections = msg.sections || [];
    updateSectionSelect();
    render();
  }
});

vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
