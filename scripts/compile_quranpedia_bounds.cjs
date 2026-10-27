const fs = require('fs');
const path = require('path');

function makeRoundedRect(x1, y1, x2, y2, r = 2.5) {
  x1 = Math.min(x1, x2);
  x2 = Math.max(x1, x2);
  y1 = Math.min(y1, y2);
  y2 = Math.max(y1, y2);
  const w = x2 - x1;
  const h = y2 - y1;
  r = Math.min(r, w / 2, h / 2);
  
  // Format with at most 2 decimal places to save space
  const f = n => Number(n.toFixed(2));
  return `M ${f(x1 + r)} ${f(y1)} ` +
         `L ${f(x2 - r)} ${f(y1)} Q ${f(x2)} ${f(y1)} ${f(x2)} ${f(y1 + r)} ` +
         `L ${f(x2)} ${f(y2 - r)} Q ${f(x2)} ${f(y2)} ${f(x2 - r)} ${f(y2)} ` +
         `L ${f(x1 + r)} ${f(y2)} Q ${f(x1)} ${f(y2)} ${f(x1)} ${f(y2 - r)} ` +
         `L ${f(x1)} ${f(y1 + r)} Q ${f(x1)} ${f(y1)} ${f(x1 + r)} ${f(y1)} Z`;
}

const compiled = {};

// 1. Page 1 (Surah Al-Fatiha - 980x1024)
compiled['1'] = {
  v: '0 0 980 1024',
  b: [
    { s: 1, a: 1, d: makeRoundedRect(210, 155, 800, 250, 8) },
    { s: 1, a: 2, d: makeRoundedRect(150, 275, 850, 370, 8) },
    { s: 1, a: 3, d: makeRoundedRect(560, 395, 910, 485, 8) },
    { s: 1, a: 4, d: makeRoundedRect(90, 395, 560, 485, 8) },
    { s: 1, a: 5, d: makeRoundedRect(250, 515, 910, 605, 8) },
    { s: 1, a: 6, d: [
        makeRoundedRect(100, 515, 250, 605, 8),
        makeRoundedRect(475, 635, 910, 725, 8)
      ].join(' ')
    },
    { s: 1, a: 7, d: [
        makeRoundedRect(100, 635, 475, 725, 8),
        makeRoundedRect(190, 755, 810, 845, 8),
        makeRoundedRect(320, 880, 700, 970, 8)
      ].join(' ')
    }
  ]
};

// 2. Page 2 (Surah Al-Baqarah 1-5 - 1024x990)
compiled['2'] = {
  v: '0 0 1024 990',
  b: [
    { s: 2, a: 1, d: makeRoundedRect(690, 325, 865, 410, 8) },
    { s: 2, a: 2, d: [
        makeRoundedRect(160, 325, 690, 410, 8),
        makeRoundedRect(665, 435, 885, 520, 8)
      ].join(' ')
    },
    { s: 2, a: 3, d: [
        makeRoundedRect(150, 435, 665, 520, 8),
        makeRoundedRect(465, 545, 885, 630, 8)
      ].join(' ')
    },
    { s: 2, a: 4, d: [
        makeRoundedRect(145, 545, 465, 630, 8),
        makeRoundedRect(140, 655, 885, 740, 8)
      ].join(' ')
    },
    { s: 2, a: 5, d: [
        makeRoundedRect(190, 760, 835, 850, 8),
        makeRoundedRect(320, 880, 710, 965, 8)
      ].join(' ')
    }
  ]
};

// 3. Pages 3 through 604 (Quranpedia official audited dataset)
const segRegex = /M\s+([\d.-]+)\s+([\d.-]+)\s+L\s+([\d.-]+)\s+([\d.-]+)\s+L\s+([\d.-]+)\s+([\d.-]+)\s+L\s+([\d.-]+)\s+([\d.-]+)\s+Z/g;

for (let p = 3; p <= 604; p++) {
  const pStr = p.toString().padStart(3, '0');
  const jsonPath = `/tmp/quran_ws_json/${pStr}.json`;
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath}`);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const pageItems = [];

  for (const item of data) {
    const poly = item.polygon;
    const matches = [...poly.matchAll(segRegex)];
    const roundedPaths = [];

    for (const m of matches) {
      const x1 = parseFloat(m[1]);
      const y1 = parseFloat(m[2]);
      const x2 = parseFloat(m[3]);
      const y2 = parseFloat(m[6]);
      roundedPaths.push(makeRoundedRect(x1, y1, x2, y2, 2.5));
    }

    pageItems.push({
      s: item.surahNumber,
      a: item.ayahNumber,
      d: roundedPaths.join(' ')
    });
  }

  compiled[p.toString()] = {
    v: '0 -3 345 550',
    b: pageItems
  };
}

const outputPath = path.join(__dirname, '../src/data/quran/ayahBounds.json');
fs.writeFileSync(outputPath, JSON.stringify(compiled), 'utf8');
console.log(`Successfully compiled all 604 pages into ${outputPath}! Total pages: ${Object.keys(compiled).length}`);
