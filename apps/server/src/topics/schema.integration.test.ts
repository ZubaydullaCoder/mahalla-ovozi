/**
 * apps/server/src/topics/schema.integration.test.ts
 *
 * Schema integration tests for Story 9.2: Topic and Captured-Message Schema.
 *
 * IMPORTANT: This test file targets a REAL PostgreSQL database.
 * It MUST only be run via `pnpm test:schema` (the guarded wrapper), never
 * directly via `pnpm test`. The guard script injects TEST_DATABASE_URL as
 * DATABASE_URL and verifies safety invariants before invoking this suite.
 *
 * Serial execution is enforced by vitest.schema.config.ts (maxForks: 1).
 */
import { describe, it, beforeAll, afterAll, afterEach, expect } from 'vitest'
import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

// ─── Client setup ─────────────────────────────────────────────────────────────
// DATABASE_URL is injected by the guard script as TEST_DATABASE_URL

let prisma: PrismaClient

beforeAll(() => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL not set — guard script must inject TEST_DATABASE_URL')
  const adapter = new PrismaPg({ connectionString: databaseUrl })
  prisma = new PrismaClient({ adapter })
})

// ─── Test fixtures: district and mahalla ─────────────────────────────────────

let districtId: number
let secondDistrictId: number
let mahalla1Id: number
let mahalla2Id: number  // used for cross-scope tests
let secondDistrictMahallaId: number

const runSeed = BigInt(Date.now())
const fixtureSuffix = `${process.pid}-${runSeed}`
const primaryChatId = -(runSeed * 10n + 1n)
const secondaryChatId = -(runSeed * 10n + 2n)
const secondDistrictChatId = -(runSeed * 10n + 3n)

beforeAll(async () => {
  const district = await prisma.district.create({
    data: { name: `Schema 9.2 District A ${fixtureSuffix}` },
  })
  districtId = district.id

  const m1 = await prisma.mahalla.create({
    data: {
      district_id: districtId,
      name: `Schema 9.2 Mahalla A ${fixtureSuffix}`,
      telegram_chat_id: primaryChatId,
    },
  })
  mahalla1Id = m1.id

  const m2 = await prisma.mahalla.create({
    data: {
      district_id: districtId,
      name: `Schema 9.2 Mahalla B ${fixtureSuffix}`,
      telegram_chat_id: secondaryChatId,
    },
  })
  mahalla2Id = m2.id

  const secondDistrict = await prisma.district.create({
    data: { name: `Schema 9.2 District B ${fixtureSuffix}` },
  })
  secondDistrictId = secondDistrict.id

  const m3 = await prisma.mahalla.create({
    data: {
      district_id: secondDistrictId,
      name: `Schema 9.2 Mahalla C ${fixtureSuffix}`,
      telegram_chat_id: secondDistrictChatId,
    },
  })
  secondDistrictMahallaId = m3.id
})

// ─── Cleanup between tests ───────────────────────────────────────────────────

async function cleanStoryFixtures() {
  if (!districtId || !secondDistrictId) return
  const fixtureDistrictIds = [districtId, secondDistrictId]

  await prisma.topic.updateMany({
    where: { district_id: { in: fixtureDistrictIds } },
    data: { anchor_captured_message_id: null },
  })
  await prisma.capturedMessage.updateMany({
    where: { district_id: { in: fixtureDistrictIds } },
    data: { promotion_triggered_by_id: null },
  })
  await prisma.capturedMessage.updateMany({
    where: { district_id: { in: fixtureDistrictIds } },
    data: { topic_id: null },
  })
  await prisma.capturedMessage.deleteMany({
    where: { district_id: { in: fixtureDistrictIds } },
  })
  await prisma.topic.deleteMany({
    where: { district_id: { in: fixtureDistrictIds } },
  })
}

afterEach(async () => {
  await cleanStoryFixtures()
})

