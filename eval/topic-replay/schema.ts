import { z } from 'zod'

export const SUPPORTED_CATEGORIES = ['water', 'electricity', 'gas', 'waste'] as const
export const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/u
export const SafeIdSchema = z.string().regex(SAFE_ID_PATTERN)

export const CaseTagSchema = z.enum([
  'keywordless-new-topic',
  'keyword-containing-irrelevant',
  'keywordless-follow-up',
  'context-fragment',
  'exact-reply-over-24h',
  'similar-category-distinct-situation',
  'multi-category',
  'unsupported-category',
  'ambiguous-cause',
  'contradiction',
  'restoration',
  'repeated-sender',
  'distinct-residents',
  'unavailable-sender',
  'promotion',
  'anchor',
  'cross-scope-rejection',
  'invalid-candidate',
  'invalid-provider-schema',
  'provider-unavailable',
])

export const DispositionSchema = z.enum(['new_topic', 'attached', 'irrelevant'])
export const CategorySchema = z.enum(SUPPORTED_CATEGORIES)

export const PromotionEventSchema = z.object({
  originMessageKey: SafeIdSchema,
  triggerMessageKey: SafeIdSchema,
  topicKey: SafeIdSchema,
})

export const ExpectedPromotionEventSchema = PromotionEventSchema.extend({
  tags: z.array(CaseTagSchema).default([]),
})

export const SummaryAssertionSchema = z.object({
  property: z.enum([
    'uzbek_cyrillic',
    'attribution',
    'uncertainty',
    'contradiction',
    'identity_omission',
    'resident_count',
    'unsupported_claim',
    'restoration_not_resolution',
  ]),
  operator: z.enum([
    'required_terms',
    'forbidden_terms',
    'required_patterns',
    'forbidden_patterns',
    'expected_distinct_resident_count',
    'manual_review',
  ]),
  values: z.array(z.string()).optional(),
  expectedCount: z.number().int().nonnegative().optional(),
})

export const ReplayMessageSchema = z.object({
  key: SafeIdSchema,
  telegramTimestamp: z.string().datetime({ offset: true }),
  senderKey: SafeIdSchema.nullable().optional(),
  text: z.string().min(1),
  textSource: z.enum(['text', 'caption']),
  replyToKey: SafeIdSchema.nullable().optional(),
  tags: z.array(CaseTagSchema).default([]),
})

export const TopicStateSchema = z.object({
  topicKey: SafeIdSchema,
  messageKeys: z.array(SafeIdSchema).min(1),
  categories: z.array(CategorySchema).min(1),
  anchorMessageKey: SafeIdSchema,
})

export const AdapterTelemetrySchema = z.object({
  attempts: z.number().int().positive(),
  retries: z.number().int().nonnegative(),
  terminalFailure: z.boolean(),
  latencyMs: z.number().nonnegative(),
  promptCharacters: z.number().int().nonnegative().optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalDurationNs: z.number().int().nonnegative().optional(),
  loadDurationNs: z.number().int().nonnegative().optional(),
  promptEvalDurationNs: z.number().int().nonnegative().optional(),
  evalDurationNs: z.number().int().nonnegative().optional(),
}).superRefine((telemetry, context) => {
  if (telemetry.attempts !== telemetry.retries + 1) {
    context.addIssue({
      code: 'custom',
      path: ['retries'],
      message: 'attempts must equal retries plus one',
    })
  }
})

export const AdapterStepOutputSchema = z.object({
  messageKey: SafeIdSchema,
  disposition: DispositionSchema,
  topicUpdates: z.array(TopicStateSchema),
  promotionEvents: z.array(PromotionEventSchema),
  telemetry: AdapterTelemetrySchema,
  summaryText: z.string().min(1).max(4000).optional(),
})

export const ExpectedTopicSchema = z.object({
  key: SafeIdSchema,
  messageKeys: z.array(SafeIdSchema).min(1),
  categories: z.array(CategorySchema).min(1),
  hokimRelated: z.boolean(),
  anchorMessageKey: SafeIdSchema,
  distinctResidentCount: z.number().int().nonnegative(),
  summaryAssertions: z.array(SummaryAssertionSchema).default([]),
})

export const ReplayCaseSchema = z.object({
  id: SafeIdSchema,
  scope: z.object({
    districtKey: SafeIdSchema,
    mahallaKey: SafeIdSchema,
    telegramChatKey: SafeIdSchema,
  }),
  activeHokimKeywords: z.array(z.string().min(1)).default([]),
  tags: z.array(CaseTagSchema).default([]),
  messages: z.array(ReplayMessageSchema).min(1),
  expected: z.object({
    dispositions: z.record(z.string(), DispositionSchema),
    topics: z.array(ExpectedTopicSchema),
    promotionEvents: z.array(ExpectedPromotionEventSchema).default([]),
  }),
  adapterScript: z.object({
    steps: z.array(AdapterStepOutputSchema).min(1),
  }),
})

export type ReplayCase = z.infer<typeof ReplayCaseSchema>
export type ReplayMessage = z.infer<typeof ReplayMessageSchema>
export type ReplayCaseTag = z.infer<typeof CaseTagSchema>
export type Disposition = z.infer<typeof DispositionSchema>
export type TopicState = z.infer<typeof TopicStateSchema>
export type AdapterStepOutput = z.infer<typeof AdapterStepOutputSchema>
export type AdapterTelemetry = z.infer<typeof AdapterTelemetrySchema>
export type ExpectedTopic = z.infer<typeof ExpectedTopicSchema>
export type SummaryAssertion = z.infer<typeof SummaryAssertionSchema>
