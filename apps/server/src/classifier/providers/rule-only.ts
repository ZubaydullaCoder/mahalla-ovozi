import { env } from '../../shared/env.js'
import { logger } from '../../shared/logger.js'
import type { ProviderRawResult } from './types.js'

type RuleMatch = {
  category: 'water' | 'electricity' | 'gas' | 'waste'
  shortLabel: string
  patterns: RegExp[]
}

const RULES: RuleMatch[] = [
  {
    category:   'water',
    shortLabel: 'Possible water issue',
    patterns:   [/\bsuv\b/i, /вод[аы]/i, /water/i],
  },
  {
    category:   'electricity',
    shortLabel: 'Possible electricity issue',
    patterns:   [/elektr/i, /свет/i, /электр/i, /power/i],
  },
  {
    category:   'gas',
    shortLabel: 'Possible gas issue',
    patterns:   [/\bgaz\b/i, /\bгаз\b/i, /\bgas\b/i],
  },
  {
    category:   'waste',
    shortLabel: 'Possible waste issue',
    patterns:   [/chiqindi/i, /мусор/i, /waste/i, /garbage/i],
  },
]

export async function classifyWithRuleOnly(text: string): Promise<ProviderRawResult> {
  const startedAt = Date.now()
  const matchedRule = RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(text)))
  const hokimRelated = /\bhokim\b/i.test(text) || /\bхоким\b/i.test(text)

  logger.info(
    {
      event:    'classifier_rule_only_used',
      provider: 'rule-only',
      model:    getRuleOnlyModelName(),
    },
    'Rule-only classifier used',
  )

  if (!matchedRule) {
    return {
      provider:  'rule-only',
      model:     getRuleOnlyModelName(),
      latencyMs: Date.now() - startedAt,
      rawJson:   { decision: 'ignore' },
    }
  }

  return {
    provider:  'rule-only',
    model:     getRuleOnlyModelName(),
    latencyMs: Date.now() - startedAt,
    rawJson:   {
      decision:      'signal',
      categories:    [matchedRule.category],
      hokim_related: hokimRelated,
      short_label:   matchedRule.shortLabel,
    },
  }
}

function getRuleOnlyModelName(): string {
  return env.AI_MODEL === 'gemini-2.5-flash' ? 'rule-only' : env.AI_MODEL
}
