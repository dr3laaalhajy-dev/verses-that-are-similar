import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin as supabase } from './_lib/supabaseAdmin.js';

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
        let { data: dbCategories, error: catErr } = await supabase
          .from('who_am_i_categories')
          .select('*')
          .order('created_at', { ascending: true });

        // Ensure defaults if table was empty
        if (!dbCategories || dbCategories.length === 0) {
          const defaults = [
            { name: 'الصحابة', description: 'أسئلة وتلميحات عن صحابة رسول الله ﷺ', icon: 'Users' },
            { name: 'الأنبياء', description: 'أسئلة وتلميحات عن أنبياء ورسل الله عليهم السلام', icon: 'Sparkles' },
            { name: 'العلماء', description: 'أسئلة وتلميحات عن أئمة الإسلام والفقهاء والمحدثين', icon: 'BookOpen' },
            { name: 'الغزوات', description: 'أسئلة وتلميحات عن غزوات ومعارك التاريخ الإسلامي', icon: 'Shield' }
          ];

          for (const d of defaults) {
            await supabase
              .from('who_am_i_categories')
              .upsert(d, { onConflict: 'name' });
          }

          const refetch = await supabase
            .from('who_am_i_categories')
            .select('*')
            .order('created_at', { ascending: true });
          dbCategories = refetch.data || [];
        }

        // Get question counts per category from Supabase
        const { data: questions } = await supabase
          .from('who_am_i_questions')
          .select('category');

        const countMap = new Map<string, number>();
        (questions || []).forEach((q: any) => {
          if (q.category) {
            countMap.set(q.category, (countMap.get(q.category) || 0) + 1);
          }
        });

        const categoriesWithCount = (dbCategories || []).map((cat: any) => ({
          ...cat,
          count: countMap.get(cat.name) || 0
        }));

        return res.status(200).json({ categories: categoriesWithCount });
      }

      // 2. Get Questions (Optionally filtered by category and search)
      if (action === 'questions') {
        const category = req.query.category as string | undefined;
        const search = (req.query.search as string || '').trim();

        let query = supabase
          .from('who_am_i_questions')
          .select('*')
          .order('created_at', { ascending: false });

        if (category && category !== 'ALL') {
          query = query.eq('category', category);
        }

        if (search) {
          query = query.or(`hint_1.ilike.%${search}%,hint_2.ilike.%${search}%,answer.ilike.%${search}%`);
        }

        const { data: questions, error } = await query;
        if (error) throw error;

        return res.status(200).json({ questions: questions || [] });
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
        const { data: category, error } = await supabase
          .from('who_am_i_categories')
          .insert({
            name: trimmedName,
            description: description?.trim() || null,
            icon: icon?.trim() || 'HelpCircle'
          })
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({ success: true, category });
      }

      // 2. Update Category
      if (action === 'update-category') {
        const { id, name, description, icon } = req.body;
        if (!id || !name || !name.trim()) {
          return res.status(400).json({ error: 'المعرف واسم الفئة مطلوبان' });
        }

        const { data: oldCategory } = await supabase
          .from('who_am_i_categories')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        const trimmedName = name.trim();

        const { data: updated, error } = await supabase
          .from('who_am_i_categories')
          .update({
            name: trimmedName,
            description: description !== undefined ? description?.trim() || null : undefined,
            icon: icon !== undefined ? icon?.trim() || null : undefined
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        // If name changed, update questions in that category
        if (oldCategory && oldCategory.name !== trimmedName) {
          await supabase
            .from('who_am_i_questions')
            .update({ category: trimmedName })
            .eq('category', oldCategory.name);
        }

        return res.status(200).json({ success: true, category: updated });
      }

      // 3. Delete Category
      if (action === 'delete-category') {
        const { id, name } = req.body;
        if (!id && !name) {
          return res.status(400).json({ error: 'المعرف أو اسم الفئة مطلوب' });
        }

        let q = supabase.from('who_am_i_categories').delete();
        if (id) {
          q = q.eq('id', id);
        } else {
          q = q.eq('name', name);
        }
        const { error } = await q;
        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      // 4. Add Question
      if (action === 'add-question') {
        const { category, hint_1, hint_2, answer } = req.body;
        if (!hint_1?.trim() || !hint_2?.trim() || !answer?.trim()) {
          return res.status(400).json({ error: 'جميع حقول السؤال (التلميح الأول، الثاني، والإجابة) مطلوبة' });
        }

        const { data: question, error } = await supabase
          .from('who_am_i_questions')
          .insert({
            category: (category || 'الصحابة').trim(),
            hint_1: hint_1.trim(),
            hint_2: hint_2.trim(),
            answer: answer.trim()
          })
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({ success: true, question });
      }

      // 5. Update Question
      if (action === 'update-question') {
        const { id, category, hint_1, hint_2, answer } = req.body;
        if (!id) {
          return res.status(400).json({ error: 'معرف السؤال مطلوب' });
        }

        const { data: updated, error } = await supabase
          .from('who_am_i_questions')
          .update({
            category: category ? category.trim() : undefined,
            hint_1: hint_1 ? hint_1.trim() : undefined,
            hint_2: hint_2 ? hint_2.trim() : undefined,
            answer: answer ? answer.trim() : undefined
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return res.status(200).json({ success: true, question: updated });
      }

      // 6. Delete Question
      if (action === 'delete-question') {
        const { id } = req.body;
        if (!id) {
          return res.status(400).json({ error: 'معرف السؤال مطلوب' });
        }

        const { error } = await supabase
          .from('who_am_i_questions')
          .delete()
          .eq('id', id);

        if (error) throw error;

        return res.status(200).json({ success: true });
      }

      // 7. Get Mixed Questions based on categories_config
      if (action === 'get-mixed-questions') {
        const categories_config: Array<{ category: string; count: number }> = req.body.categories_config || [];
        let allPickedQuestions: any[] = [];

        for (const conf of categories_config) {
          const reqCount = Math.max(1, Number(conf.count) || 1);
          const { data } = await supabase
            .from('who_am_i_questions')
            .select('*')
            .eq('category', conf.category);

          if (data && data.length > 0) {
            const shuffled = shuffleArray(data);
            const picked = shuffled.slice(0, reqCount);
            allPickedQuestions.push(...picked);
          }
        }

        // Shuffle all collected questions
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
