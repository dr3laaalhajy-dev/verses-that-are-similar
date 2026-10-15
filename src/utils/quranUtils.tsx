import React from 'react';

/**
 * Normalizes Quranic Uthmanic diacritics to standard Arabic tashkeel:
 * - Converts Uthmani sequential Dammatan (U+065E) and open Dammatan (U+08F1) which render as '%' into standard Arabic Dammatan (ٌ, U+064C).
 * - Converts Uthmani open Fathatan (U+08F0) into standard Arabic Fathatan (ً, U+064B).
 * - Converts Uthmani open Kasratan (U+08F2) into standard Arabic Kasratan (ٍ, U+064D).
 * - Converts Quranic head-of-khah sukoon (U+06E1) into standard Arabic Sukoon (ْ, U+0652).
 * - Cleans up Quranic waqf / pause marks (U+06D6-U+06DC) like small high jeem, salla, qala that look like floating letters.
 * - Cleans up stray Quranic annotations and zero marks (U+06DF-U+06ED).
 */
export const normalizeQuranTashkeel = (text: string): string => {
  if (!text) return '';
  return text
    // Replace sequential/open tanween (which often render as % or odd glyphs) with standard Arabic tanween
    .replace(/\u065E/g, '\u064C') // ARABIC FATHA WITH TWO DOTS / Quranic sequential Dammatan (looks like %) -> standard Dammatan ٌ
    .replace(/\u08F1/g, '\u064C') // ARABIC OPEN DAMMATAN -> standard Dammatan ٌ
    .replace(/\u08F0/g, '\u064B') // ARABIC OPEN FATHATAN -> standard Fathatan ً
    .replace(/\u08F2/g, '\u064D') // ARABIC OPEN KASRATAN -> standard Kasratan ٍ
    // Replace Quranic head-of-khah sukoon with standard Arabic sukoon
    .replace(/\u06E1/g, '\u0652') // ARABIC SMALL HIGH DOTLESS HEAD OF KHAH -> standard Sukoon ْ
    // Clean up Quranic waqf / pause marks (small high jeem, salla, qala, etc.)
    .replace(/[\u06D6-\u06DC]/g, '')
    // Clean up Quranic annotations and stray zero marks
    .replace(/[\u06DF-\u06E0]/g, '')
    .replace(/[\u06E2-\u06E9]/g, '')
    .replace(/[\u06EA-\u06ED]/g, '');
};

/**
 * Highlights the name of Allah in red within the given Quranic text.
 * Matches common variations found in the Quran.
 */
export const renderQuranText = (text: string) => {
  if (!text) return null;
  const normalized = normalizeQuranTashkeel(text);

  // Pattern to match variations of "Allah" with vocalization
  // Matches: الله, اللَّه, لِلَّه, بِاللَّه, وَاللَّه, فَاللَّه, ٱللَّه, إلخ
  const allahRegex = /((?:اللَّه|لِلَّهِ?|بِاللَّهِ?|تَالاللَّهِ|فَاللَّهُ?|وَاللَّهُ?|اللَّهُمَّ?|أَاللَّهُ?|ٱللَّهِ?|بِٱللَّهِ?|وَٱللَّهُ?|فَٱللَّهُ?|تَٱللَّهِ?)(?:ُ|ِ|َ)?)/g;

  // Split and map
  const parts = normalized.split(allahRegex);

  return (
    <>
      {parts.map((part, index) => {
        // If this part is one of the matches, wrap in red
        if (part.match(allahRegex)) {
          return (
            <span key={index} className="word-allah">
              {part}
            </span>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};
