/* ===================================================================
   app.js
   UIロジック：フィルタ／検索／SVGダイアグラム描画／お気に入り／
   メモ／オリジナルコード追加（すべてlocalStorageに保存）
=================================================================== */

const LS_KEYS = {
  favorites: 'gcb_favorites',
  notes: 'gcb_notes',
  custom: 'gcb_custom'
};

const state = {
  view: 'library', // 'library' | 'mybook' | 'add'
  query: '',
  root: null, // 0-11 or null
  type: null, // type key or null
  voicing: 'all' // 'all' | 'open' | 'barre-E-shape' | 'barre-A-shape'
};

/* ---------------- localStorage ヘルパー ---------------- */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getFavorites() { return loadJSON(LS_KEYS.favorites, []); }
function setFavorites(arr) { saveJSON(LS_KEYS.favorites, arr); }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(id);
  setFavorites(favs);
}

function getNotes() { return loadJSON(LS_KEYS.notes, {}); }
function setNote(id, text) {
  const notes = getNotes();
  if (text && text.trim()) notes[id] = text;
  else delete notes[id];
  saveJSON(LS_KEYS.notes, notes);
}

function getCustomChords() { return loadJSON(LS_KEYS.custom, []); }
function setCustomChords(arr) { saveJSON(LS_KEYS.custom, arr); }

function fullLibrary() {
  return [...CHORD_LIBRARY, ...getCustomChords()];
}

/* ---------------- SVGコードダイアグラム ---------------- */

function renderChordSVG(chord, opts = {}) {
  const large = !!opts.large;
  const W = large ? 180 : 118;
  const H = large ? 220 : 140;
  const marginTop = large ? 30 : 20;
  const marginBottom = large ? 14 : 8;
  const marginLeft = large ? 20 : 14;
  const marginRight = large ? 16 : 10;
  const rows = 4;
  const cols = 5; // 6弦間の間隔数
  const stringGap = (W - marginLeft - marginRight) / cols;
  const fretGap = (H - marginTop - marginBottom) / rows;

  const isBarre = chord.voicing === 'barre';
  const baseFret = chord.baseFret || 0;
  const windowStart = isBarre ? baseFret : 1;

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chord-svg" role="img" aria-label="${chord.name}">`;

  // 弦（縦線）
  for (let s = 0; s < 6; s++) {
    const x = marginLeft + s * stringGap;
    svg += `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + fretGap * rows}" class="string-line" />`;
  }

  // フレット（横線）
  for (let f = 0; f <= rows; f++) {
    const y = marginTop + f * fretGap;
    const isNut = f === 0 && windowStart === 1;
    svg += `<line x1="${marginLeft}" y1="${y}" x2="${marginLeft + stringGap * cols}" y2="${y}" class="${isNut ? 'nut-line' : 'fret-line'}" />`;
  }

  // バレー位置ラベル（開放形以外）
  if (windowStart !== 1) {
    const y = marginTop + fretGap * 0.5;
    svg += `<text x="${marginLeft - 6}" y="${y + 3}" class="fret-label" text-anchor="end">${windowStart}fr</text>`;
  }

  // 開放/ミュート マーカー、押弦ドット
  const barreRowStrings = [];
  chord.frets.forEach((fret, s) => {
    const x = marginLeft + s * stringGap;
    if (fret === -1) {
      svg += `<text x="${x}" y="${marginTop - 6}" class="string-mark" text-anchor="middle">×</text>`;
    } else if (fret === 0) {
      svg += `<text x="${x}" y="${marginTop - 6}" class="string-mark" text-anchor="middle">○</text>`;
    } else {
      const row = fret - windowStart + 1;
      if (row === 1 && isBarre) barreRowStrings.push(s);
    }
  });

  // バレーの帯（2弦以上つながっている場合）
  if (barreRowStrings.length >= 2) {
    const x1 = marginLeft + Math.min(...barreRowStrings) * stringGap;
    const x2 = marginLeft + Math.max(...barreRowStrings) * stringGap;
    const y = marginTop + fretGap * 0.5;
    svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="barre-bar" />`;
  }

  // 個々のドット
  chord.frets.forEach((fret, s) => {
    if (fret <= 0) return;
    const x = marginLeft + s * stringGap;
    const row = fret - windowStart + 1;
    const y = marginTop + fretGap * (row - 0.5);
    const finger = chord.fingers && chord.fingers[s] > 0 ? chord.fingers[s] : null;
    svg += `<circle cx="${x}" cy="${y}" r="${large ? 8 : 5.5}" class="dot" />`;
    if (finger) {
      svg += `<text x="${x}" y="${y + (large ? 4 : 2.5)}" class="finger-label" text-anchor="middle">${finger}</text>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

/* ---------------- フィルタリング ---------------- */

function matchesFilters(c) {
  if (state.root !== null && c.root !== state.root) return false;
  if (state.type !== null && c.type !== state.type) return false;
  if (state.voicing !== 'all') {
    if (state.voicing === 'open' && c.voicing !== 'open') return false;
    if (state.voicing === 'barre-E-shape' && !(c.voicing === 'barre' && c.shape === 'E-shape')) return false;
    if (state.voicing === 'barre-A-shape' && !(c.voicing === 'barre' && c.shape === 'A-shape')) return false;
  }
  if (state.query) {
    const q = state.query.trim().toLowerCase();
    if (q && !c.name.toLowerCase().includes(q)) return false;
  }
  return true;
}

function currentList() {
  let list = fullLibrary();
  if (state.view === 'mybook') {
    const favs = getFavorites();
    list = list.filter(c => favs.includes(c.id) || c.custom);
  }
  return list.filter(matchesFilters);
}

/* ---------------- レンダリング ---------------- */

const gridEl = document.getElementById('chordGrid');
const emptyEl = document.getElementById('emptyState');
const countEl = document.getElementById('resultCount');

function chordCardHTML(c) {
  const fav = isFavorite(c.id);
  const badge = c.voicing === 'open'
    ? 'オープン'
    : (c.shape === 'E-shape' ? 'バレー・E型' : 'バレー・A型');
  return `
    <article class="chord-card" data-id="${c.id}" tabindex="0">
      <div class="chord-card__head">
        <h3 class="chord-card__name">${c.name}</h3>
        <button class="star-btn ${fav ? 'is-fav' : ''}" data-action="fav" data-id="${c.id}" aria-label="お気に入り">${fav ? '★' : '☆'}</button>
      </div>
      <div class="chord-card__diagram">${renderChordSVG(c)}</div>
      <div class="chord-card__foot">
        <span class="badge">${badge}</span>
        ${c.note ? `<span class="badge badge--alt">${c.note}</span>` : ''}
        ${c.custom ? `<span class="badge badge--custom">マイコード</span>` : ''}
      </div>
    </article>
  `;
}

function render() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === state.view);
  });
  document.getElementById('libraryPanel').hidden = state.view === 'add';
  document.getElementById('addPanel').hidden = state.view !== 'add';
  document.getElementById('filterBar').hidden = state.view === 'add';

  document.getElementById('mybookHint').hidden = !(state.view === 'mybook');

  if (state.view === 'add') return;

  const list = currentList();
  countEl.textContent = `${list.length}件のコード`;
  if (list.length === 0) {
    gridEl.innerHTML = '';
    emptyEl.hidden = false;
    if (state.view === 'mybook') {
      emptyEl.textContent = 'まだお気に入りがありません。☆をタップしてマイブックに追加しましょう。';
    } else {
      emptyEl.textContent = '該当するコードが見つかりませんでした。';
    }
  } else {
    emptyEl.hidden = true;
    gridEl.innerHTML = list.map(chordCardHTML).join('');
  }
}

