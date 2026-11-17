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
.meta {
  flex: 0 0 auto;
  padding: 12px 12px 0;
}
.meta-view h1 {
  margin: 0 0 4px;
  font-size: 1.25rem;
  font-weight: 600;
}
.meta-view .desc {
  margin: 0 0 8px;
  white-space: pre-wrap;
}
.meta-edit {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}
.meta-edit label, .form label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
.meta-edit input, .meta-edit textarea,
.form input, .form textarea, .form select {
  width: 100%;
}
.meta-edit textarea { min-height: 56px; resize: vertical; }
.form textarea { min-height: 72px; resize: vertical; }
.form {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
.form .row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
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
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-weight: 600;
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
}
.section-header:first-child { margin-top: 4px; }
.section-header .name { flex: 1 1 auto; }
.section-header .sec-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.section-header input[type="text"] {
  flex: 1 1 160px;
  font-weight: 600;
}
.danger {
  color: var(--vscode-errorForeground, #f14c4c) !important;
}
.new-card {
  border-style: dashed;
}
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
      <button type="button" class="secondary" id="addSection">Add section</button>
      <button type="button" id="addCard">Add card</button>
    </div>
  </div>
  <div class="meta" id="meta"></div>
  <div class="body" id="list"></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const NEW_ID = '__new__';
let state = {
  title: '',
  description: '',
  cards: [],
  sections: [],
  query: '',
  sectionId: '',
  expandAll: false,
  editingId: null,
  editingMeta: false,
  renamingSectionId: null,
};

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

function sectionOptions(selectedId) {
  if (!state.sections.length) {
    return '<option value="">General (new)</option>';
  }
  return state.sections.map(s =>
    '<option value="'+esc(s.id)+'"'+(s.id === selectedId ? ' selected' : '')+'>'+esc(s.name)+'</option>'
  ).join('');
}

function cardForm(card) {
  const isNew = !card;
  const id = isNew ? NEW_ID : card.id;
  const q = isNew ? '' : card.q;
  const a = isNew ? '' : card.a;
  const tags = isNew ? '' : (card.tags || []).join(', ');
  const sectionId = isNew ? (state.sectionId || (state.sections[0] && state.sections[0].id) || '') : card.sectionId;
  return '<div class="card'+(isNew ? ' new-card' : '')+'" data-id="'+esc(id)+'">'+
    '<div class="section muted">'+(isNew ? 'New card' : esc(id))+'</div>'+
    '<div class="form" data-form="card" data-id="'+esc(id)+'">'+
      '<label>Question<textarea name="q" rows="2">'+esc(q)+'</textarea></label>'+
      '<label>Answer<textarea name="a" rows="3">'+esc(a)+'</textarea></label>'+
      '<label>Tags (comma-separated)<input name="tags" type="text" value="'+esc(tags)+'"/></label>'+
      '<label>Section<select name="sectionId">'+sectionOptions(sectionId)+'</select></label>'+
      '<div class="row">'+
        '<button type="button" data-save-card="1">Save</button>'+
        '<button type="button" class="secondary" data-cancel-edit="1">Cancel</button>'+
      '</div>'+
    '</div></div>';
}

function renderMeta() {
  const el = document.getElementById('meta');
  if (state.editingMeta) {
    el.innerHTML = '<div class="meta-edit" data-form="meta">'+
      '<label>Title<input name="title" type="text" value="'+esc(state.title)+'"/></label>'+
      '<label>Description<textarea name="description" rows="2">'+esc(state.description)+'</textarea></label>'+
      '<div class="row">'+
        '<button type="button" data-save-meta="1">Save deck</button>'+
        '<button type="button" class="secondary" data-cancel-meta="1">Cancel</button>'+
      '</div></div>';
    return;
  }
  const desc = state.description
    ? '<p class="desc muted">'+esc(state.description)+'</p>'
    : '<p class="desc muted">No description</p>';
  el.innerHTML = '<div class="meta-view">'+
    '<h1>'+esc(state.title || 'Untitled deck')+'</h1>'+desc+
    '<div class="row"><button type="button" class="secondary" data-edit-meta="1">Edit deck</button></div>'+
    '</div>';
}

function filtered() {
  let cards = state.cards;
  if (state.sectionId) cards = cards.filter(c => c.sectionId === state.sectionId);
  return cards.filter(c => matches(c, state.query.trim()));
}

function sectionHeaderHtml(section) {
  if (state.renamingSectionId === section.id) {
    return '<div class="section-header" data-section="'+esc(section.id)+'">'+
      '<input type="text" name="sectionName" value="'+esc(section.name)+'"/>'+
      '<div class="sec-actions">'+
        '<button type="button" data-save-section="'+esc(section.id)+'">Save</button>'+
        '<button type="button" class="secondary" data-cancel-section="1">Cancel</button>'+
      '</div></div>';
  }
  return '<div class="section-header" data-section="'+esc(section.id)+'">'+
    '<span class="name">'+esc(section.name)+'</span>'+
    '<div class="sec-actions">'+
      '<button type="button" class="secondary" data-rename-section="'+esc(section.id)+'">Rename</button>'+
      '<button type="button" class="secondary danger" data-delete-section="'+esc(section.id)+'" data-name="'+esc(section.name)+'">Delete section</button>'+
    '</div></div>';
}

function render() {
  renderMeta();
  const list = document.getElementById('list');
  const q = state.query.trim();
  const all = state.sectionId
    ? state.cards.filter(c => c.sectionId === state.sectionId)
    : state.cards;
  const cards = filtered();
  updateCount(all.length, cards.length, !!q || !!state.sectionId);

  let html = '';
  if (state.editingId === NEW_ID) {
    html += cardForm(null);
  }

  const visibleSections = state.sectionId
    ? state.sections.filter(s => s.id === state.sectionId)
    : state.sections.slice();
  const shownSectionIds = new Set();

  let lastSection = null;
  for (const c of cards) {
    if (c.sectionId !== lastSection) {
      lastSection = c.sectionId;
      shownSectionIds.add(c.sectionId);
      const sec = state.sections.find(s => s.id === c.sectionId) || {
        id: c.sectionId,
        name: c.sectionName,
        count: 0,
      };
      html += sectionHeaderHtml(sec);
    }
    if (state.editingId === c.id) {
      html += cardForm(c);
      continue;
    }
    const tags = (c.tags || []).map(t => '<span class="badge">'+esc(t)+'</span>').join('');
    const open = state.expandAll ? ' open' : '';
    html += '<div class="card" data-id="'+esc(c.id)+'">'+
      '<div class="section muted">'+esc(c.id)+'</div>'+
      '<div class="q">'+esc(c.q)+'</div>'+
      '<details class="a"'+open+'><summary>Answer</summary><div>'+esc(c.a)+'</div></details>'+
      (tags ? '<div class="tags">'+tags+'</div>' : '')+
      '<div class="actions">'+
        '<button type="button" class="secondary" data-edit="'+esc(c.id)+'">Edit</button>'+
        '<button type="button" class="secondary" data-copy="qa" data-id="'+esc(c.id)+'">Copy Q/A</button>'+
        '<button type="button" class="secondary" data-study="1" data-id="'+esc(c.id)+'">Study</button>'+
        '<button type="button" class="secondary danger" data-delete-card="'+esc(c.id)+'">Delete</button>'+
      '</div></div>';
  }

  if (!q) {
    for (const sec of visibleSections) {
      if (!shownSectionIds.has(sec.id)) {
        html += sectionHeaderHtml(sec);
        html += '<div class="empty">No cards in this section.</div>';
      }
    }
  }

  if (!html) {
    html = '<div class="empty">No cards match. Use Add card to create one.</div>';
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
document.getElementById('addCard').addEventListener('click', () => {
  state.editingId = NEW_ID;
  state.renamingSectionId = null;
  render();
  const ta = document.querySelector('[data-form="card"] textarea[name="q"]');
  if (ta) ta.focus();
});
document.getElementById('addSection').addEventListener('click', () => {
  vscode.postMessage({ type: 'addSection' });
});

function readForm(root) {
  const data = {};
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el.name) data[el.name] = el.value;
  });
  return data;
}

