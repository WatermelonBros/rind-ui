import { promptInputContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Prompt Input whose Textarea is named `name`: type, submit, stop, attach, recall, queries. */
export function getPromptInput(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(promptInputContract, target, [anchor], options)
}
