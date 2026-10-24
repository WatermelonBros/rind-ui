// A part composing a Button or a Link as a host directive (a Toolbar's Button, a Breadcrumbs
// Link) drives some of the composed part's inputs: the composed part reads them through this.

import { InjectionToken } from "@angular/core"
import type { Href, LinkCurrent } from "@rind-ui/core"

/** The inputs the composing part decides; each one it leaves out stays the composed part's. */
export interface ControlOverride {
  readonly disabled?: () => boolean
  readonly focusableWhenDisabled?: () => boolean
  readonly id?: () => string | undefined
  readonly current?: () => LinkCurrent | undefined
  readonly href?: () => Href | undefined
}

/**
 * Provided on the element by the composing part, which sets `source` in its constructor; read
 * in renders, after every directive on the element was created.
 */
export class HostedControl {
  source: ControlOverride = {}
}

export const CONTROL_OVERRIDE = new InjectionToken<HostedControl>("rind-ui.control-override")
