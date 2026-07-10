// apps/web/src/components/delay-banner.tsx
import { Alert } from 'antd'
import { strings } from '../strings.ts'
import { formatUTC5Time } from '../utils/utc5-time.ts'

interface DelayBannerProps {
  lastBatchAt: string | null
}

function formatLastBatchAt(isoString: string): string {
  return formatUTC5Time(new Date(isoString))
}

export function DelayBanner({ lastBatchAt }: DelayBannerProps) {
  const message = lastBatchAt
    ? `⚠️ ${strings.dashboard.delayBannerPrefix} ${formatLastBatchAt(lastBatchAt)}`
    : `⚠️ ${strings.dashboard.delayBannerNoData}`

  return (
    <Alert
      type="warning"
      title={message}
      role="alert"
      showIcon={false}
      closable={false}
      style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}
    />
  )
}
