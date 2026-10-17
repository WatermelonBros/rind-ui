import { alertContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for an Alert: the one whose Title's text is `title`, or the one alert inside
 * `within` (a container element or a Playwright locator; default the target).
 * `announcements()` lists what it announced since the driver was created.
 */
export function getAlert(
  target: Target,
  anchor: { readonly title?: string | RegExp; readonly within?: Target } = {},
  options?: DriverOptions,
) {
  const { within, title } = anchor
  return createDriverWith(
    alertContract,
    within ?? target,
    [title === undefined ? {} : { title }],
    options,
  )
}
