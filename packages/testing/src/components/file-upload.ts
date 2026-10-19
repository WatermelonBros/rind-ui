import { fileUploadContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the File Upload whose Trigger is named `name`, or the only one in `target`. */
export function getFileUpload(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(fileUploadContract, target, anchor ? [anchor] : [], options)
}
