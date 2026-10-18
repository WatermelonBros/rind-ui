import { codeBlockContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Code Block titled `title`, or the only one in `target`. */
export function getCodeBlock(
  target: Target,
  anchor?: { readonly title: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(codeBlockContract, target, anchor ? [anchor] : [], options)
}
