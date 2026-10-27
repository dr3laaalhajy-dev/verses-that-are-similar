"""
Script: calibrate_mushaf_bounds.py
Purpose:
  Extracts glyph boundary coordinates for the Noble Quran (Hafs 1421H edition)
  and calibrates exact split points between adjacent verses across all 604 pages.

Key Rules & Calibration:
  - In Arabic (RTL reading order):
      * Ayah N (earlier verse) is on the right of the split, ending with its marker circle.
      * Ayah N+1 (next verse) starts on the left of the split, after Ayah N's marker circle.
      * In the master database (hafs_1421.db), split_x was placed at (marker_x - 28),
        which cut through the middle of the marker circle.
      * By shifting split_x leftwards into the whitespace gap (marker_x - 65, approx split_x - 45),
        Ayah N (right segment) fully includes its own decorative marker circle,
        and Ayah N+1 (left segment) starts cleanly after the circle without highlighting it.
  - Page 1 (Al-Fatiha) and Page 2 (Al-Baqarah start) use dedicated 1:1 pixel-measured bounds.
"""

import sqlite3
import json
import os

DB_PATH = '/tmp/hafs_1421.db'
OUTPUT_JSON = 'src/data/quran/ayahBounds.json'

def make_rounded_rect(x1: float, y1: float, x2: float, y2: float, r: float = 6) -> str:
    x1, y1, x2, y2 = round(x1), round(y1), round(x2), round(y2)
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
        raise FileNotFoundError(f"Database {DB_PATH} not found.")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    compiled = {}

    # Page 1: Surah Al-Fatiha (980x1024)
    compiled['1'] = {
        'v': '0 0 980 1024',
        'b': [
            {'s': 1, 'a': 1, 'd': make_rounded_rect(210, 144, 800, 262, r=10)},
            {'s': 1, 'a': 2, 'd': make_rounded_rect(105, 265, 913, 372, r=10)},
            {'s': 1, 'a': 3, 'd': make_rounded_rect(525, 394, 914, 482, r=10)},
            {'s': 1, 'a': 4, 'd': make_rounded_rect(106, 394, 520, 482, r=10)},
            {'s': 1, 'a': 5, 'd': make_rounded_rect(230, 510, 917, 595, r=10)},
            {'s': 1, 'a': 6, 'd': f"{make_rounded_rect(92, 510, 225, 595, r=10)} {make_rounded_rect(460, 630, 852, 715, r=10)}"},
            {'s': 1, 'a': 7, 'd': f"{make_rounded_rect(161, 630, 455, 715, r=10)} {make_rounded_rect(260, 745, 759, 835, r=10)} {make_rounded_rect(373, 882, 660, 970, r=10)}"},
        ]
    }

    # Page 2: Surah Al-Baqarah (1024x990)
    compiled['2'] = {
        'v': '0 0 1024 990',
        'b': [
            {'s': 2, 'a': 1, 'd': make_rounded_rect(690, 325, 896, 410, r=10)},
            {'s': 2, 'a': 2, 'd': f"{make_rounded_rect(136, 325, 685, 410, r=10)} {make_rounded_rect(670, 425, 896, 515, r=10)}"},
            {'s': 2, 'a': 3, 'd': f"{make_rounded_rect(140, 425, 665, 515, r=10)} {make_rounded_rect(480, 540, 895, 630, r=10)}"},
            {'s': 2, 'a': 4, 'd': f"{make_rounded_rect(149, 540, 475, 630, r=10)} {make_rounded_rect(174, 650, 865, 745, r=10)}"},
            {'s': 2, 'a': 5, 'd': f"{make_rounded_rect(274, 742, 768, 860, r=10)} {make_rounded_rect(414, 885, 635, 968, r=10)}"},
        ]
    }

    # Pages 3 through 604
    for p in range(3, 605):
        cur.execute('''
            SELECT sura_number, ayah_number, line_number, min_x, max_x, min_y, max_y
            FROM glyphs
            WHERE page_number = ?
            ORDER BY line_number, min_x
        ''', (p,))
        rows = cur.fetchall()

        line_groups = {}
        for r in rows:
            line_num = r[2]
            line_groups.setdefault(line_num, []).append(list(r))

        for line_num, segs in line_groups.items():
            if len(segs) > 1:
                for i in range(len(segs) - 1):
                    left_seg = segs[i]       # Ayah N+1 (small x)
                    right_seg = segs[i + 1]  # Ayah N (large x, ending with marker)
                    split_x = left_seg[4]
                    left_min_x = left_seg[3]

                    available = split_x - left_min_x
                    if available >= 90:
                        shift = 48
                    elif available >= 60:
                        shift = 38
                    elif available >= 40:
                        shift = 25
                    else:
                        shift = max(0, available - 15)

                    new_split = split_x - shift
                    left_seg[4] = new_split
                    right_seg[3] = new_split

        ayah_map = {}
        for line_num in sorted(line_groups.keys()):
            for sura, ayah, line, min_x, max_x, min_y, max_y in line_groups[line_num]:
                key = (sura, ayah)
                ayah_map.setdefault(key, []).append(make_rounded_rect(min_x, min_y, max_x, max_y, r=6))

        page_ayahs = [{'s': s, 'a': a, 'd': ' '.join(paths)} for (s, a), paths in sorted(ayah_map.items())]
        compiled[str(p)] = {'v': '0 0 1120 1812', 'b': page_ayahs}

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(compiled, f, separators=(',', ':'))

    print(f"Calibrated bounds written to {OUTPUT_JSON} for {len(compiled)} pages.")

if __name__ == '__main__':
    calibrate_all_pages()
