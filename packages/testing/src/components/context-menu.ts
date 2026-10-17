import { contextMenuContract, nonModalContextMenuContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Context Menu whose region contains `text` (a closed menu has no content
 * to find). `modal: false` for a non-modal one.
 */
export function getContextMenu(
  target: Target,
  anchor: { readonly text: string | RegExp; readonly modal?: boolean },
  options?: DriverOptions,
) {
  const { modal, ...locate } = anchor
  return createDriverWith(
    modal === false
      ? (nonModalContextMenuContract as unknown as typeof contextMenuContract) // same actions and queries; only the traits differ
      : contextMenuContract,
    target,
    [locate],
    options,
  )
}
