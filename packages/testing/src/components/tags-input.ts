import { tagsInputContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Tags Input named `name`: type, addTag, paste, editTag, removeTag, queries. */
export function getTagsInput(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(tagsInputContract, target, [anchor], options)
}
