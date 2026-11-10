import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { handleCors } from '../_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id, uniquePlayerId, username, name } = req.query;

  const cleanUnique = String(uniquePlayerId || '').trim().toUpperCase();
  const cleanU = String(username || '').trim().replace(/^@+/, '');
  const cleanN = String(name || '').trim();
  const numId = Number(id);

  if (!cleanUnique && !cleanU && !cleanN && !(Number.isInteger(numId) && numId > 0)) {
    return res.status(400).json({ error: 'Missing player identifier' });
  }

  try {
    let player: any = null;

    const orParts: string[] = [];
    if (cleanUnique) orParts.push(`uniquePlayerId.eq.${cleanUnique}`);
    if (cleanU) {
      orParts.push(`username.eq.${cleanU}`);
      orParts.push(`username.eq.@${cleanU}`);
    }
    if (cleanN) orParts.push(`name.ilike.${cleanN}`);
    if (Number.isInteger(numId) && numId > 0) orParts.push(`id.eq.${numId}`);

    const { data, error } = await supabaseAdmin
      .from('players')
      .select('*')
      .or(orParts.join(','))
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      player = data;
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    return res.status(200).json({ user: player, player });
  } catch (error: any) {
    console.error('Error in /api/users/me:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
