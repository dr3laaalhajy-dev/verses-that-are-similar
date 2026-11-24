import { normalizeArabicText, normalizeSurahName } from './arabic';

/**
 * Surah names for the "pick from the list" panel of the surah-name challenge, filtered by what the
 * player has typed so far ("سورة" and Arabic spelling variants ignored). Empty query: all of them.
 */
export function filterSurahNames(query: string, surahs: { id: any; name: string }[]): { id: any; name: string }[] {
  const q = normalizeSurahName(query || '');
  if (!q) return surahs;
  return surahs.filter((s) => normalizeArabicText(s.name).includes(q));
}
