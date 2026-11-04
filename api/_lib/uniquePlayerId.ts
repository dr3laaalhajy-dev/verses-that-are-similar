import { prisma } from './prisma.js';

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
    const existing = await prisma.player.findUnique({
      where: { uniquePlayerId }
    });
    if (!existing) {
      break;
    }
    uniquePlayerId = generateRawPlayerId();
    attempts++;
  }

  if (playerId) {
    await prisma.player.update({
      where: { id: playerId },
      data: { uniquePlayerId }
    });
  }

  return uniquePlayerId;
}

