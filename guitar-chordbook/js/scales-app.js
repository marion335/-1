/* ===================================================================
   scales-app.js
   スケール表ページのUIロジック：フィルタ／SVGフレットボード描画
=================================================================== */

const scaleState = {
  root: null,
  type: null,
  position: 'all' // 'all' | 'E-shape' | 'A-shape'
};

/* ---------------- SVGスケールパターン図 ----------------
   コード図と同じ横向き（ナット/ポジション左、フレット右、1弦が上・6弦が下）。
   スケール音は指番号ではなくフレット線の交点にドットを置き、度数を表示する。
------------------------------------------------------------------ */

function renderScaleSVG(pattern) {
  const W = 190;
  const H = 110;
  const marginTop = 14;
  const marginBottom = 14;
  const marginLeft = 30;
  const marginRight = 14;
  const cols = pattern.span;
  const rows = 5;
  const fretGap = (W - marginLeft - marginRight) / cols;
  const stringGap = (H - marginTop - marginBottom) / rows;
  const dotR = 7.5;
  const isNutPosition = pattern.baseFret === 0;

  const stringY = s => marginTop + (5 - s) * stringGap;

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chord-svg" role="img" aria-label="${pattern.name}">`;

  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    svg += `<line x1="${marginLeft}" y1="${y}" x2="${marginLeft + fretGap * cols}" y2="${y}" class="string-line" />`;
  }

  for (let f = 0; f <= cols; f++) {
    const x = marginLeft + f * fretGap;
    const isNut = f === 0 && isNutPosition;
    svg += `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + stringGap * rows}" class="${isNut ? 'nut-line' : 'fret-line'}" />`;
  }

  if (!isNutPosition) {
    svg += `<text x="${marginLeft}" y="${marginTop - 4}" class="fret-label" text-anchor="middle">${pattern.baseFret}fr</text>`;
  }

  pattern.notesByString.forEach((notes, s) => {
    const y = stringY(s);
    notes.forEach(({ fret, degree }) => {
      const x = marginLeft + (fret - pattern.baseFret) * fretGap;
      const isRoot = degree === 'R';
      svg += `<circle cx="${x}" cy="${y}" r="${dotR}" class="dot${isRoot ? ' dot--root' : ''}" />`;
      svg += `<text x="${x}" y="${y + 2.8}" class="degree-label degree-label--large" text-anchor="middle">${degree}</text>`;
    });
  });

  svg += `</svg>`;
  return svg;
}

/* ---------------- 構成音 ---------------- */

function scaleToneRowHTML(pattern) {
  const tones = scaleTones(pattern.root, pattern.typeKey);
  const pills = tones.map(t => `
    <span class="tone-pill ${t.degree === 'R' ? 'tone-pill--root' : ''}">
      <span class="tone-pill__note">${t.note}</span><span class="tone-pill__degree">${t.degree}</span>
    </span>
  `).join('');
  return `<div class="tone-row">${pills}</div>`;
}

/* ---------------- フィルタリング & 描画 ---------------- */

function matchesScaleFilters(p) {
  if (scaleState.root !== null && p.root !== scaleState.root) return false;
  if (scaleState.type !== null && p.typeKey !== scaleState.type) return false;
  if (scaleState.position !== 'all' && p.shape !== scaleState.position) return false;
  return true;
}

const scaleGridEl = document.getElementById('scaleGrid');
const scaleCountEl = document.getElementById('scaleResultCount');
const scaleEmptyEl = document.getElementById('scaleEmptyState');

function scaleCardHTML(p) {
  return `
    <article class="chord-card">
      <div class="chord-card__head">
        <h3 class="chord-card__name">${p.name}</h3>
      </div>
      <div class="chord-card__diagram">${renderScaleSVG(p)}</div>
      ${scaleToneRowHTML(p)}
      <div class="chord-card__foot">
        <span class="badge">${p.rootLabel}</span>
      </div>
    </article>
  `;
}

function renderScales() {
  const list = SCALE_LIBRARY.filter(matchesScaleFilters);
  scaleCountEl.textContent = `${list.length}件のスケールパターン`;
  if (list.length === 0) {
    scaleGridEl.innerHTML = '';
    scaleEmptyEl.hidden = false;
  } else {
    scaleEmptyEl.hidden = true;
    scaleGridEl.innerHTML = list.map(scaleCardHTML).join('');
  }
}

/* ---------------- フィルタUI構築 ---------------- */

function buildScaleFilterUI() {
  const rootSelect = document.getElementById('scaleRootFilter');
  let rootHTML = `<option value="">すべて</option>`;
  for (let i = 0; i < 12; i++) {
    rootHTML += `<option value="${i}">${NOTE_DISPLAY[i].split('/')[0]}</option>`;
  }
  rootSelect.innerHTML = rootHTML;

  const typeSelect = document.getElementById('scaleTypeFilter');
  let typeHTML = `<option value="">すべて</option>`;
  Object.keys(SCALE_TYPES).forEach(key => {
    typeHTML += `<option value="${key}">${SCALE_TYPES[key].label}</option>`;
  });
  typeSelect.innerHTML = typeHTML;
}

document.getElementById('scaleRootFilter').addEventListener('change', e => {
  scaleState.root = e.target.value === '' ? null : Number(e.target.value);
  renderScales();
});

document.getElementById('scaleTypeFilter').addEventListener('change', e => {
  scaleState.type = e.target.value === '' ? null : e.target.value;
  renderScales();
});

document.getElementById('scalePositionFilter').addEventListener('change', e => {
  scaleState.position = e.target.value;
  renderScales();
});

buildScaleFilterUI();
renderScales();
