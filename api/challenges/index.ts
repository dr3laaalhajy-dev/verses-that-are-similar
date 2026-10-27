import type { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../_lib/prisma.js'
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

      if (effectiveType && hiddenTypes.includes(effectiveType) && req.query.adminView !== 'true') {
        return res.status(200).json([]);
      }

      const where: any = {};
      if (effectiveType) {
        where.type = effectiveType;
      } else if (hiddenTypes.length > 0 && req.query.adminView !== 'true') {
        where.type = { notIn: hiddenTypes };
      }
      if (effectiveCategory && effectiveCategory !== 'all' && effectiveCategory.trim() !== '') {
        where.category = { contains: effectiveCategory.trim(), mode: 'insensitive' };
      }
      if (excluded.length > 0) where.id = { notIn: excluded };

      console.log('Fetching challenges with query:', JSON.stringify(where));

      let challenges: any[] = [];
      if (take && req.query.adminView !== 'true') {
        const matching = await prisma.challenge.findMany({
          where,
          select: { id: true }
        });
        const shuffledIds = matching.map(m => m.id).sort(() => Math.random() - 0.5);
        const sampledIds = shuffledIds.slice(0, take);

        if (sampledIds.length > 0) {
          const selected = await prisma.challenge.findMany({
            where: { id: { in: sampledIds } },
            select: {
              id: true,
              keyword: true,
              verses: true,
              category: true,
              level: true,
              type: true,
              audioUrl: true,
              options: true,
              correctText: true,
              createdAt: true,
              updatedAt: true
            }
          });
          const idMap = new Map(selected.map(item => [item.id, item]));
          challenges = sampledIds.map(id => idMap.get(id)).filter(Boolean);
        }
      } else {
        challenges = await prisma.challenge.findMany({
          where,
          select: {
            id: true,
            keyword: true,
            verses: true,
            category: true,
            level: true,
            type: true,
            audioUrl: true,
            options: true,
            correctText: true,
            createdAt: true,
            updatedAt: true
          },
          take: isNaN(take as any) ? undefined : take,
          orderBy: { createdAt: 'desc' }
        });
      }
      return res.status(200).json(mapChallenges(challenges) || [])
    } catch (error: any) {
      console.error('Fetch Challenges API Crash:', {
        query: req.query,
        message: error.message,
        stack: error.stack
      })
      return res.status(500).json({ 
        message: 'Internal Server Error: Failed to fetch challenges',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }

  // Protected POST (Admin only)
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    try {
      jwt.verify(token, JWT_SECRET) // Simply verify if it's a valid admin token
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const { keyword, verses, category, level, type, audioUrl, options, correctText } = req.body
    
    // Base validation: keyword is always required
    if (!keyword) {
      return res.status(400).json({ message: 'الكلمة المفتاحية أو نص الآية مطلوب' })
    }

    // Type-specific requirements
    const effectiveType = type || "STANDARD"
    if (effectiveType === 'STANDARD' && (!verses || !Array.isArray(verses) || verses.length === 0)) {
      return res.status(400).json({ message: 'مصفوفة الآيات مطلوبة لتحدي المتشابهات الكلاسيكي' })
    }

    // Validation for new types
    if (type === 'AUDIO' && !audioUrl) {
      return res.status(400).json({ message: 'رابط الصوت مطلوب لتحدي الصوت' })
    }
    if (type === 'COMPLETION' && (!options || !Array.isArray(options) || options.length === 0)) {
      return res.status(400).json({ message: 'الخيارات مطلوبة لتحدي التكملة' })
    }
    if (type === 'SURAH' && !correctText) {
      return res.status(400).json({ message: 'اسم السورة الصحيح مطلوب لتحدي السورة' })
    }

    try {
      // Check if keyword already exists
      const existing = await prisma.challenge.findUnique({
        where: { keyword }
      })
      if (existing) {
        return res.status(409).json({ message: 'هذه الكلمة المفتاحية موجودة مسبقاً في تحدي آخر' })
      }

      const challengeData: any = { 
        keyword, 
        verses: verses || [],
        category: category || "",
        level: level || "",
        type: type || "STANDARD",
        audioUrl: audioUrl || null,
        options: options || null,
        correctText: correctText || null
      }

      const challenge = await prisma.challenge.create({
        data: challengeData
      })
      return res.status(201).json(challenge)
    } catch (error: any) {
      console.error('Create Challenge Error:', error)
      return res.status(500).json({ 
        message: 'Failed to create challenge',
        error: error.message 
      })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
