import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hexxbopfvbuliakufejj.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhleHhib3BmdmJ1bGlha3VmZWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMzA1MjYsImV4cCI6MjEwODgwNjUyNn0.-JG3tJo4PJrxtaHI9MC9fXQKR1AZ60GY5b-OJOFNSZo';

const supabase = createClient(supabaseUrl, supabaseKey);

// Fisher-Yates Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ==========================================
    // GET Requests
    // ==========================================
    if (req.method === 'GET') {
      const action = req.query.action as string;

      // 1. Get Categories with Counts
      if (action === 'categories' || !action) {
        let dbCategories = await prisma.whoAmICategory.findMany({
          orderBy: { created_at: 'asc' }
        });

        // Ensure defaults if table was empty
        if (dbCategories.length === 0) {
          const defaults = [
            { name: 'الصحابة', description: 'أسئلة وتلميحات عن صحابة رسول الله ﷺ', icon: 'Users' },
            { name: 'الأنبياء', description: 'أسئلة وتلميحات عن أنبياء ورسل الله عليهم السلام', icon: 'Sparkles' },
            { name: 'العلماء', description: 'أسئلة وتلميحات عن أئمة الإسلام والفقهاء والمحدثين', icon: 'BookOpen' },
            { name: 'الغزوات', description: 'أسئلة وتلميحات عن غزوات ومعارك التاريخ الإسلامي', icon: 'Shield' }
          ];
          for (const d of defaults) {
            await prisma.whoAmICategory.upsert({
              where: { name: d.name },
              update: {},
              create: d
            });
          }
          dbCategories = await prisma.whoAmICategory.findMany({
            orderBy: { created_at: 'asc' }
          });
        }

        // Get question counts per category from Prisma
        const counts = await prisma.whoAmIQuestion.groupBy({
          by: ['category'],
          _count: { id: true }
        });

        const countMap = new Map<string, number>();
        counts.forEach(c => {
          countMap.set(c.category, c._count.id);
        });

        const categoriesWithCount = dbCategories.map(cat => ({
          ...cat,
          count: countMap.get(cat.name) || 0
        }));

        return res.status(200).json({ categories: categoriesWithCount });
      }

      // 2. Get Questions (Optionally filtered by category and search)
      if (action === 'questions') {
        const category = req.query.category as string | undefined;
        const search = (req.query.search as string || '').trim();

        const where: any = {};
        if (category && category !== 'ALL') {
          where.category = category;
        }
        if (search) {
          where.OR = [
            { hint_1: { contains: search, mode: 'insensitive' } },
            { hint_2: { contains: search, mode: 'insensitive' } },
            { answer: { contains: search, mode: 'insensitive' } }
          ];
        }

        const questions = await prisma.whoAmIQuestion.findMany({
          where,
          orderBy: { created_at: 'desc' }
        });

        return res.status(200).json({ questions });
      }

      return res.status(400).json({ error: 'Action غير معروف' });
    }

    // ==========================================
    // POST Requests
    // ==========================================
    if (req.method === 'POST') {
      const { action } = req.body || {};

      // 1. Add Category
      if (action === 'add-category') {
        const { name, description, icon } = req.body;
        if (!name || !name.trim()) {
          return res.status(400).json({ error: 'اسم الفئة مطلوب' });
        }

        const trimmedName = name.trim();
        const category = await prisma.whoAmICategory.create({
          data: {
            name: trimmedName,
            description: description?.trim() || null,
            icon: icon?.trim() || 'HelpCircle'
          }
        });

        // Sync to Supabase if table exists
        try {
          await supabase.from('who_am_i_categories').upsert({
            name: trimmedName,
            description: description?.trim() || null,
            icon: icon?.trim() || 'HelpCircle'
          });
        } catch (e) {
          // ignore error if Supabase table not present yet
        }

        return res.status(200).json({ success: true, category });
      }

      // 2. Update Category
      if (action === 'update-category') {
        const { id, name, description, icon } = req.body;
        if (!id || !name || !name.trim()) {
          return res.status(400).json({ error: 'المعرف واسم الفئة مطلوبان' });
        }

        const oldCategory = await prisma.whoAmICategory.findUnique({ where: { id } });
        const trimmedName = name.trim();

        const updated = await prisma.whoAmICategory.update({
          where: { id },
          data: {
            name: trimmedName,
            description: description !== undefined ? description?.trim() || null : undefined,
            icon: icon !== undefined ? icon?.trim() || null : undefined
          }
        });

        // If name changed, update questions in that category
        if (oldCategory && oldCategory.name !== trimmedName) {
          await prisma.whoAmIQuestion.updateMany({
            where: { category: oldCategory.name },
            data: { category: trimmedName }
          });

          try {
            await supabase
              .from('who_am_i_questions')
              .update({ category: trimmedName })
              .eq('category', oldCategory.name);
          } catch (e) {}
        }

        return res.status(200).json({ success: true, category: updated });
      }

      // 3. Delete Category
      if (action === 'delete-category') {
        const { id, name } = req.body;
        if (!id && !name) {
          return res.status(400).json({ error: 'المعرف أو اسم الفئة مطلوب' });
        }

        const where = id ? { id } : { name };
        const cat = await prisma.whoAmICategory.findUnique({ where });
        if (cat) {
          await prisma.whoAmICategory.delete({ where: { id: cat.id } });
          try {
            await supabase.from('who_am_i_categories').delete().eq('name', cat.name);
          } catch (e) {}
        }

        return res.status(200).json({ success: true });
      }

      // 4. Add Question
      if (action === 'add-question') {
        const { category, hint_1, hint_2, answer } = req.body;
        if (!hint_1?.trim() || !hint_2?.trim() || !answer?.trim()) {
          return res.status(400).json({ error: 'جميع حقول السؤال (التلميح الأول، الثاني، والإجابة) مطلوبة' });
        }

        const question = await prisma.whoAmIQuestion.create({
          data: {
            category: (category || 'الصحابة').trim(),
            hint_1: hint_1.trim(),
            hint_2: hint_2.trim(),
            answer: answer.trim()
          }
        });

        // Sync to Supabase
        try {
          await supabase.from('who_am_i_questions').insert({
            id: question.id,
            category: question.category,
            hint_1: question.hint_1,
            hint_2: question.hint_2,
            answer: question.answer
          });
        } catch (e) {
          console.warn('[Sync to Supabase warning]:', e);
        }

        return res.status(200).json({ success: true, question });
      }

      // 5. Update Question
      if (action === 'update-question') {
        const { id, category, hint_1, hint_2, answer } = req.body;
        if (!id) {
          return res.status(400).json({ error: 'معرف السؤال مطلوب' });
        }

        const updated = await prisma.whoAmIQuestion.update({
          where: { id },
          data: {
            category: category ? category.trim() : undefined,
            hint_1: hint_1 ? hint_1.trim() : undefined,
            hint_2: hint_2 ? hint_2.trim() : undefined,
            answer: answer ? answer.trim() : undefined
          }
        });

        try {
          await supabase.from('who_am_i_questions').update({
            category: updated.category,
            hint_1: updated.hint_1,
            hint_2: updated.hint_2,
            answer: updated.answer
          }).eq('id', id);
        } catch (e) {}

        return res.status(200).json({ success: true, question: updated });
      }

      // 6. Delete Question
      if (action === 'delete-question') {
        const { id } = req.body;
        if (!id) {
          return res.status(400).json({ error: 'معرف السؤال مطلوب' });
        }

        await prisma.whoAmIQuestion.delete({ where: { id } });
        try {
          await supabase.from('who_am_i_questions').delete().eq('id', id);
        } catch (e) {}

        return res.status(200).json({ success: true });
      }

      // 7. Get Mixed Questions based on categories_config
      // Example payload: { action: 'get-mixed-questions', categories_config: [{ category: 'الصحابة', count: 3 }, { category: 'الأنبياء', count: 2 }] }
      if (action === 'get-mixed-questions') {
        const categories_config: Array<{ category: string; count: number }> = req.body.categories_config || [];
        
        let allPickedQuestions: any[] = [];

        for (const conf of categories_config) {
          const reqCount = Math.max(1, Number(conf.count) || 1);
          // Fetch questions for this category
          const available = await prisma.whoAmIQuestion.findMany({
            where: { category: conf.category }
          });

          if (available.length > 0) {
            const shuffled = shuffleArray(available);
            const picked = shuffled.slice(0, reqCount);
            allPickedQuestions.push(...picked);
          }
        }

        // Shuffle all collected questions so they are not grouped by category
        const finalQuestions = shuffleArray(allPickedQuestions);

        return res.status(200).json({ questions: finalQuestions });
      }

      return res.status(400).json({ error: 'Action غير معروف' });
    }

    return res.status(405).json({ error: 'طريقة الطلب غير مدعومة' });
  } catch (error: any) {
    console.error('[API who-am-i error]:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ في الخادم' });
  }
}

