import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Database Diagnostic ---')
  console.log('Testing connection to:', process.env.DATABASE_URL?.split('@')[1] || 'URL not found')
  
  try {
    const adminCount = await prisma.admin.count()
    console.log('Connection successful!')
    console.log('Admins found:', adminCount)
    
    const playerCount = await prisma.player.count()
    console.log('Players found:', playerCount)
    
    const challengeCount = await prisma.challenge.count()
    console.log('Challenges found:', challengeCount)
    
  } catch (error: any) {
    console.error('Connection failed!')
    console.error('Error message:', error.message)
    if (error.code) console.error('Error code:', error.code)
  } finally {
    await prisma.$disconnect()
  }
}

main()
