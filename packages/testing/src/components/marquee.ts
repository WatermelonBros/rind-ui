import { marqueeContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Marquee named `name` (role `region` unless given), or the only one. */
export function getMarquee(
  target: Target,
  anchor?: Parameters<typeof marqueeContract.locate>[0],
  options?: DriverOptions,
) {
  return createDriverWith(marqueeContract, target, anchor ? [anchor] : [], options)
}
