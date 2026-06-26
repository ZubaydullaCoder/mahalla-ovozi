import { PrismaClient } from '../apps/server/src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import argon2 from 'argon2'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed is disabled in production')
  }

  // 1 — District
  let district = await prisma.district.findFirst({
    where: { name: 'Yunusobod tumani' },
  })
  if (!district) {
    district = await prisma.district.create({
      data: { name: 'Yunusobod tumani' },
    })
  }

  // 2 — Mahallas (fake BigInt chat IDs for local dev)
  const mahallas: Array<{ name: string; chatId: bigint }> = [
    { name: 'Навбаҳор маҳалласи', chatId: -1001000000001n },
    { name: 'Олмазор маҳалласи',  chatId: -1001000000002n },
    { name: 'Боғистон маҳалласи', chatId: -1001000000003n },
  ]
  for (const { name, chatId } of mahallas) {
    await prisma.mahalla.upsert({
      where:  { telegram_chat_id: chatId },
      update: {},
      create: {
        district_id:      district.id,
        name,
        telegram_chat_id: chatId,
        bot_status:       'active',
      },
    })
  }

  // 3 — Operator user (devpassword only — rotate before pilot)
  const password_hash = await argon2.hash('devpassword')
  await prisma.user.upsert({
    where:  { username: 'operator' },
    update: {},
    create: {
      username:      'operator',
      password_hash,
      district_id:   district.id,
    },
  })

  // 4 — Core Keywords (Latin and Cyrillic pairs)
  const defaultKeywords = [
    'gaz', 'газ',
    'svet', 'свет',
    'elektr', 'электр',
    'suv', 'сув',
    'hokim', 'ҳоким', 'хоким',
    'musr', 'муср',
    'musor', 'мусор',
    'chiqindi', 'чиқинди', 'чикинди',
    'musir', 'мусир',
    'rais', 'раис',
    'rayis', 'райис',
    'rais buva', 'раис бува',
    'rayis buva', 'райис бува',
    'rais bobo', 'раис бобо',
    'rayis bobo', 'райис бобо'
  ]

  for (const phrase of defaultKeywords) {
    await prisma.keyword.upsert({
      where: {
        district_id_phrase: {
          district_id: district.id,
          phrase,
        },
      },
      update: {},
      create: {
        district_id: district.id,
        phrase,
        is_active: true,
      },
    })
  }

  console.log('Seed complete')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
