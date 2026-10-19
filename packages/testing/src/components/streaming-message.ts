import { streamingMessageContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Streaming Message named `name` (role `article` unless given), or the only one. */
export function getStreamingMessage(
  target: Target,
  anchor?: Parameters<typeof streamingMessageContract.locate>[0],
  options?: DriverOptions,
) {
  return createDriverWith(streamingMessageContract, target, anchor ? [anchor] : [], options)
}
