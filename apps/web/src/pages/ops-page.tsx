import { useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { Alert, ConfigProvider, Segmented, Spin, Typography, theme } from 'antd'
import { mahallaTheme } from '../theme.ts'
import { useOpsStatus } from '../api/ops.ts'
import { AppShell } from '../components/app-shell.tsx'
import { HealthPanel } from '../components/ops/health-panel.tsx'
import { KeywordRegistryPanel } from '../components/ops/keyword-registry-panel.tsx'
import { PipelineLogPanel } from '../components/ops/pipeline-log-panel.tsx'
import { SignalsBrowserPanel } from '../components/ops/signals-browser-panel.tsx'
import { SimulatorPanel } from '../components/ops/simulator-panel.tsx'
import { type OpsSectionKey, useOpsSectionState } from '../components/ops/hooks/use-ops-section-state.ts'
import { strings } from '../strings.ts'

const opsQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const opsSections: Array<{
  key: OpsSectionKey
  label: string
  panel: JSX.Element
}> = [
  {
    key: 'simulator',
    label: strings.ops.nav.simulator,
    panel: <SimulatorPanel />,
  },
  {
    key: 'pipeline-log',
    label: strings.ops.nav.pipelineLog,
    panel: <PipelineLogPanel />,
  },
  {
    key: 'keyword-registry',
    label: strings.ops.nav.keywordRegistry,
    panel: <KeywordRegistryPanel />,
  },
  {
    key: 'signals-browser',
    label: strings.ops.nav.signalsBrowser,
    panel: <SignalsBrowserPanel />,
  },
  {
    key: 'health',
    label: strings.ops.nav.health,
    panel: <HealthPanel />,
  },
]

const segmentedOptions = opsSections.map(section => ({
  label: section.label,
  value: section.key,
}))

function findSection(key: OpsSectionKey) {
  return opsSections.find(section => section.key === key) ?? opsSections[0]
}

export function OpsPage() {
  const appQueryClient = useQueryClient()

  return (
    <QueryClientProvider client={opsQueryClient}>
      <ConfigProvider theme={mahallaTheme}>
        <OpsPageContent appQueryClient={appQueryClient} />
      </ConfigProvider>
    </QueryClientProvider>
  )
}

interface OpsPageContentProps {
  appQueryClient: QueryClient
}

function OpsPageContent({ appQueryClient }: OpsPageContentProps) {
  const { activeSectionKey, setActiveSectionKey } = useOpsSectionState()
  const activeSection = findSection(activeSectionKey)
  const { data: opsStatus, isLoading, isError, error } = useOpsStatus()
  const { token } = theme.useToken()

  useEffect(() => {
    document.title = `${strings.ops.documentTitle} — ${activeSection.label}`
  }, [activeSection.label])

  // Ops is accessible when loaded successfully and not disabled/forbidden
  const isAccessible =
    !isLoading &&
    !isError &&
    opsStatus?.isEnabled !== false &&
    !opsStatus?.isForbidden

  // Horizontal Segmented nav — only shown when ops is accessible
  const segmentedNav = isAccessible ? (
    <Segmented
      id="ops-section-nav"
      value={activeSectionKey}
      onChange={v => setActiveSectionKey(v as OpsSectionKey)}
      options={segmentedOptions}
      size="small"
    />
  ) : undefined

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ display: 'grid', minHeight: 240, placeItems: 'center' }}>
          <Spin description={strings.ops.loadingMessage} />
        </div>
      )
    }

    if (opsStatus?.isEnabled === false) {
      return (
        <Alert
          type="warning"
          showIcon
          title={strings.ops.disabledMessage}
        />
      )
    }

    if (opsStatus?.isForbidden) {
      return (
        <Alert
          type="error"
          showIcon
          title={strings.ops.forbiddenMessage}
        />
      )
    }

    if (isError) {
      return (
        <Alert
          type="error"
          showIcon
          title={(error as Error).message}
        />
      )
    }

    return (
      <>
        <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 20 }}>
          {activeSection.label}
        </Typography.Title>
        {activeSection.panel}
      </>
    )
  }

  return (
    <AppShell
      filterBar={segmentedNav}
      contentOverflow="auto"
      additionalLogoutQueryClients={[appQueryClient]}
    >
      {/* Ops content zone: shared app board bg, panel in an elevated card */}
      <div
        style={{
          padding: 24,
          minHeight: '100%',
          background: token.colorBgLayout,
        }}
      >
        <div
          style={{
            borderRadius: token.borderRadius,
            background: token.colorBgContainer,
            boxShadow: token.boxShadow,
            border: `1px solid ${token.colorBorder}`,
            padding: 24,
          }}
        >
          {renderContent()}
        </div>
      </div>
    </AppShell>
  )
}