afterAll(async () => {
  await cleanStoryFixtures()
  const fixtureDistrictIds = [districtId, secondDistrictId].filter(Boolean)
  await prisma.mahalla.deleteMany({
    where: { district_id: { in: fixtureDistrictIds } },
  })
  await prisma.district.deleteMany({
    where: { id: { in: fixtureDistrictIds } },
  })
  await prisma.$disconnect()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

let updateIdCounter = runSeed * 1_000n
function nextUpdateId(): bigint {
  return ++updateIdCounter
}

function makeCapturedMessage(overrides: {
  mahalla_id?: number
  district_id?: number
  topic_id?: number | null
  telegram_update_id?: bigint
  telegram_message_id?: number | null
  telegram_chat_id?: bigint
} = {}) {
  return {
    telegram_update_id: overrides.telegram_update_id ?? nextUpdateId(),
    telegram_chat_id: overrides.telegram_chat_id ?? primaryChatId,
    telegram_message_id: overrides.telegram_message_id !== undefined ? overrides.telegram_message_id : 42,
    district_id: overrides.district_id ?? districtId,
    mahalla_id: overrides.mahalla_id ?? mahalla1Id,
    text_source: 'text',
    telegram_timestamp: new Date('2026-07-20T08:00:00Z'),
    topic_id: overrides.topic_id !== undefined ? overrides.topic_id : null,
  }
}

function makeTopic(overrides: { mahalla_id?: number; district_id?: number } = {}) {
  return {
    district_id: overrides.district_id ?? districtId,
    mahalla_id: overrides.mahalla_id ?? mahalla1Id,
    summary: 'Тест мавзуси — сув таъминоти масаласи',
    summary_model: 'gemma4:12b',
    summary_version: '1.0',
    first_activity_at: new Date('2026-07-20T07:00:00Z'),
    latest_activity_at: new Date('2026-07-20T08:00:00Z'),
  }
}

async function expectPrismaError(
  operation: Promise<unknown>,
  code: 'P2002' | 'P2003'
) {
  await expect(operation).rejects.toMatchObject({ code })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Topic model', () => {
  it('inserts a topic successfully', async () => {
    const topic = await prisma.topic.create({ data: makeTopic() })
    expect(topic.id).toBeTypeOf('number')
    expect(topic.summary).toContain('Тест')
    expect(topic.version).toBe(0)
  })

  it('inserts a topic with a category', async () => {
    const topic = await prisma.topic.create({
      data: {
        ...makeTopic(),
        categories: {
          create: [{ category: 'water' }],
        },
      },
      include: { categories: true },
    })
    expect(topic.categories).toHaveLength(1)
    expect(topic.categories[0].category).toBe('water')
  })

  it('rejects a topic whose mahalla_id belongs to a different district_id', async () => {
    await expectPrismaError(
      prisma.topic.create({
        data: makeTopic({
          district_id: districtId,
          mahalla_id: secondDistrictMahallaId,
        }),
      }),
      'P2003'
    )
  })
})

describe('CapturedMessage model', () => {
  it('inserts a CapturedMessage successfully', async () => {
    const msg = await prisma.capturedMessage.create({ data: makeCapturedMessage() })
    expect(msg.id).toBeTypeOf('number')
    expect(msg.processing_state).toBe('queued')
    expect(msg.attempt_count).toBe(0)
    expect(msg.topic_id).toBeNull()
    expect(msg.text).toBeNull()
  })

  it('inserts multiple CapturedMessages referencing the same topic (many-to-one)', async () => {
    const topic = await prisma.topic.create({ data: makeTopic() })

    const m1 = await prisma.capturedMessage.create({
      data: { ...makeCapturedMessage({ topic_id: topic.id }), telegram_message_id: 10 },
    })
    const m2 = await prisma.capturedMessage.create({
      data: { ...makeCapturedMessage({ topic_id: topic.id }), telegram_message_id: 11 },
    })
    expect(m1.topic_id).toBe(topic.id)
    expect(m2.topic_id).toBe(topic.id)
  })

  it('rejects unassigned CapturedMessage whose mahalla_id belongs to a different district_id', async () => {
    await expectPrismaError(
      prisma.capturedMessage.create({
        data: makeCapturedMessage({
          district_id: districtId,
          mahalla_id: secondDistrictMahallaId,
        }),
      }),
      'P2003'
    )
  })

  it('rejects cross-scope constraint: CapturedMessage referencing a Topic with a different mahalla_id', async () => {
    // Topic is in mahalla1, message tries to set topic_id but has mahalla2
    const topic = await prisma.topic.create({ data: makeTopic({ mahalla_id: mahalla1Id }) })

    await expectPrismaError(
      prisma.capturedMessage.create({
        data: makeCapturedMessage({ mahalla_id: mahalla2Id, topic_id: topic.id }),
      }),
      'P2003'
    )
  })

  it('rejects cross-scope constraint: CapturedMessage referencing a Topic with a different district_id', async () => {
    const topic = await prisma.topic.create({ data: makeTopic({ mahalla_id: mahalla1Id }) })

    await expectPrismaError(
      prisma.capturedMessage.create({
        data: makeCapturedMessage({
          district_id: secondDistrictId,
          mahalla_id: secondDistrictMahallaId,
          telegram_chat_id: secondDistrictChatId,
          topic_id: topic.id,
        }),
      }),
      'P2003'
    )
  })
})

describe('Unique constraint: telegram_update_id', () => {
  it('raises unique constraint error on duplicate telegram_update_id', async () => {
    const uid = nextUpdateId()
    await prisma.capturedMessage.create({ data: makeCapturedMessage({ telegram_update_id: uid, telegram_message_id: 20 }) })
    await expect(
      prisma.capturedMessage.create({ data: makeCapturedMessage({ telegram_update_id: uid, telegram_message_id: 21 }) })
    ).rejects.toThrow()
  })
})

describe('Unique constraint: (telegram_chat_id, telegram_message_id)', () => {
  it('raises unique constraint error on duplicate (chat_id, message_id) — defensive uniqueness', async () => {
    await prisma.capturedMessage.create({
      data: makeCapturedMessage({ telegram_chat_id: BigInt(-999_001), telegram_message_id: 55 }),
    })
    await expect(
      prisma.capturedMessage.create({
        data: makeCapturedMessage({ telegram_chat_id: BigInt(-999_001), telegram_message_id: 55 }),
      })
    ).rejects.toThrow()
  })

  it('allows duplicate telegram_message_id when telegram_chat_id differs', async () => {
    await prisma.capturedMessage.create({
      data: makeCapturedMessage({ telegram_chat_id: BigInt(-999_011), telegram_message_id: 77 }),
    })
    const msg2 = await prisma.capturedMessage.create({
      data: makeCapturedMessage({ telegram_chat_id: BigInt(-999_012), telegram_message_id: 77 }),
    })
    expect(msg2.id).toBeTypeOf('number')
  })

  it('allows NULL telegram_message_id (nullable unique — multiple nulls permitted)', async () => {
    const m1 = await prisma.capturedMessage.create({
      data: makeCapturedMessage({ telegram_message_id: null }),
    })
    const m2 = await prisma.capturedMessage.create({
      data: makeCapturedMessage({ telegram_message_id: null }),
    })
    expect(m1.telegram_message_id).toBeNull()
    expect(m2.telegram_message_id).toBeNull()
  })
})

describe('Mahalla unique telegram_chat_id constraint', () => {
  it('two Mahalla rows cannot share the same telegram_chat_id', async () => {
    await prisma.mahalla.create({
      data: { district_id: districtId, name: 'Unique Chat Mahalla A', telegram_chat_id: BigInt(-888_001) },
    })
    await expect(
      prisma.mahalla.create({
        data: { district_id: districtId, name: 'Unique Chat Mahalla B', telegram_chat_id: BigInt(-888_001) },
      })
    ).rejects.toThrow()

    // Cleanup
    await prisma.mahalla.deleteMany({ where: { telegram_chat_id: BigInt(-888_001) } })
  })
})

describe('TopicCategory model', () => {
  it('rejects duplicate categories for the same topic', async () => {
    const topic = await prisma.topic.create({ data: makeTopic() })
    await prisma.topicCategory.create({ data: { topic_id: topic.id, category: 'water' } })
    await expect(
      prisma.topicCategory.create({ data: { topic_id: topic.id, category: 'water' } })
    ).rejects.toThrow()
  })

  it('allows multiple different categories for the same topic', async () => {
    const topic = await prisma.topic.create({ data: makeTopic() })
    await prisma.topicCategory.createMany({
      data: [
        { topic_id: topic.id, category: 'water' },
        { topic_id: topic.id, category: 'electricity' },
        { topic_id: topic.id, category: 'gas' },
      ],
    })
    const cats = await prisma.topicCategory.findMany({ where: { topic_id: topic.id } })
    expect(cats).toHaveLength(3)
  })

  it('cascades delete of categories when topic is deleted', async () => {
    const topic = await prisma.topic.create({ data: makeTopic() })
    await prisma.topicCategory.create({ data: { topic_id: topic.id, category: 'waste' } })
    await prisma.topic.delete({ where: { id: topic.id } })
    const cats = await prisma.topicCategory.findMany({ where: { topic_id: topic.id } })
    expect(cats).toHaveLength(0)
  })
})

describe('Anchor topic membership constraint', () => {
  it('valid same-topic anchor succeeds', async () => {
    // Create topic
    const topic = await prisma.topic.create({ data: makeTopic() })
    // Create a message belonging to the topic
    const msg = await prisma.capturedMessage.create({
      data: { ...makeCapturedMessage({ topic_id: topic.id }), telegram_message_id: 300 },
    })
    // Set the anchor — must match [anchor_captured_message_id, id, district_id, mahalla_id]
    // → captured_messages.[id, topic_id, district_id, mahalla_id]
    const updated = await prisma.topic.update({
      where: { id: topic.id },
      data: { anchor_captured_message_id: msg.id },
    })
    expect(updated.anchor_captured_message_id).toBe(msg.id)
  })

  it('anchor topic membership constraint: anchor pointing to message with no topic_id throws FK violation', async () => {
    const topic = await prisma.topic.create({ data: makeTopic() })
    // Create an UNASSIGNED message (topic_id = null)
    const unassigned = await prisma.capturedMessage.create({
      data: { ...makeCapturedMessage({ topic_id: null }), telegram_message_id: 400 },
    })
    // Trying to set anchor_captured_message_id to an unassigned message should fail
    // because the FK references captured_messages.[id, topic_id, district_id, mahalla_id]
    // and topic_id=null won't match topic.id
    await expect(
      prisma.topic.update({
        where: { id: topic.id },
        data: { anchor_captured_message_id: unassigned.id },
      })
    ).rejects.toThrow()
  })
})

describe('Promotion trigger scope constraint', () => {
  it('allows a same-scope promotion trigger', async () => {
    const trigger = await prisma.capturedMessage.create({
      data: {
        ...makeCapturedMessage({ telegram_message_id: 450 }),
        final_disposition: 'irrelevant',
      },
    })

    const promoted = await prisma.capturedMessage.create({
      data: {
        ...makeCapturedMessage({ telegram_message_id: 451 }),
        promotion_triggered_by_id: trigger.id,
        promoted_from_irrelevant_at: new Date(),
      },
    })

    expect(promoted.promotion_triggered_by_id).toBe(trigger.id)
  })

  it('rejects a promotion trigger from a different district', async () => {
    const trigger = await prisma.capturedMessage.create({
      data: makeCapturedMessage({ telegram_message_id: 452 }),
    })

    await expectPrismaError(
      prisma.capturedMessage.create({
        data: {
          ...makeCapturedMessage({
            district_id: secondDistrictId,
            mahalla_id: secondDistrictMahallaId,
            telegram_chat_id: secondDistrictChatId,
            telegram_message_id: 453,
            topic_id: null,
          }),
          promotion_triggered_by_id: trigger.id,
        },
      }),
      'P2003'
    )
  })
})

describe('Database-enforced check constraints', () => {
  it('attempt_count < 0 throws check constraint violation', async () => {
    // Use raw SQL to bypass Prisma's client-level validation and hit the DB CHECK constraint
    await expect(
      prisma.$executeRaw`
        INSERT INTO captured_messages
          (telegram_update_id, telegram_chat_id, district_id, mahalla_id, text_source, telegram_timestamp, processing_state, attempt_count, created_at, updated_at)
        VALUES
          (${nextUpdateId()}, ${BigInt(-100_001_001)}, ${districtId}, ${mahalla1Id}, 'text', NOW(), 'queued'::\"ProcessingState\", -1, NOW(), NOW())
      `
    ).rejects.toThrow()
  })

  it('half-filled reply IDs (chat set, message null) throws check constraint violation', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO captured_messages
          (telegram_update_id, telegram_chat_id, reply_to_chat_id, reply_to_message_id, district_id, mahalla_id, text_source, telegram_timestamp, processing_state, attempt_count, created_at, updated_at)
        VALUES
          (${nextUpdateId()}, ${BigInt(-100_001_001)}, ${BigInt(-100_001_001)}, ${null}, ${districtId}, ${mahalla1Id}, 'text', NOW(), 'queued'::\"ProcessingState\", 0, NOW(), NOW())
      `
    ).rejects.toThrow()
  })

  it('half-filled reply IDs (chat null, message set) throws check constraint violation', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO captured_messages
          (telegram_update_id, telegram_chat_id, reply_to_chat_id, reply_to_message_id, district_id, mahalla_id, text_source, telegram_timestamp, processing_state, attempt_count, created_at, updated_at)
        VALUES
          (${nextUpdateId()}, ${primaryChatId}, ${null}, ${99}, ${districtId}, ${mahalla1Id}, 'text', NOW(), 'queued'::"ProcessingState", 0, NOW(), NOW())
      `
    ).rejects.toThrow()
  })

  it('both reply IDs set is valid', async () => {
    const rows = await prisma.$executeRaw`
      INSERT INTO captured_messages
        (telegram_update_id, telegram_chat_id, reply_to_chat_id, reply_to_message_id, district_id, mahalla_id, text_source, telegram_timestamp, processing_state, attempt_count, created_at, updated_at)
      VALUES
        (${nextUpdateId()}, ${BigInt(-100_001_001)}, ${BigInt(-100_001_001)}, ${99}, ${districtId}, ${mahalla1Id}, 'text', NOW(), 'queued'::\"ProcessingState\", 0, NOW(), NOW())
    `
    expect(rows).toBe(1)
  })

  it('both reply IDs null is valid (no reply)', async () => {
    const msg = await prisma.capturedMessage.create({
      data: {
        ...makeCapturedMessage({ telegram_message_id: 500 }),
        reply_to_chat_id: null,
        reply_to_message_id: null,
      },
    })
    expect(msg.reply_to_chat_id).toBeNull()
    expect(msg.reply_to_message_id).toBeNull()
  })
})

