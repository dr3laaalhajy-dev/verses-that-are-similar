import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { verifyAdminToken } from './_lib/jwt.js'

const mapChallenges = (challenges: any[]) => 
  (challenges || []).map(c => {
    let category = c.category || '';
    if (!category && c.type === 'COMPLETION' && Array.isArray(c.verses) && c.verses[0]?.surah) {
      const v = c.verses[0];
      const sName = String(v.surah).replace(/^سورة\s+/, '').trim();
      const jNum = v.juz;
      category = jNum ? `سورة ${sName} - الجزء ${jNum}` : `سورة ${sName}`;
    }
    return { 
      ...c, 
      category,
      verseText: c.verseText || c.keyword || c.text || '',
      text: c.verseText || c.keyword || c.text || '' 
    };
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // If id is provided in query or path (rewritten as ?id=...), handle single challenge
  const id = req.query.id as string | undefined;

  if (id) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    try {
      verifyAdminToken(token)
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    // Protected PUT
    if (req.method === 'PUT') {
      const { keyword, verses, category, level, type, audioUrl, options, correctText } = req.body
      try {
        const updateData: any = {};
        if (keyword !== undefined) updateData.keyword = keyword;
        if (verses !== undefined) updateData.verses = verses;
        if (category !== undefined) updateData.category = category;
        if (level !== undefined) updateData.level = level;
        if (type !== undefined) updateData.type = type;
        if (audioUrl !== undefined) updateData.audioUrl = audioUrl;
        if (options !== undefined) updateData.options = options;
        if (correctText !== undefined) updateData.correctText = correctText;
        updateData.updatedAt = new Date().toISOString();

        const { data: challenge, error } = await supabaseAdmin
          .from('challenges')
          .update(updateData)
          .eq('id', Number(id))
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json(challenge)
      } catch (error: any) {
        console.error('Update Challenge API Crash:', {
          id,
          message: error.message,
          stack: error.stack
        })
        return res.status(500).json({ 
          message: 'Failed to update challenge',
          error: error.message 
        })
      }
    }

    // Protected DELETE
    if (req.method === 'DELETE') {
      try {
        const { error } = await supabaseAdmin
          .from('challenges')
          .delete()
          .eq('id', Number(id));

        if (error) throw error;
        return res.status(200).json({ message: 'Challenge deleted successfully' })
      } catch (error: any) {
        console.error('Delete Challenge API Crash:', {
          id,
          message: error.message,
          stack: error.stack
        })
        return res.status(500).json({ 
          message: 'Failed to delete challenge',
          error: error.message 
        })
      }
    }

    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Public GET
  if (req.method === 'GET') {
    const { type, limit, excludeIds, category } = req.query
    
    // Parse parameters robustly
    const effectiveType = Array.isArray(type) ? type[0] : (type as string)
    const rawLimit = Array.isArray(limit) ? limit[0] : (limit as string)
    const take = rawLimit ? parseInt(rawLimit) : undefined
    const effectiveCategory = Array.isArray(category) ? category[0] : (category as string)

    let excluded: number[] = []
    if (excludeIds) {
      const rawExclude = Array.isArray(excludeIds) ? excludeIds[0] : (excludeIds as string)
      excluded = rawExclude.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    }

    try {
      // Check system settings for hidden challenge types
      let hiddenTypes: string[] = [];
      try {
        const { data: setting } = await supabaseAdmin.from('system_settings').select('*').eq('id', 1).maybeSingle();
        if (setting?.hideAudioChallenge) hiddenTypes.push('AUDIO');
        if (setting?.hideCompletionChallenge) hiddenTypes.push('COMPLETION');
        if (setting?.hideSurahChallenge) hiddenTypes.push('SURAH');
      } catch (e) {
        // Fallback silently if table not ready
      }

      let query = supabaseAdmin.from('challenges').select('*');
      
      if (effectiveType) {
        query = query.eq('type', effectiveType);
      } else if (hiddenTypes.length > 0) {
        // Exclude hidden types
        query = query.not('type', 'in', `(${hiddenTypes.map(t => `"${t}"`).join(',')})`);
      }

      if (excluded.length > 0) {
        query = query.not('id', 'in', `(${excluded.join(',')})`);
      }

      if (effectiveCategory) {
        query = query.eq('category', effectiveCategory);
      }

      query = query.order('id', { ascending: false });

      if (take) {
        query = query.limit(take);
      }

      const { data: challenges, error } = await query;
      if (error) throw error;
      
      const mapped = mapChallenges(challenges || []);
      return res.status(200).json(mapped)
    } catch (error: any) {
      console.error('Fetch Challenges API Crash:', {
        type: effectiveType,
        limit: take,
        category: effectiveCategory,
        message: error.message,
        stack: error.stack
      })
      return res.status(500).json({ 
        message: 'Failed to fetch challenges',
        error: error.message 
      })
    }
  }

  // Protected POST (Admin Only)
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    try {
      verifyAdminToken(token)
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const { keyword, verses, category, level, type, audioUrl, options, correctText } = req.body
    
    // Auto-detect juz and surah from verses
    let juz: number | null = null;
    let surah: string | null = null;
    if (Array.isArray(verses) && verses.length > 0) {
      const v0 = verses[0];
      if (v0.juz) juz = Number(v0.juz);
      if (v0.surah) surah = String(v0.surah);
    }

    try {
      const { data: challenge, error } = await supabaseAdmin
        .from('challenges')
        .insert({
          keyword: keyword || '',
          verses: verses || [],
          category: category || '',
          level: level || '',
          type: type || 'STANDARD',
          audioUrl: audioUrl || null,
          options: options || null,
          correctText: correctText || null,
          juz,
          surah
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(challenge)
    } catch (error: any) {
      console.error('Create Challenge API Crash:', {
        body: req.body,
        message: error.message,
        stack: error.stack
      })
      return res.status(500).json({ 
        message: 'Failed to create challenge',
        error: error.message 
      })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