/* ---------------- フィルタUI構築 ---------------- */

function buildFilterUI() {
  const rootRow = document.getElementById('rootFilter');
  let rootHTML = `<button class="chip is-active" data-filter="root" data-value="">すべて</button>`;
  for (let i = 0; i < 12; i++) {
    rootHTML += `<button class="chip" data-filter="root" data-value="${i}">${NOTE_DISPLAY[i].split('/')[0]}</button>`;
  }
  rootRow.innerHTML = rootHTML;

  const typeRow = document.getElementById('typeFilter');
  let typeHTML = `<button class="chip is-active" data-filter="type" data-value="">すべて</button>`;
  TYPE_GROUPS.forEach(g => {
    g.types.forEach(t => {
      typeHTML += `<button class="chip" data-filter="type" data-value="${t}">${t === 'major' ? 'メジャー' : t === 'minor' ? 'マイナー' : TYPE_LABELS[t]}</button>`;
    });
  });
  typeRow.innerHTML = typeHTML;
}

function handleChipClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  const group = btn.dataset.filter;
  const value = btn.dataset.value;
  document.querySelectorAll(`.chip[data-filter="${group}"]`).forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  state[group] = value === '' ? null : (group === 'root' ? Number(value) : value);
  render();
}

/* ---------------- モーダル（詳細＋メモ） ---------------- */

const modal = document.getElementById('chordModal');
const modalBody = document.getElementById('modalBody');
let activeChordId = null;

function findChord(id) {
  return fullLibrary().find(c => c.id === id);
}

