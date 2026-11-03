import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables (.env.local, .env)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

// Prices of items in the store
const ITEM_PRICES: Record<string, { currency: 'points' | 'streak'; price: number }> = {
  // Name Colors
  color_gold: { currency: 'points', price: 150 },
  color_emerald: { currency: 'points', price: 120 },
  color_ruby: { currency: 'streak', price: 7 },
  color_sky: { currency: 'points', price: 100 },
  color_purple: { currency: 'streak', price: 10 },

  // Honor Titles
  title_aqidah_champion: { currency: 'points', price: 200 },
  title_quran_ambassador: { currency: 'streak', price: 14 },
  title_motashabehat_knight: { currency: 'points', price: 250 },
  title_hafiz: { currency: 'points', price: 180 },
  title_flame_master: { currency: 'streak', price: 20 },

  // Borders
  border_seerah: { currency: 'points', price: 300 },
  border_general: { currency: 'points', price: 300 },
  border_emerald_glow: { currency: 'streak', price: 15 },
};

async function runRefund() {
  console.log('--- Starting Cosmetics Refund Script ---');

  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      points: true,
      streak: true,
      ownedCosmetics: true,
      equippedNameColor: true,
    },
  });

  console.log(`Found ${players.length} total players.`);

  let refundedPlayersCount = 0;

  for (const player of players) {
    let ownedList: string[] = [];
    if (Array.isArray(player.ownedCosmetics)) {
      ownedList = player.ownedCosmetics as string[];
    } else if (typeof player.ownedCosmetics === 'string') {
      try {
        ownedList = JSON.parse(player.ownedCosmetics);
      } catch {
        ownedList = [];
      }
    }

    let refundPoints = 0;
    let refundStreak = 0;

    for (const itemId of ownedList) {
      const item = ITEM_PRICES[itemId];
      if (item) {
        if (item.currency === 'points') {
          refundPoints += item.price;
        } else if (item.currency === 'streak') {
          refundStreak += item.price;
        }
      }
    }

    const needsRefund = ownedList.length > 0 || player.equippedNameColor !== null;

    if (needsRefund) {
      refundedPlayersCount++;
      const newPoints = player.points + refundPoints;
      const newStreak = player.streak + refundStreak;

      console.log(`Refunding Player #${player.id} (${player.name}):`);
      console.log(`  Items owned: [${ownedList.join(', ')}]`);
      console.log(`  Points: ${player.points} -> ${newPoints} (+${refundPoints})`);
      console.log(`  Streak: ${player.streak} -> ${newStreak} (+${refundStreak})`);
      console.log(`  Clearing equippedNameColor`);

      await prisma.player.update({
        where: { id: player.id },
        data: {
          points: newPoints,
          streak: newStreak,
          ownedCosmetics: [],
          equippedNameColor: null,
        },
      });
    }
  }

  console.log(`\nRefund complete! Processed ${refundedPlayersCount} players.`);
}

runRefund()
  .catch((err) => {
    console.error('Error during refund:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

