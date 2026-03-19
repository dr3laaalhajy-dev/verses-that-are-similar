import quranData from 'quran-json/dist/quran.json';

const baqarah = (quranData as any[]).find(s => s.id === 2);
const verse189 = baqarah.verses.find((v: any) => v.id === 189);
console.log(verse189.text);
