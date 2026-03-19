import { normalizeArabicText } from './src/utils/arabic';

let t = "يَسۡـَٔلُونَكَ";
t = t.replace(/[\u0654\u0655]/g, 'ا');
t = t.replace(/[\u0617-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '');
t = t.replace(/ـ/g, '');
t = t.replace(/اا+/g, 'ا');
console.log(t);
