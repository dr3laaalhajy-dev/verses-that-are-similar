import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from './_lib/prisma.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

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
      jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    // Protected PUT
    if (req.method === 'PUT') {
      const { keyword, verses, category, level, type, audioUrl, options, correctText } = req.body
      try {
        const challenge = await prisma.challenge.update({
          where: { id: Number(id) },
          data: { 
            keyword, 
            verses,
            category: category !== undefined ? category : undefined,
            level: level !== undefined ? level : undefined,
            type: type !== undefined ? type : undefined,
            audioUrl: audioUrl !== undefined ? audioUrl : undefined,
            options: options !== undefined ? options : undefined,
            correctText: correctText !== undefined ? correctText : undefined,
          }
        })
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
        await prisma.challenge.delete({
          where: { id: Number(id) }
        })
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
        const setting = await prisma.systemSetting.findUnique({ where: { id: 1 } });
        if (setting?.hideAudioChallenge) hiddenTypes.push('AUDIO');
        if (setting?.hideCompletionChallenge) hiddenTypes.push('COMPLETION');
        if (setting?.hideSurahChallenge) hiddenTypes.push('SURAH');
      } catch (e) {
        // Fallback silently if table not ready
      }

      const where: any = {}
      
      if (effectiveType) {
        where.type = effectiveType;
      } else if (hiddenTypes.length > 0) {
        where.type = { notIn: hiddenTypes };
      }

      if (excluded.length > 0) {
        where.id = { notIn: excluded }
      }

      if (effectiveCategory) {
        where.category = effectiveCategory;
      }

      const challenges = await prisma.challenge.findMany({
        where,
        take,
        orderBy: {
          id: 'desc'
        }
      })
      
      const mapped = mapChallenges(challenges);
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
      jwt.verify(token, JWT_SECRET)
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
      const challenge = await prisma.challenge.create({
        data: {
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
        }
      })
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
