import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const challenges = await prisma.challenge.findMany()
    console.log('Challenges count:', challenges.length)
    console.log('Challenges:', JSON.stringify(challenges, null, 2))
  } catch (error) {
    console.error('Error fetching challenges:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
