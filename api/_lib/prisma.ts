import { PrismaClient } from '@prisma/client'

declare global {
  var prismaGlobal: undefined | PrismaClient
  var prismaGlobalUrl: undefined | string
}

const getPrismaClient = (): PrismaClient => {
  const currentUrl = process.env.DATABASE_URL
  if (globalThis.prismaGlobal && globalThis.prismaGlobalUrl === currentUrl && (globalThis.prismaGlobal as any).systemSetting) {
    return globalThis.prismaGlobal
  }
  if (globalThis.prismaGlobal) {
    try {
      globalThis.prismaGlobal.$disconnect()
    } catch {}
  }
  const client = new PrismaClient()
  globalThis.prismaGlobal = client
  globalThis.prismaGlobalUrl = currentUrl
  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const val = (client as any)[prop]
    return typeof val === 'function' ? val.bind(client) : val
  }
})

