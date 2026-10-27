"""
Script: calibrate_mushaf_bounds.py
Purpose:
  Extracts glyph boundary coordinates for the Noble Quran (Hafs 1421H edition)
  and calibrates split points between adjacent verses across all 604 pages.

Key Calibration Logic:
  In Arabic (RTL reading order):
  - Ayah N is positioned on the right, ending with its marker circle (رقم الآية).
  - Ayah N+1 starts on the left, after Ayah N's marker circle.
  - The master database originally placed the split coordinate inside/to the right of the marker circle.
  - This script shifts every split point to the left into the whitespace gap between the circle and next word.
  - Result:
      * Ayah N encompasses its own marker circle.
      * Ayah N+1 starts cleanly after the marker circle without highlighting it.
"""

import sqlite3
import json
import os

DB_PATH = '/tmp/hafs_1421.db'
OUTPUT_JSON = 'src/data/quran/ayahBounds.json'

def make_rounded_rect(x1: float, y1: float, x2: float, y2: float, r: float = 6) -> str:
    w = x2 - x1
    h = y2 - y1
    r = min(r, w / 2, h / 2)
    return (
        f'M {x1 + r} {y1} '
        f'L {x2 - r} {y1} Q {x2} {y1} {x2} {y1 + r} '
        f'L {x2} {y2 - r} Q {x2} {y2} {x2 - r} {y2} '
        f'L {x1 + r} {y2} Q {x1} {y2} {x1} {y2 - r} '
        f'L {x1} {y1 + r} Q {x1} {y1} {x1 + r} {y1} Z'
    )

def calibrate_all_pages():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database {DB_PATH} not found. Download hafs_1421.db first.")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Load existing file to preserve custom calibrated Page 1 and Page 2
    with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
        compiled = json.load(f)

    # Calibrate pages 3 through 604
    for p in range(3, 605):
        cur.execute('''
            SELECT sura_number, ayah_number, line_number, min_x, max_x, min_y, max_y
            FROM glyphs
            WHERE page_number = ?
            ORDER BY line_number, min_x
        ''', (p,))
        rows = cur.fetchall()

        # Group segments by line
        line_groups = {}
        for r in rows:
            line_num = r[2]
            if line_num not in line_groups:
                line_groups[line_num] = []
            line_groups[line_num].append(list(r))

        # Adjust split boundaries between adjacent verses on each line
        for line_num, segs in line_groups.items():
            if len(segs) > 1:
                for i in range(len(segs) - 1):
                    left_seg = segs[i]
                    right_seg = segs[i + 1]
                    split_x = left_seg[4]
                    left_min_x = left_seg[3]

                    available_space = split_x - left_min_x
                    if available_space >= 100:
                        shift = 58
                    elif available_space >= 60:
                        shift = int(available_space * 0.55)
                    else:
                        shift = max(0, available_space - 15)

                    new_split = split_x - shift
                    left_seg[4] = new_split
                    right_seg[3] = new_split

        # Group by (surah, ayah)
        ayah_map = {}
        for line_num in sorted(line_groups.keys()):
            for sura, ayah, line, min_x, max_x, min_y, max_y in line_groups[line_num]:
                key = (sura, ayah)
                if key not in ayah_map:
                    ayah_map[key] = []
                ayah_map[key].append(make_rounded_rect(min_x, min_y, max_x, max_y, r=6))

        page_ayahs = []
        for (sura, ayah) in sorted(ayah_map.keys()):
            page_ayahs.append({
                's': sura,
                'a': ayah,
                'd': ' '.join(ayah_map[(sura, ayah)])
            })

        compiled[str(p)] = {
            'v': '0 0 1120 1812',
            'b': page_ayahs
        }

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(compiled, f, separators=(',', ':'))

    print("All 604 pages successfully calibrated and written to:", OUTPUT_JSON)

if __name__ == '__main__':
    calibrate_all_pages()