describe('Database-enforced enum constraints', () => {
  it('rejects an invalid processing state', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO captured_messages
          (telegram_update_id, telegram_chat_id, district_id, mahalla_id, text_source, telegram_timestamp, processing_state, attempt_count, created_at, updated_at)
        VALUES
          (${nextUpdateId()}, ${primaryChatId}, ${districtId}, ${mahalla1Id}, 'text', NOW(), ${'invalid_state'}::"ProcessingState", 0, NOW(), NOW())
      `
    ).rejects.toThrow()
  })

  it('rejects an invalid final disposition', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO captured_messages
          (telegram_update_id, telegram_chat_id, district_id, mahalla_id, text_source, telegram_timestamp, processing_state, final_disposition, attempt_count, created_at, updated_at)
        VALUES
          (${nextUpdateId()}, ${primaryChatId}, ${districtId}, ${mahalla1Id}, 'text', NOW(), 'queued'::"ProcessingState", ${'invalid_disposition'}::"FinalDisposition", 0, NOW(), NOW())
      `
    ).rejects.toThrow()
  })

  it('rejects an invalid topic category', async () => {
    const topic = await prisma.topic.create({ data: makeTopic() })

    await expect(
      prisma.$executeRaw`
        INSERT INTO topic_categories (topic_id, category)
        VALUES (${topic.id}, ${'invalid_category'}::"TopicCategoryValue")
      `
    ).rejects.toThrow()
  })
})

describe('Compound relation update semantics', () => {
  it('restricts updates to anchor and promotion-trigger referenced keys', async () => {
    const constraints = await prisma.$queryRaw<Array<{
      conname: string
      update_action: string
    }>>`
      SELECT conname, confupdtype::text AS update_action
      FROM pg_constraint
      WHERE conname IN (
        'topics_anchor_captured_message_id_id_district_id_mahalla_i_fkey',
        'captured_messages_promotion_triggered_by_id_district_id_ma_fkey'
      )
      ORDER BY conname
    `

    expect(constraints).toEqual([
      {
        conname: 'captured_messages_promotion_triggered_by_id_district_id_ma_fkey',
        update_action: 'r',
      },
      {
        conname: 'topics_anchor_captured_message_id_id_district_id_mahalla_i_fkey',
        update_action: 'r',
      },
    ])
  })
})
