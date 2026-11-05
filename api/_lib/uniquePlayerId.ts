import { supabaseAdmin } from './supabaseAdmin.js';

export function generateRawPlayerId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MT-${code}`;
}

export async function getOrGenerateUniquePlayerId(playerId?: number): Promise<string> {
  let uniquePlayerId = generateRawPlayerId();
  let attempts = 0;

  while (attempts < 10) {
    const { data: existing } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('uniquePlayerId', uniquePlayerId)
      .maybeSingle();

    if (!existing) {
      break;
    }
    uniquePlayerId = generateRawPlayerId();
    attempts++;
  }

  if (playerId) {
    await supabaseAdmin
      .from('players')
      .update({ uniquePlayerId })
      .eq('id', playerId);
  }

  return uniquePlayerId;
}

