import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { handleCors } from '../_lib/cors.js';
import { findPlayerRow, toSafePlayer } from '../_lib/playerSecurity.js';

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
    const row = await findPlayerRow(supabaseAdmin, {
      id: numId,
      uniquePlayerId: cleanUnique,
      username: cleanU,
      name: cleanN
    });

    if (!row) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = toSafePlayer(row);
    return res.status(200).json({ user: player, player });
  } catch (error: any) {
    console.error('Error in /api/users/me:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
