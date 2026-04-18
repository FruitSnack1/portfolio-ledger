import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

type AppTooltipProps = {
  content: ReactNode
  children: ReactNode
}

/** Radix tooltip; app root must wrap content in TooltipProvider. */
export function AppTooltip({ content, children }: AppTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="app-tooltip-content" sideOffset={6}>
          {content}
          <Tooltip.Arrow className="app-tooltip-arrow" width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
