// prisma/seed-signals.ts
// Inserts a realistic set of today's signal_messages for dashboard dev/preview.
// Safe to run multiple times — uses unique telegram_update_id with a high base offset.
// Run with: pnpm exec tsx prisma/seed-signals.ts

import { PrismaClient } from '../apps/server/src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// UTC+5 "now" helpers
const now = new Date()
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000)

type Category = 'water' | 'electricity' | 'gas' | 'waste'

interface SignalDraft {
  updateIdOffset: number        // unique offset from base
  category:       Category
  hokimRelated:   boolean
  senderName:     string | null
  senderUsername: string | null
  text:           string
  textSource:     'text' | 'caption'
  mahallaIndex:   number        // 0 = Навбаҳор, 1 = Олмазор
  minsAgo:        number        // how many minutes ago
  keyword:        string | null
}

const signals: SignalDraft[] = [
  // ── Water ──────────────────────────────────────────────────────────────
  {
    updateIdOffset: 1,
    category: 'water', hokimRelated: false,
    senderName: 'Дилноза Юсупова', senderUsername: null,
    text: 'Икки кундан бери сув йўқ. Болалар мактабга бора олмаяпти, уй ювиш мумкин эмас. Илтимос тезда ҳал қилинсин.',
    textSource: 'text', mahallaIndex: 0, minsAgo: 8, keyword: 'suv',
  },
  {
    updateIdOffset: 2,
    category: 'water', hokimRelated: false,
    senderName: null, senderUsername: 'resident_navbahor',
    text: 'Сув босими жуда паст, кечки пайт умуман оқмаяпти.',
    textSource: 'text', mahallaIndex: 0, minsAgo: 25, keyword: 'suv',
  },
  {
    updateIdOffset: 3,
    category: 'water', hokimRelated: true,
    senderName: 'Акбар Рашидов', senderUsername: null,
    text: 'Ҳокимиятдан жавоб кутяпмиз — сув таъминоти узилиши тўғрисида расмий маълумот берилсин.',
    textSource: 'caption', mahallaIndex: 1, minsAgo: 45, keyword: 'suv',
  },
  {
    updateIdOffset: 4,
    category: 'water', hokimRelated: false,
    senderName: 'Малика Каримова', senderUsername: null,
    text: 'Труба ёрилган кўринади, кўча ҳўл. Авария бригадасини чақиринг!',
    textSource: 'text', mahallaIndex: 1, minsAgo: 110, keyword: 'suv',
  },

  // ── Electricity ─────────────────────────────────────────────────────────
  {
    updateIdOffset: 5,
    category: 'electricity', hokimRelated: false,
    senderName: 'Жамшид Тошматов', senderUsername: null,
    text: 'Бугун эрта тонгдан свет йўқ. Болалар дарс тайёрлай олмаяпти. Трансформатор ёнганга ўхшайди.',
    textSource: 'text', mahallaIndex: 0, minsAgo: 15, keyword: 'elektr',
  },
  {
    updateIdOffset: 6,
    category: 'electricity', hokimRelated: true,
    senderName: 'Нилуфар Азимова', senderUsername: null,
    text: 'Ҳоким жаноблари, электр таъминоти масаласини шахсан назоратга олишингизни сўраймиз. Кўчамизда 3 кундан бери ток йўқ.',
    textSource: 'text', mahallaIndex: 0, minsAgo: 33, keyword: 'tok',
  },
  {
    updateIdOffset: 7,
    category: 'electricity', hokimRelated: false,
    senderName: null, senderUsername: null,
    text: 'Электр симлари хавфли ҳолатда осиғлиқ турибди. Болалар яқинида — жуда хавфли!',
    textSource: 'caption', mahallaIndex: 1, minsAgo: 58, keyword: 'elektr',
  },
  {
    updateIdOffset: 8,
    category: 'electricity', hokimRelated: false,
    senderName: 'Санжар Бекмуродов', senderUsername: 'sanjarbek',
    text: 'Кечаси 22:00 дан свет бор, кундузи ўчади. Планли ўчиришми ёки авариями?',
    textSource: 'text', mahallaIndex: 1, minsAgo: 90, keyword: 'elektr',
  },

  // ── Gas ─────────────────────────────────────────────────────────────────
  {
    updateIdOffset: 9,
    category: 'gas', hokimRelated: false,
    senderName: 'Феруза Мамадалиева', senderUsername: null,
    text: 'Газ йўқ, уй совуқ. Кичкина болаларим бор. Илтимос тезроқ ҳал қилинсин.',
    textSource: 'text', mahallaIndex: 0, minsAgo: 5, keyword: 'gaz',
  },
  {
    updateIdOffset: 10,
    category: 'gas', hokimRelated: false,
    senderName: 'Умид Нишонов', senderUsername: 'umid_n',
    text: 'Газ ҳиди сезиляпти подъездда. Газ хизмати чақирилдими?',
    textSource: 'text', mahallaIndex: 0, minsAgo: 20, keyword: 'gaz',
  },
  {
    updateIdOffset: 11,
    category: 'gas', hokimRelated: true,
    senderName: 'Зулфия Ҳасанова', senderUsername: null,
    text: 'Ҳоким жаноблари, газ масаласи жиддий. Кексалар ва болалар совуқда. Бу шаҳар муаммоси — шахсан аралашишингизни сўраймиз.',
    textSource: 'text', mahallaIndex: 1, minsAgo: 40, keyword: 'gaz',
  },
  {
    updateIdOffset: 12,
    category: 'gas', hokimRelated: false,
    senderName: 'Отабек Мирзаев', senderUsername: 'otabek_m',
    text: 'Газ қувури ёрилган, кўчада газ чиқяпти. Авария бригадасига хабар берилдими?',
    textSource: 'caption', mahallaIndex: 1, minsAgo: 75, keyword: 'gaz',
  },

  // ── Waste ────────────────────────────────────────────────────────────────
  {
    updateIdOffset: 13,
    category: 'waste', hokimRelated: false,
    senderName: 'Барно Содиқова', senderUsername: null,
    text: 'Ахлат машинаси икки ҳафтадан бери келмаяпти. Кўча ҳиди чидаб бўлмас даражада.',
    textSource: 'text', mahallaIndex: 0, minsAgo: 12, keyword: 'axlat',
  },
  {
    updateIdOffset: 14,
    category: 'waste', hokimRelated: false,
    senderName: null, senderUsername: 'navbahor_resident',
    text: 'Контейнерлар тўлиб тошган, ахлатлар кўчага тўкилган. Фото илова қиляпман.',
    textSource: 'caption', mahallaIndex: 0, minsAgo: 35, keyword: 'chiqindi',
  },
  {
    updateIdOffset: 15,
    category: 'waste', hokimRelated: false,
    senderName: 'Ҳурматли Маҳаллатошев', senderUsername: null,
    text: 'Кўча супурувчи кирмаяпти аллақачон. Йўлаклар ифлос.',
    textSource: 'text', mahallaIndex: 1, minsAgo: 65, keyword: 'axlat',
  },
  {
    updateIdOffset: 16,
    category: 'waste', hokimRelated: false,
    senderName: 'Камола Раҳимова', senderUsername: 'kamola_r',
    text: 'Ахлат полигони яқинида ёнғин бор, тутун маҳаллага кириб келяпти. Тез ёрдам беринг!',
    textSource: 'text', mahallaIndex: 1, minsAgo: 95, keyword: 'chiqindi',
  },
]

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Signal seed is disabled in production')
  }

  // Load district + mahallas
  const district = await prisma.district.findFirst({
    where: { name: 'Yunusobod tumani' },
    include: { mahallas: { orderBy: { id: 'asc' } } },
  })

  if (!district) {
    throw new Error('District not found. Run `pnpm db:seed` first to create base data.')
  }
  if (district.mahallas.length < 2) {
    throw new Error('Need at least 2 mahallas. Run `pnpm db:seed` first.')
  }

  const mahallas = district.mahallas

  // Base update ID far above the real telegram range for dev purposes
  const BASE_UPDATE_ID = 9_000_000

  let created = 0
  let skipped = 0

  for (const s of signals) {
    const updateId = BASE_UPDATE_ID + s.updateIdOffset
    const mahalla  = mahallas[s.mahallaIndex]!
    const ts       = minutesAgo(s.minsAgo)

    try {
      await prisma.signalMessage.upsert({
        where: {
          telegram_update_id_category: {
            telegram_update_id: updateId,
            category: s.category,
          },
        },
        update: {},
        create: {
          telegram_update_id:  updateId,
          telegram_message_id: 10_000 + s.updateIdOffset,
          district_id:         district.id,
          mahalla_id:          mahalla.id,
          sender_display_name: s.senderName,
          sender_username:     s.senderUsername,
          telegram_timestamp:  ts,
          raw_text:            s.text,
          text_source:         s.textSource,
          category:            s.category,
          hokim_related:       s.hokimRelated,
          keyword_matched:     s.keyword !== null,
          matched_keyword:     s.keyword,
          short_label:         null,
          classified_at:       new Date(ts.getTime() + 5_000), // 5s after message
        },
      })
      created++
      console.log(`  ✓ [${s.category.padEnd(11)}] ${s.senderName ?? '@' + (s.senderUsername ?? 'Резидент')} — ${s.text.slice(0, 50)}…`)
    } catch (err) {
      console.warn(`  ⚠ Skipped update_id=${updateId}:`, err)
      skipped++
    }
  }

  console.log(`\n✅ Done — ${created} signals inserted, ${skipped} skipped (duplicates).`)
  console.log('   Refresh the dashboard at http://localhost:5173 to see the cards.')
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seed failed:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