document.body.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!(t instanceof Element)) return;

  if (t.closest('[data-edit-meta]')) {
    state.editingMeta = true;
    render();
    return;
  }
  if (t.closest('[data-cancel-meta]')) {
    state.editingMeta = false;
    render();
    return;
  }
  if (t.closest('[data-save-meta]')) {
    const form = document.querySelector('[data-form="meta"]');
    const data = readForm(form);
    vscode.postMessage({ type: 'updateMeta', title: data.title, description: data.description });
    state.editingMeta = false;
    return;
  }

  const editBtn = t.closest('[data-edit]');
  if (editBtn) {
    state.editingId = editBtn.getAttribute('data-edit');
    state.renamingSectionId = null;
    render();
    return;
  }
  if (t.closest('[data-cancel-edit]')) {
    state.editingId = null;
    render();
    return;
  }
  if (t.closest('[data-save-card]')) {
    const form = t.closest('[data-form="card"]');
    const data = readForm(form);
    const id = form.getAttribute('data-id');
    const payload = {
      q: data.q || '',
      a: data.a || '',
      tags: data.tags || '',
      sectionId: data.sectionId || undefined,
    };
    if (id === NEW_ID) {
      vscode.postMessage(Object.assign({ type: 'addCard' }, payload));
    } else {
      vscode.postMessage(Object.assign({ type: 'updateCard', id }, payload));
    }
    state.editingId = null;
    return;
  }

  const delCard = t.closest('[data-delete-card]');
  if (delCard) {
    vscode.postMessage({ type: 'deleteCard', id: delCard.getAttribute('data-delete-card') });
    return;
  }

  const renameSec = t.closest('[data-rename-section]');
  if (renameSec) {
    state.renamingSectionId = renameSec.getAttribute('data-rename-section');
    state.editingId = null;
    render();
    return;
  }
  if (t.closest('[data-cancel-section]')) {
    state.renamingSectionId = null;
    render();
    return;
  }
  const saveSec = t.closest('[data-save-section]');
  if (saveSec) {
    const id = saveSec.getAttribute('data-save-section');
    const header = saveSec.closest('.section-header');
    const input = header && header.querySelector('input[name="sectionName"]');
    vscode.postMessage({ type: 'renameSection', id, name: input ? input.value : '' });
    state.renamingSectionId = null;
    return;
  }
  const delSec = t.closest('[data-delete-section]');
  if (delSec) {
    vscode.postMessage({
      type: 'deleteSection',
      id: delSec.getAttribute('data-delete-section'),
      name: delSec.getAttribute('data-name') || '',
    });
    return;
  }

  const copyBtn = t.closest('[data-copy]');
  if (copyBtn) {
    ev.preventDefault();
    vscode.postMessage({ type: 'copy', kind: copyBtn.getAttribute('data-copy'), id: copyBtn.getAttribute('data-id') });
    return;
  }
  const studyBtn = t.closest('[data-study]');
  if (studyBtn) {
    ev.preventDefault();
    vscode.postMessage({ type: 'openStudy', id: studyBtn.getAttribute('data-id') });
  }
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === '/' && ev.target.tagName !== 'INPUT' && ev.target.tagName !== 'TEXTAREA' && ev.target.tagName !== 'SELECT') {
    ev.preventDefault();
    document.getElementById('search').focus();
  }
  if (ev.key === 'Escape' && (state.editingId || state.editingMeta || state.renamingSectionId)) {
    state.editingId = null;
    state.editingMeta = false;
    state.renamingSectionId = null;
    render();
  }
});

window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (msg.type === 'setState') {
    state.title = msg.title || '';
    state.description = msg.description || '';
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