function openModal(id) {
  const c = findChord(id);
  if (!c) return;
  activeChordId = id;
  const fav = isFavorite(id);
  const notes = getNotes();
  modalBody.innerHTML = `
    <div class="modal__head">
      <h2>${c.name}</h2>
      <button class="star-btn ${fav ? 'is-fav' : ''}" data-action="fav" data-id="${c.id}">${fav ? '★ お気に入り済み' : '☆ お気に入りに追加'}</button>
    </div>
    <div class="modal__diagram">${renderChordSVG(c, { large: true })}</div>
    <label class="modal__memo-label" for="memoInput">自分用メモ（練習ポイント・使う曲など）</label>
    <textarea id="memoInput" class="modal__memo" rows="4" placeholder="例：Aメロで使う。人差し指のセーハに注意。">${notes[id] || ''}</textarea>
    ${c.custom ? `<button class="btn btn--danger" data-action="delete-custom" data-id="${c.id}">このマイコードを削除</button>` : ''}
  `;
  modal.hidden = false;
}

function closeModal() {
  if (activeChordId) {
    const text = document.getElementById('memoInput')?.value || '';
    setNote(activeChordId, text);
  }
  modal.hidden = true;
  activeChordId = null;
  render();
}

/* ---------------- オリジナルコード追加フォーム ---------------- */

const addForm = document.getElementById('addForm');

function fretInputsHTML() {
  const labels = ['6弦(Low E)', '5弦(A)', '4弦(D)', '3弦(G)', '2弦(B)', '1弦(High E)'];
  return labels.map((label, i) => `
    <div class="form__field form__field--small">
      <label for="fret${i}">${label}</label>
      <input type="text" id="fret${i}" name="fret${i}" placeholder="0〜15 / X" maxlength="3" inputmode="numeric">
    </div>
  `).join('');
}

function initAddForm() {
  document.getElementById('fretInputs').innerHTML = fretInputsHTML();
}

function parseFretValue(raw) {
  const v = raw.trim().toUpperCase();
  if (v === 'X' || v === '') return -1;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0 || n > 24) return null;
  return n;
}

function handleAddSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('customName').value.trim();
  const memo = document.getElementById('customMemo').value.trim();
  if (!nameInput) {
    alert('コード名を入力してください。');
    return;
  }
  const frets = [];
  for (let i = 0; i < 6; i++) {
    const raw = document.getElementById(`fret${i}`).value;
    const val = parseFretValue(raw);
    if (val === null) {
      alert('フレット欄には 0〜24 の数字か X を入力してください。');
      return;
    }
    frets.push(val);
  }
  if (frets.every(f => f === -1)) {
    alert('少なくとも1本は弦を鳴らしてください。');
    return;
  }

  const played = frets.filter(f => f > 0);
  const baseFret = played.length ? Math.min(...played) : 0;
  const id = `custom-${Date.now()}`;
  const custom = {
    id, name: nameInput, frets, fingers: null,
    voicing: baseFret > 0 && !frets.includes(0) ? 'barre' : 'open',
    shape: null, baseFret: baseFret > 4 ? baseFret : 0,
    custom: true
  };

  const list = getCustomChords();
  list.push(custom);
  setCustomChords(list);
  if (memo) setNote(id, memo);
  const favs = getFavorites();
  favs.push(id);
  setFavorites(favs);

  addForm.reset();
  state.view = 'mybook';
  render();
}

/* ---------------- イベント登録 ---------------- */

document.getElementById('rootFilter').addEventListener('click', handleChipClick);
document.getElementById('typeFilter').addEventListener('click', handleChipClick);

document.getElementById('voicingFilter').addEventListener('change', e => {
  state.voicing = e.target.value;
  render();
});

document.getElementById('searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  render();
});

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    render();
  });
});

gridEl.addEventListener('click', e => {
  const favBtn = e.target.closest('[data-action="fav"]');
  if (favBtn) {
    toggleFavorite(favBtn.dataset.id);
    render();
    return;
  }
  const card = e.target.closest('.chord-card');
  if (card) openModal(card.dataset.id);
});

gridEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const card = e.target.closest('.chord-card');
    if (card) openModal(card.dataset.id);
  }
});

modal.addEventListener('click', e => {
  if (e.target.dataset.action === 'close' || e.target === modal) closeModal();
  if (e.target.dataset.action === 'fav') {
    toggleFavorite(e.target.dataset.id);
    openModal(activeChordId);
  }
  if (e.target.dataset.action === 'delete-custom') {
    if (confirm('このマイコードを削除しますか？')) {
      const id = e.target.dataset.id;
      setCustomChords(getCustomChords().filter(c => c.id !== id));
      const favs = getFavorites().filter(f => f !== id);
      setFavorites(favs);
      modal.hidden = true;
      activeChordId = null;
      render();
    }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

addForm.addEventListener('submit', handleAddSubmit);

/* ---------------- 初期化 ---------------- */

buildFilterUI();
initAddForm();
render();
