import { THEME_CSS } from "./theme.css";

export function studyHtml(nonce: string, cspSource: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Flashcard Study</title>
<style>
${THEME_CSS}
.study-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100% - 49px);
  padding: 16px 12px 24px;
  overflow: auto;
}
.deck-title {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}
.flip-card {
  flex: 1 1 auto;
  min-height: 220px;
  border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  border-radius: 8px;
  padding: 20px 18px;
  background: var(--vscode-editor-background);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: none;
}
.flip-card:focus {
  outline: 1px solid var(--vscode-focusBorder);
}
.flip-card .side-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vscode-descriptionForeground);
}
.flip-card .section-name {
  font-size: 12px;
}
.flip-card .prompt {
  font-size: 18px;
  line-height: 1.4;
  font-weight: 600;
  white-space: pre-wrap;
}
.flip-card .answer {
  font-size: 15px;
  line-height: 1.5;
  white-space: pre-wrap;
  border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  padding-top: 12px;
  margin-top: 4px;
}
.flip-card .hint {
  margin-top: auto;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.nav .spacer { flex: 1 1 auto; }
select#section {
  min-width: 160px;
  max-width: 280px;
}
.progress-bar {
  height: 4px;
  background: var(--vscode-widget-border, transparent);
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar > span {
  display: block;
  height: 100%;
  background: var(--vscode-progressBar-background, var(--vscode-button-background));
  width: 0%;
  transition: width 0.15s ease;
}
.known-mark {
  color: var(--vscode-charts-green, #89d185);
  font-size: 12px;
}
</style>
</head>
<body>
  <div class="top">
    <select id="section" title="Filter by section"></select>
    <input class="search" id="search" type="search" placeholder="Filter questions…"/>
    <span class="count" id="count"></span>
    <div class="actions">
      <button type="button" class="secondary" id="shuffle">Shuffle</button>
      <button type="button" class="secondary" id="reset">Reset order</button>
    </div>
  </div>
  <div class="study-body">
    <div class="deck-title" id="deckTitle"></div>
    <div class="progress-bar"><span id="progress"></span></div>
    <div class="flip-card" id="card" tabindex="0" role="button" aria-label="Flip card">
      <div class="side-label" id="sideLabel">Question</div>
      <div class="section-name muted" id="sectionName"></div>
      <div class="prompt" id="prompt"></div>
      <div class="answer" id="answer" hidden></div>
      <div class="hint" id="hint">Space / click — flip · ← → navigate · K — mark known</div>
    </div>
    <div class="nav">
      <button type="button" class="secondary" id="prev">← Prev</button>
      <button type="button" id="flip">Flip</button>
      <button type="button" class="secondary" id="next">Next →</button>
      <span class="spacer"></span>
      <span class="known-mark" id="knownMark" hidden>✓ known this session</span>
      <button type="button" class="secondary" id="known">Mark known</button>
    </div>
  </div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const saved = vscode.getState() || {};
let state = {
  title: '',
  description: '',
  cards: [],
  sections: [],
  sectionId: saved.sectionId || '',
  query: saved.query || '',
  order: saved.order || null,
  index: typeof saved.index === 'number' ? saved.index : 0,
  flipped: false,
  known: new Set(saved.known || []),
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function persist() {
  vscode.setState({
    sectionId: state.sectionId,
    query: state.query,
    order: state.order,
    index: state.index,
    known: [...state.known],
  });
}

function filtered() {
  let cards = state.cards;
  if (state.sectionId) {
    cards = cards.filter(c => c.sectionId === state.sectionId);
  }
  const q = state.query.trim().toLowerCase();
  if (q) {
    cards = cards.filter(c =>
      (c.q + '\\n' + c.a + '\\n' + c.sectionName + '\\n' + (c.tags || []).join(' ')).toLowerCase().includes(q)
    );
  }
  if (state.order && state.order.length) {
    const byId = new Map(cards.map(c => [c.id, c]));
    const ordered = [];
    for (const id of state.order) {
      const c = byId.get(id);
      if (c) ordered.push(c);
    }
    for (const c of cards) {
      if (!state.order.includes(c.id)) ordered.push(c);
    }
    return ordered;
  }
  return cards;
}

function updateSectionSelect() {
  const sel = document.getElementById('section');
  const cur = state.sectionId;
  sel.innerHTML = '<option value="">All sections</option>' +
    state.sections.map(s => '<option value="'+esc(s.id)+'">'+esc(s.name)+' ('+s.count+')</option>').join('');
  sel.value = cur;
  if (sel.value !== cur) {
    state.sectionId = '';
    sel.value = '';
  }
}

function render() {
  const cards = filtered();
  if (state.index >= cards.length) state.index = Math.max(0, cards.length - 1);
  if (state.index < 0) state.index = 0;

  document.getElementById('deckTitle').textContent =
    state.title + (state.description ? ' — ' + state.description : '');

  const count = document.getElementById('count');
  count.textContent = cards.length
    ? (state.index + 1) + ' / ' + cards.length + ' cards'
    : '0 cards';

  const pct = cards.length ? ((state.index + 1) / cards.length) * 100 : 0;
  document.getElementById('progress').style.width = pct + '%';

  const cardEl = document.getElementById('card');
  const prompt = document.getElementById('prompt');
  const answer = document.getElementById('answer');
  const sideLabel = document.getElementById('sideLabel');
  const sectionName = document.getElementById('sectionName');
  const knownMark = document.getElementById('knownMark');
  const hint = document.getElementById('hint');

  document.getElementById('prev').disabled = cards.length === 0 || state.index <= 0;
  document.getElementById('next').disabled = cards.length === 0 || state.index >= cards.length - 1;
  document.getElementById('flip').disabled = cards.length === 0;
  document.getElementById('known').disabled = cards.length === 0;

  if (!cards.length) {
    sideLabel.textContent = '';
    sectionName.textContent = '';
    prompt.textContent = 'No cards match.';
    answer.hidden = true;
    answer.textContent = '';
    knownMark.hidden = true;
    hint.textContent = 'Widen the section or search filter.';
    persist();
    return;
  }

  const card = cards[state.index];
  sideLabel.textContent = state.flipped ? 'Answer' : 'Question';
  sectionName.textContent = card.sectionName;
  prompt.textContent = card.q;
  answer.textContent = card.a;
  answer.hidden = !state.flipped;
  knownMark.hidden = !state.known.has(card.id);
  hint.textContent = state.flipped
    ? 'Space — hide answer · ← → navigate · K — mark known'
    : 'Space / click — flip · ← → navigate · K — mark known';
  persist();
}

function go(delta) {
  const cards = filtered();
  if (!cards.length) return;
  state.index = Math.max(0, Math.min(cards.length - 1, state.index + delta));
  state.flipped = false;
  render();
}

function flip() {
  if (!filtered().length) return;
  state.flipped = !state.flipped;
  render();
}

function shuffle() {
  const cards = filtered();
  const ids = cards.map(c => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.order = ids;
  state.index = 0;
  state.flipped = false;
  render();
}

function resetOrder() {
  state.order = null;
  state.index = 0;
  state.flipped = false;
  render();
}

function markKnown() {
  const cards = filtered();
  if (!cards.length) return;
  const id = cards[state.index].id;
  if (state.known.has(id)) state.known.delete(id);
  else state.known.add(id);
  render();
}

document.getElementById('section').addEventListener('change', (ev) => {
  state.sectionId = ev.target.value;
  state.order = null;
  state.index = 0;
  state.flipped = false;
  render();
});
document.getElementById('search').addEventListener('input', (ev) => {
  state.query = ev.target.value;
  state.index = 0;
  state.flipped = false;
  render();
});
document.getElementById('shuffle').addEventListener('click', shuffle);
document.getElementById('reset').addEventListener('click', resetOrder);
document.getElementById('prev').addEventListener('click', () => go(-1));
document.getElementById('next').addEventListener('click', () => go(1));
document.getElementById('flip').addEventListener('click', flip);
document.getElementById('known').addEventListener('click', markKnown);
document.getElementById('card').addEventListener('click', flip);

window.addEventListener('keydown', (ev) => {
  const tag = (ev.target && ev.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (ev.key === ' ' || ev.key === 'Enter') {
    ev.preventDefault();
    flip();
  } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    go(-1);
  } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
    ev.preventDefault();
    go(1);
  } else if (ev.key === 'k' || ev.key === 'K') {
    ev.preventDefault();
    markKnown();
  } else if (ev.key === '/') {
    ev.preventDefault();
    document.getElementById('search').focus();
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
    document.getElementById('search').value = state.query;
    state.flipped = false;
    render();
  }
});

vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
