/* ===================================================================
   chords.js
   コードデータ定義 + バレーコード自動生成エンジン
   弦の並びは常に低音弦→高音弦: [6弦(Low E), 5弦(A), 4弦(D), 3弦(G), 2弦(B), 1弦(High E)]
   fret値: -1 = ミュート(X), 0 = 開放(O), 1以上 = 押弦フレット(絶対フレット番号)
=================================================================== */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_DISPLAY = {
  0: 'C', 1: 'C#/D♭', 2: 'D', 3: 'D#/E♭', 4: 'E', 5: 'F',
  6: 'F#/G♭', 7: 'G', 8: 'G#/A♭', 9: 'A', 10: 'A#/B♭', 11: 'B'
};

const TYPE_LABELS = {
  major: '', minor: 'm', '7': '7', m7: 'm7', maj7: 'M7',
  sus4: 'sus4', sus2: 'sus2', '6': '6', m6: 'm6'
};

const TYPE_GROUPS = [
  { id: 'basic', label: 'ベーシック', types: ['major', 'minor'] },
  { id: 'seventh', label: 'セブンス系', types: ['7', 'm7', 'maj7'] },
  { id: 'other', label: 'その他', types: ['sus4', 'sus2', '6', 'm6'] }
];

/* ---------------- オープンコード辞書（厳選・定番） ---------------- */
/* frets/fingers: [6弦,5弦,4弦,3弦,2弦,1弦] fingers 0=開放/押さえない */

const OPEN_CHORDS = [
  // --- Major ---
  { root: 4, type: 'major', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  { root: 9, type: 'major', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  { root: 2, type: 'major', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  { root: 7, type: 'major', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  { root: 0, type: 'major', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  { root: 5, type: 'major', frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], note: 'F（簡易フォーム）' },

  // --- Minor ---
  { root: 4, type: 'minor', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  { root: 9, type: 'minor', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  { root: 2, type: 'minor', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },

  // --- 7 ---
  { root: 4, type: '7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  { root: 9, type: '7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
  { root: 2, type: '7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  { root: 7, type: '7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  { root: 0, type: '7', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  { root: 11, type: '7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },

  // --- m7 ---
  { root: 4, type: 'm7', frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  { root: 9, type: 'm7', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  { root: 2, type: 'm7', frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },

  // --- maj7 ---
  { root: 0, type: 'maj7', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  { root: 2, type: 'maj7', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
  { root: 4, type: 'maj7', frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 1, 0, 0] },
  { root: 7, type: 'maj7', frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] },
  { root: 9, type: 'maj7', frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  { root: 5, type: 'maj7', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },

  // --- sus4 ---
  { root: 9, type: 'sus4', frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 4, 0] },
  { root: 2, type: 'sus4', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 3] },
  { root: 4, type: 'sus4', frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
  { root: 0, type: 'sus4', frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1] },

  // --- sus2 ---
  { root: 9, type: 'sus2', frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  { root: 2, type: 'sus2', frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },

  // --- 6 ---
  { root: 0, type: '6', frets: [-1, 3, 2, 2, 1, 0], fingers: [0, 4, 2, 3, 1, 0] },
  { root: 7, type: '6', frets: [3, 2, 0, 0, 0, 0], fingers: [3, 2, 0, 0, 0, 0] },
  { root: 9, type: '6', frets: [-1, 0, 2, 2, 2, 2], fingers: [0, 0, 1, 1, 1, 1] },
  { root: 4, type: '6', frets: [0, 2, 2, 1, 2, 0], fingers: [0, 2, 3, 1, 4, 0] },
  { root: 2, type: '6', frets: [-1, -1, 0, 2, 0, 2], fingers: [0, 0, 0, 1, 0, 2] },

  // --- m6 ---
  { root: 9, type: 'm6', frets: [-1, 0, 2, 2, 1, 2], fingers: [0, 0, 2, 3, 1, 4] },
  { root: 4, type: 'm6', frets: [0, 2, 2, 0, 2, 0], fingers: [0, 2, 3, 0, 4, 0] },
  { root: 2, type: 'm6', frets: [-1, -1, 0, 2, 0, 1], fingers: [0, 0, 0, 2, 0, 1] }
].map(c => ({ ...c, voicing: 'open', shape: 'open' }));

/* ---------------- バレーコード生成テンプレート ----------------
   offsetsはバレーフレット b からの相対値。-1はミュート。
   b はルート音のシェイプ基準弦(E弦 or A弦)からの半音距離。
------------------------------------------------------------------ */

const E_SHAPE_TEMPLATES = {
  major: [0, 2, 2, 1, 0, 0],
  minor: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  '6': [0, 2, 2, 1, 2, 0],
  m6: [0, 2, 2, 0, 2, 0]
};

const A_SHAPE_TEMPLATES = {
  major: [null, 0, 2, 2, 2, 0],
  minor: [null, 0, 2, 2, 1, 0],
  '7': [null, 0, 2, 0, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  sus4: [null, 0, 2, 2, 3, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  '6': [null, 0, 2, 2, 2, 2],
  m6: [null, 0, 2, 2, 1, 2]
};

function buildBarreFrets(templateOffsets, b) {
  return templateOffsets.map(off => (off === null ? -1 : b + off));
}

/**
 * すべてのルート音 × 全タイプのバレーコードを生成する。
 * E-shape: 基準弦=6弦(Low E, index 4)
 * A-shape: 基準弦=5弦(A, index 9)
 */
function generateBarreChords() {
  const chords = [];
  const shapeConfigs = [
    { shape: 'E-shape', baseNote: 4, templates: E_SHAPE_TEMPLATES },
    { shape: 'A-shape', baseNote: 9, templates: A_SHAPE_TEMPLATES }
  ];

  shapeConfigs.forEach(({ shape, baseNote, templates }) => {
    for (let root = 0; root < 12; root++) {
      const b = (root - baseNote + 12) % 12;
      if (b === 0) continue; // 開放系はOPEN_CHORDSに任せる（重複防止、Eシェイプ=E, Aシェイプ=A自身）
      Object.keys(templates).forEach(type => {
        chords.push({
          root,
          type,
          frets: buildBarreFrets(templates[type], b),
          fingers: null,
          voicing: 'barre',
          shape,
          baseFret: b
        });
      });
    }
  });

  return chords;
}

function chordName(root, type) {
  return NOTE_DISPLAY[root].split('/')[0] + TYPE_LABELS[type];
}

function chordId(c) {
  return `${c.voicing}-${c.shape}-${c.root}-${c.type}-${c.baseFret || 0}`;
}

function buildLibrary() {
  const barre = generateBarreChords();
  const all = [...OPEN_CHORDS, ...barre].map(c => ({
    ...c,
    id: chordId(c),
    name: chordName(c.root, c.type)
  }));
  return all;
}

const CHORD_LIBRARY = buildLibrary();
