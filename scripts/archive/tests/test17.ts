import { normalizeArabicText } from './src/utils/arabic';

let t = "مُوسَىٰٓ";
t = t.replace(/ى\u0670/g, 'ي');
t = t.replace(/\u0670/g, 'ا');
t = t.replace(/[\u0617-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '');
t = t.replace(/[أإآٱء]/g, 'ا');
t = t.replace(/ة/g, 'ه');
t = t.replace(/ى/g, 'ي');
t = t.replace(/ؤ/g, 'و');
t = t.replace(/ئ/g, 'ي');
t = t.replace(/ـ/g, '');
t = t.replace(/اا+/g, 'ا');
console.log(t);
