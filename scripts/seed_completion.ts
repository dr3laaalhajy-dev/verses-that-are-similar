import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const dataPath = '/Users/apple/.gemini/antigravity/brain/45caf5ec-a959-4325-a6d9-041447a8ca22/generated_completion_challenges.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

async function main() {
  console.log('Starting seed...');
  let count = 0;
  for (const item of data) {
    try {
      const keyword = item.prompt.replace(' ...', ' ') + item.options[item.correctIndex];
      await prisma.challenge.upsert({
        where: { keyword },
        update: {},
        create: {
          keyword,
          verses: [],
          type: 'COMPLETION',
          options: item.options,
          correctText: item.options[item.correctIndex],
          category: 'توليد آلي',
          level: 'متوسط'
        }
      });
      count++;
    } catch (e: any) {
      console.error('Error seeding item:', e.message);
    }
  }
  console.log(`Seed completed. Inserted/Updated ${count} items.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
