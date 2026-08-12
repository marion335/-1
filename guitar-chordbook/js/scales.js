/* ===================================================================
   scales.js
   スケールデータ定義 + フレットボードパターン生成
   chords.js の STRING_OPEN_PITCH / DEGREE_LABELS / NOTE_NAMES / NOTE_DISPLAY を利用する。
=================================================================== */

/* span: ルートポジションから何フレット分表示するか（この数値+1フレット分の範囲）
   5音・6音のペンタトニック/ブルースは定番の4フレット幅ボックス、
   7音スケールはコード陣ぶん広めの5フレット幅で1ポジション分をカバーする。 */
const SCALE_TYPES = {
  major: { label: 'メジャースケール', intervals: [0, 2, 4, 5, 7, 9, 11], span: 4 },
  minor: { label: 'マイナースケール（自然短音階）', intervals: [0, 2, 3, 5, 7, 8, 10], span: 4 },
  majorPenta: { label: 'メジャーペンタトニック', intervals: [0, 2, 4, 7, 9], span: 3 },
  minorPenta: { label: 'マイナーペンタトニック', intervals: [0, 3, 5, 7, 10], span: 3 },
  blues: { label: 'ブルーススケール', intervals: [0, 3, 5, 6, 7, 10], span: 3 },
  dorian: { label: 'ドリアンスケール', intervals: [0, 2, 3, 5, 7, 9, 10], span: 4 },
  mixolydian: { label: 'ミクソリディアンスケール', intervals: [0, 2, 4, 5, 7, 9, 10], span: 4 }
};

/** そのスケールの構成音を度数の低い順で返す（度数・実音名つき） */
function scaleTones(root, typeKey) {
  const type = SCALE_TYPES[typeKey];
  return type.intervals.map(interval => ({
    interval,
    degree: DEGREE_LABELS[interval],
    note: NOTE_NAMES[(root + interval) % 12]
  }));
}

/**
 * 指定ルート・タイプ・シェイプ（6弦ルート/5弦ルート）のフレットボード上パターンを生成する。
 * baseFret（ルート音のシェイプ基準弦上のフレット）から SCALE_WINDOW_SPAN フレット分の範囲で、
 * 全6弦上のスケール構成音を機械的に抽出する。
 */
function buildScalePattern(root, typeKey, shape) {
  const type = SCALE_TYPES[typeKey];
  const scaleIntervalSet = new Set(type.intervals);
  const baseNote = shape === 'E-shape' ? 4 : 9;
  const baseFret = (root - baseNote + 12) % 12;

  const notesByString = [];
  for (let s = 0; s < 6; s++) {
    const strNotes = [];
    for (let f = baseFret; f <= baseFret + type.span; f++) {
      const pitch = (STRING_OPEN_PITCH[s] + f) % 12;
      const interval = (pitch - root + 12) % 12;
      if (scaleIntervalSet.has(interval)) {
        strNotes.push({ fret: f, interval, degree: DEGREE_LABELS[interval] });
      }
    }
    notesByString.push(strNotes);
  }

  const rootLabel = shape === 'E-shape' ? '6弦ルート' : '5弦ルート';
  return {
    id: `scale-${shape}-${root}-${typeKey}`,
    root, typeKey, shape, baseFret, span: type.span,
    notesByString,
    name: `${NOTE_DISPLAY[root].split('/')[0]} ${type.label}`,
    typeLabel: type.label,
    rootLabel
  };
}

function generateScaleLibrary() {
  const list = [];
  ['E-shape', 'A-shape'].forEach(shape => {
    for (let root = 0; root < 12; root++) {
      Object.keys(SCALE_TYPES).forEach(typeKey => {
        list.push(buildScalePattern(root, typeKey, shape));
      });
    }
  });
  return list;
}

const SCALE_LIBRARY = generateScaleLibrary();
