import { strings } from '../../strings.ts'

export function HealthPanel() {
  return <div>{strings.ops.panelPlaceholder(strings.ops.nav.health)}</div>
}
