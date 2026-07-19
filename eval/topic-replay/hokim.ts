import type { ReplayCase } from './schema.js'

export interface HokimTopicInput {
  messageKeys: string[]
  categories: string[]
}

export function computeHokimRelated(
  replayCase: ReplayCase,
  topic: HokimTopicInput,
): boolean {
  if (topic.categories.length === 0) return false
  const retained = topic.messageKeys
    .map(key => replayCase.messages.find(message => message.key === key)?.text ?? '')
    .join(' ')
  const textTokens = tokenize(retained)
  const paddedText = ` ${textTokens.join(' ')} `
  return replayCase.activeHokimKeywords.some(keyword => {
    const phrase = tokenize(keyword).join(' ')
    return phrase !== '' && paddedText.includes(` ${phrase} `)
  })
}

function tokenize(value: string): string[] {
  return value.normalize('NFKC').toLocaleLowerCase('uz')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}
