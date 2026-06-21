import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert, ConfigProvider, Layout, Menu, Spin, Typography, theme, type MenuProps } from 'antd'
import { useOpsStatus } from '../api/ops.ts'
import { HealthPanel } from '../components/ops/health-panel.tsx'
import { KeywordRegistryPanel } from '../components/ops/keyword-registry-panel.tsx'
import { PipelineLogPanel } from '../components/ops/pipeline-log-panel.tsx'
import { SignalsBrowserPanel } from '../components/ops/signals-browser-panel.tsx'
import { SimulatorPanel } from '../components/ops/simulator-panel.tsx'
import { strings } from '../strings.ts'

type OpsSectionKey = 'simulator' | 'pipeline-log' | 'keyword-registry' | 'signals-browser' | 'health'

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

const menuItems: MenuProps['items'] = opsSections.map(section => ({
  key: section.key,
  label: section.label,
}))

function findSection(key: OpsSectionKey) {
  return opsSections.find(section => section.key === key) ?? opsSections[0]
}

export function OpsPage() {
  return (
    <QueryClientProvider client={opsQueryClient}>
      <OpsPageContent />
    </QueryClientProvider>
  )
}

function OpsPageContent() {
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <OpsPageThemedContent />
    </ConfigProvider>
  )
}

function OpsPageThemedContent() {
  const [activeSectionKey, setActiveSectionKey] = useState<OpsSectionKey>('simulator')
  const activeSection = findSection(activeSectionKey)
  const { data: opsStatus, isLoading, isError, error } = useOpsStatus()
  const { token } = theme.useToken()

  useEffect(() => {
    document.title = `${strings.ops.documentTitle} — ${activeSection.label}`
  }, [activeSection.label])

  const handleSectionChange: MenuProps['onClick'] = ({ key }) => {
    setActiveSectionKey(key as OpsSectionKey)
  }

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
      <div
        style={{
          height: '100%',
          overflow: 'auto',
          padding: 24,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <Typography.Title level={2} style={{ marginTop: 0 }}>
          {activeSection.label}
        </Typography.Title>
        {activeSection.panel}
      </div>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <Typography.Title level={1} style={{ margin: 0, fontSize: 20 }}>
          {strings.ops.pageTitle}
        </Typography.Title>
      </Layout.Header>
      <Layout hasSider style={{ minHeight: 'calc(100vh - 64px)' }}>
        {opsStatus?.isEnabled === false ? null : (
          <Layout.Sider
            width={248}
            style={{
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgElevated,
            }}
          >
            <Menu
              mode="inline"
              theme="dark"
              items={menuItems}
              selectedKeys={[activeSection.key]}
              onClick={handleSectionChange}
              style={{ height: '100%', borderInlineEnd: 0, paddingTop: 8 }}
            />
          </Layout.Sider>
        )}
        <Layout.Content style={{ minWidth: 0, padding: 24 }}>
          {renderContent()}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
