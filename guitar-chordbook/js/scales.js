/* ===================================================================
   scales.js
   スケールデータ定義 + フレットボードパターン生成（0〜15フレットのフルネック表示）
   chords.js の STRING_OPEN_PITCH / DEGREE_LABELS / NOTE_NAMES / NOTE_DISPLAY を利用する。
=================================================================== */

const SCALE_TYPES = {
  major: { label: 'メジャースケール', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'マイナースケール（自然短音階）', intervals: [0, 2, 3, 5, 7, 8, 10] },
  majorPenta: { label: 'メジャーペンタトニック', intervals: [0, 2, 4, 7, 9] },
  minorPenta: { label: 'マイナーペンタトニック', intervals: [0, 3, 5, 7, 10] },
  blues: { label: 'ブルーススケール', intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { label: 'ドリアンスケール', intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { label: 'ミクソリディアンスケール', intervals: [0, 2, 4, 5, 7, 9, 10] }
};

const SCALE_FRET_MAX = 15; // 0（開放）〜15フレットまで表示

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
 * 指定ルート・タイプのスケールを 0〜SCALE_FRET_MAX フレットの全弦にわたって機械的に抽出する。
 * 従来の「ポジション別の狭いボックス」ではなく、ネック全体でそのスケールがどこに現れるかを示す。
 */
function buildScalePattern(root, typeKey) {
  const type = SCALE_TYPES[typeKey];
  const scaleIntervalSet = new Set(type.intervals);

  const notesByString = [];
  for (let s = 0; s < 6; s++) {
    const strNotes = [];
    for (let f = 0; f <= SCALE_FRET_MAX; f++) {
      const pitch = (STRING_OPEN_PITCH[s] + f) % 12;
      const interval = (pitch - root + 12) % 12;
      if (scaleIntervalSet.has(interval)) {
        strNotes.push({ fret: f, interval, degree: DEGREE_LABELS[interval] });
      }
    }
    notesByString.push(strNotes);
  }

  // 参考：定番の「6弦ルート」「5弦ルート」ポジションがネック上のどこから始まるか
  const sixthStringPosition = (root - 4 + 12) % 12;
  const fifthStringPosition = (root - 9 + 12) % 12;

  return {
    id: `scale-${root}-${typeKey}`,
    root, typeKey,
    notesByString,
    name: `${NOTE_DISPLAY[root].split('/')[0]} ${type.label}`,
    typeLabel: type.label,
    sixthStringPosition,
    fifthStringPosition
  };
}

function generateScaleLibrary() {
  const list = [];
  for (let root = 0; root < 12; root++) {
    Object.keys(SCALE_TYPES).forEach(typeKey => {
      list.push(buildScalePattern(root, typeKey));
    });
  }
  return list;
}

const SCALE_LIBRARY = generateScaleLibrary();
