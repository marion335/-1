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

/* ---------------- SVGコードダイアグラム ----------------
   指板は左に90°回転した横向き表示：ナット/バレーが左端、フレットは右方向へ、
   弦は上から1弦(High E)→下へ6弦(Low E)の順（実際に構えた時の見え方に近い並び）。
------------------------------------------------------------------ */

function renderChordSVG(chord, opts = {}) {
  const large = !!opts.large;
  const W = large ? 240 : 150;
  const H = large ? 160 : 100;
  const marginTop = large ? 14 : 10;
  const marginBottom = large ? 14 : 10;
  const marginLeft = large ? 34 : 24;
  const marginRight = large ? 14 : 10;
  const cols = 4; // フレット間の間隔数（横方向）
  const rows = 5; // 6弦間の間隔数（縦方向）
  const fretGap = (W - marginLeft - marginRight) / cols;
  const stringGap = (H - marginTop - marginBottom) / rows;
  const dotR = large ? 9 : 6.5;

  const isBarre = chord.voicing === 'barre';
  const baseFret = chord.baseFret || 0;
  const windowStart = isBarre ? baseFret : 1;
  const hasRoot = chord.root !== undefined && chord.root !== null;

  // 弦インデックス(0=6弦...5=1弦) → 縦位置。1弦を上、6弦を下に配置。
  const stringY = s => marginTop + (5 - s) * stringGap;

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chord-svg" role="img" aria-label="${chord.name}">`;

  // 弦（横線）
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    svg += `<line x1="${marginLeft}" y1="${y}" x2="${marginLeft + fretGap * cols}" y2="${y}" class="string-line" />`;
  }

  // フレット（縦線）
  for (let f = 0; f <= cols; f++) {
    const x = marginLeft + f * fretGap;
    const isNut = f === 0 && windowStart === 1;
    svg += `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + stringGap * rows}" class="${isNut ? 'nut-line' : 'fret-line'}" />`;
  }

  // バレー位置ラベル（開放形以外）
  if (windowStart !== 1) {
    svg += `<text x="${marginLeft}" y="${marginTop - 4}" class="fret-label" text-anchor="middle">${windowStart}fr</text>`;
  }

  // 開放/ミュート マーカー（ナットの左側）
  const barreRowStrings = [];
  chord.frets.forEach((fret, s) => {
    const y = stringY(s);
    if (fret === -1) {
      svg += `<text x="${marginLeft - 7}" y="${y + 3}" class="string-mark" text-anchor="middle">×</text>`;
    } else if (fret === 0) {
      svg += `<text x="${marginLeft - 7}" y="${y + 3}" class="string-mark" text-anchor="middle">○</text>`;
    } else {
      const col = fret - windowStart + 1;
      if (col === 1 && isBarre) barreRowStrings.push(s);
    }
  });

  // バレーの帯（2弦以上つながっている場合、縦方向の帯）
  if (barreRowStrings.length >= 2) {
    const y1 = Math.min(...barreRowStrings.map(stringY));
    const y2 = Math.max(...barreRowStrings.map(stringY));
    const x = marginLeft + fretGap * 0.5;
    svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="barre-bar" />`;
  }

  // 個々のドット（度数表記）
  chord.frets.forEach((fret, s) => {
    if (fret <= 0) return;
    const col = fret - windowStart + 1;
    const x = marginLeft + fretGap * (col - 0.5);
    const y = stringY(s);
    const label = hasRoot ? degreeLabel(chord.root, s, fret) : null;
    const isRoot = label === 'R';
    svg += `<circle cx="${x}" cy="${y}" r="${dotR}" class="dot${isRoot ? ' dot--root' : ''}" />`;
    if (label) {
      svg += `<text x="${x}" y="${y + (large ? 3.5 : 2.5)}" class="degree-label${large ? ' degree-label--large' : ''}" text-anchor="middle">${label}</text>`;
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

function toneRowHTML(c, opts = {}) {
  const tones = chordTones(c);
  if (!tones) return '';
  const large = !!opts.large;
  const pills = tones.map(t => `
    <span class="tone-pill ${t.degree === 'R' ? 'tone-pill--root' : ''}">
      <span class="tone-pill__note">${t.note}</span><span class="tone-pill__degree">${t.degree}</span>
    </span>
  `).join('');
  return `<div class="tone-row ${large ? 'tone-row--large' : ''}">${pills}</div>`;
}

function chordCardHTML(c) {
  const fav = isFavorite(c.id);
  const badge = c.voicing === 'open'
    ? 'オープン'
    : (c.shape === 'E-shape' ? 'バレー・E型' : 'バレー・A型');
  const rootBadge = rootStringLabel(c);
  return `
    <article class="chord-card" data-id="${c.id}" tabindex="0">
      <div class="chord-card__head">
        <h3 class="chord-card__name">${c.name}</h3>
        <button class="star-btn ${fav ? 'is-fav' : ''}" data-action="fav" data-id="${c.id}" aria-label="お気に入り">${fav ? '★' : '☆'}</button>
      </div>
      <div class="chord-card__diagram">${renderChordSVG(c)}</div>
      ${toneRowHTML(c)}
      <div class="chord-card__foot">
        <span class="badge">${badge}</span>
        ${rootBadge ? `<span class="badge badge--root">${rootBadge}</span>` : ''}
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

/* ---------------- フィルタUI構築（プルダウン） ---------------- */

function typeOptionLabel(t) {
  if (t === 'major') return 'メジャー';
  if (t === 'minor') return 'マイナー';
  return TYPE_LABELS[t];
}

function buildFilterUI() {
  const rootSelect = document.getElementById('rootFilter');
  let rootHTML = `<option value="">すべて</option>`;
  for (let i = 0; i < 12; i++) {
    rootHTML += `<option value="${i}">${NOTE_DISPLAY[i].split('/')[0]}</option>`;
  }
  rootSelect.innerHTML = rootHTML;

  const typeSelect = document.getElementById('typeFilter');
  let typeHTML = `<option value="">すべて</option>`;
  TYPE_GROUPS.forEach(g => {
    g.types.forEach(t => {
      typeHTML += `<option value="${t}">${typeOptionLabel(t)}</option>`;
    });
  });
  typeSelect.innerHTML = typeHTML;
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
  const rootBadge = rootStringLabel(c);
  modalBody.innerHTML = `
    <div class="modal__head">
      <h2>${c.name}</h2>
      <button class="star-btn ${fav ? 'is-fav' : ''}" data-action="fav" data-id="${c.id}">${fav ? '★ お気に入り済み' : '☆ お気に入りに追加'}</button>
    </div>
    ${rootBadge ? `<span class="badge badge--root">${rootBadge}</span>` : ''}
    <div class="modal__diagram">${renderChordSVG(c, { large: true })}</div>
    ${toneRowHTML(c, { large: true })}
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
    id, name: nameInput, frets,
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

document.getElementById('rootFilter').addEventListener('change', e => {
  state.root = e.target.value === '' ? null : Number(e.target.value);
  render();
});

document.getElementById('typeFilter').addEventListener('change', e => {
  state.type = e.target.value === '' ? null : e.target.value;
  render();
});

document.getElementById('voicingFilter').addEventListener('change', e => {
  state.voicing = e.target.value;
  render();
});

document.getElementById('searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  render();
});

document.querySelectorAll('.nav-tab[data-view]').forEach(btn => {
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
