/**
 * Surah-name challenge ("ما اسم السورة؟") in group rooms:
 *  1) no right / wrong (and no bonus) before the confirm button
 *  2) one evaluation per question, with what the player typed last
 *  3) a list button to pick the surah (phones have no usable <datalist>)
 *  4) room updates do not empty the input; only a new question does
 *  5) no auto-submit -> no move to the next question before confirm
 *   node --import tsx --test tests/surah-challenge.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { filterSurahNames } from '../src/utils/surahPicker.ts';
import { quranData } from '../src/services/QuranRepository.ts';
import { SurahChallengeUI } from '../src/components/challenge/SurahChallengeUI.tsx';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const ctx = read('../src/contexts/AppContext.tsx');
const body = (name: string) => {
  const start = ctx.indexOf(`  const ${name} = (`);
  assert.ok(start > 0, name);
  return ctx.slice(start, ctx.indexOf('\n  };\n', start));
};

const render = (props: Record<string, any>) =>
  renderToStaticMarkup(React.createElement(SurahChallengeUI as any, {
    verseText: 'آية', inputs: ['سورة البقرة'], onInputChange: () => {}, onSubmit: () => {},
    feedback: false, isRoom: true, isMultiplayer: true, ...props,
  }));

describe('1 + 5: nothing is judged before confirm', () => {
  it('room typing handler: only stores the text (no submit, no timer, no points, no toast)', () => {
    for (const name of ['handleSurahInputChangeBonus', 'handleSurahBonusInputChange']) {
      const src = body(name);
      assert.doesNotMatch(src, /handleSubmitSurah|setTimeout|addPoint|toast\.|setDiscoveredBonusSurahs/, name);
    }
  });

  it('a correct answer typed but not confirmed shows no result', () => {
    const html = render({ feedback: false, surahFeedbackData: { isFullyCorrect: true, correctSurahs: ['البقرة'] } });
    assert.doesNotMatch(html, /إجابة صحيحة|إجابة غير صحيحة/);
    assert.doesNotMatch(html, /border-emerald-500|border-red-500/);
  });

  it('after confirm the result is shown', () => {
    const html = render({ feedback: true, surahFeedbackData: { isFullyCorrect: true, correctSurahs: ['البقرة'] } });
    assert.match(html, /إجابة صحيحة/);
  });
});

describe('2: one evaluation, with the latest input', () => {
  it('handleSubmitSurah reads the latest inputs and runs once per question', () => {
    const src = body('handleSubmitSurah');
    assert.match(src, /if \(!currentQuestion \|\| skillsFeedback \|\| surahSubmitLockRef\.current\) return;/);
    assert.match(src, /surahSubmitLockRef\.current = true;/);
    assert.match(src, /const surahInputs = surahInputsRef\.current;/);
    assert.match(ctx, /surahInputsRef\.current = surahInputs;/);
  });

  it('the lock is released for a new question', () => {
    assert.match(ctx, /if \(!skillsFeedback\) surahSubmitLockRef\.current = false;/);
    assert.match(ctx, /if \(currentChallenge && isSurahMode\) \{\n\s+surahSubmitLockRef\.current = false;/);
  });

  it('latest-input ref vs. stale closure (why answers were counted wrong)', () => {
    // A timer created while typing kept the render's inputs: the last letter was missing.
    let state = ['سورة البقر'];
    const ref = { current: state };
    const staleClosureInputs = state;
    state = ['سورة البقرة']; ref.current = state; // next render
    assert.equal(staleClosureInputs[0], 'سورة البقر');
    assert.equal(ref.current[0], 'سورة البقرة');
  });
});

describe('3: pick the surah from a list (phone and desktop)', () => {
  it('every answer box (and the bonus box) has a list button', () => {
    const html = render({ inputs: ['', ''], hasBonusField: true, bonusInput: '' });
    assert.equal((html.match(/aria-label="اختر السورة من القائمة"/g) || []).length, 3);
  });

  it('no list button once the answer is confirmed', () => {
    const html = render({ feedback: true });
    assert.doesNotMatch(html, /اختر السورة من القائمة/);
  });

  it('the list holds all 114 surahs and filters by what was typed', () => {
    assert.equal(filterSurahNames('', quranData as any).length, 114);
    assert.deepEqual(filterSurahNames('سورة البقره', quranData as any).map((s) => s.name), ['البقرة']);
    assert.ok(filterSurahNames('ال', quranData as any).length > 10);
    assert.equal(filterSurahNames('ققق', quranData as any).length, 0);
  });
});

describe('4: room updates do not empty the input', () => {
  it('inputs are reset on a new question only (not on every room / challenge object change)', () => {
    assert.match(ctx, /\}, \[currentChallenge\?\.id, currentChallengeIndex, skillsType, room\?\.gameMode, view, selectedSkillJuzs, selectedSkillSurahs, selectedJuz, room\?\.id\]\);/);
    assert.doesNotMatch(ctx, /selectedSkillSurahs, selectedJuz, room\]\);/);
  });
});
