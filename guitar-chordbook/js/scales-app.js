/* ===================================================================
   scales-app.js
   スケール表ページのUIロジック：フィルタ／SVGフレットボード描画（0〜15フレット）
=================================================================== */

const scaleState = {
  root: null,
  type: null
};

/* ---------------- SVGスケールパターン図 ----------------
   0〜SCALE_FRET_MAX フレットのネック全体を横向き表示（ナット左、フレット右、
   1弦が上・6弦が下）。ドットはフレット線の交点位置に置き、度数を表示する。
------------------------------------------------------------------ */

function renderScaleSVG(pattern) {
  const cols = SCALE_FRET_MAX;
  const fretGap = 42;
  const marginTop = 16;
  const marginBottom = 26;
  const marginLeft = 26;
  const marginRight = 16;
  const rows = 5;
  const stringGap = 20;
  const W = marginLeft + marginRight + fretGap * cols;
  const H = marginTop + marginBottom + stringGap * rows;
  const dotR = 8;

  const stringY = s => marginTop + (5 - s) * stringGap;

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chord-svg scale-svg" role="img" aria-label="${pattern.name}">`;

  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    svg += `<line x1="${marginLeft}" y1="${y}" x2="${marginLeft + fretGap * cols}" y2="${y}" class="string-line" />`;
  }

  for (let f = 0; f <= cols; f++) {
    const x = marginLeft + f * fretGap;
    let cls = 'fret-line';
    if (f === 0) cls = 'nut-line';
    else if (f === 12) cls = 'fret-line fret-line--octave';
    svg += `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + stringGap * rows}" class="${cls}" />`;
    if (f > 0) {
      svg += `<text x="${x}" y="${marginTop + stringGap * rows + 14}" class="fret-number" text-anchor="middle">${f}</text>`;
    }
  }

  pattern.notesByString.forEach((notes, s) => {
    const y = stringY(s);
    notes.forEach(({ fret, degree }) => {
      const x = marginLeft + fret * fretGap;
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
  return true;
}

const scaleGridEl = document.getElementById('scaleGrid');
const scaleCountEl = document.getElementById('scaleResultCount');
const scaleEmptyEl = document.getElementById('scaleEmptyState');

function scaleCardHTML(p) {
  return `
    <article class="scale-card">
      <div class="chord-card__head">
        <h3 class="chord-card__name">${p.name}</h3>
      </div>
      <p class="scale-card__position-hint">目安ポジション：6弦ルート ${p.sixthStringPosition}fr ／ 5弦ルート ${p.fifthStringPosition}fr</p>
      <div class="scale-card__diagram-wrap">${renderScaleSVG(p)}</div>
      ${scaleToneRowHTML(p)}
    </article>
  `;
}

function renderScales() {
  const list = SCALE_LIBRARY.filter(matchesScaleFilters);
  scaleCountEl.textContent = `${list.length}件のスケール`;
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

buildScaleFilterUI();
renderScales();
