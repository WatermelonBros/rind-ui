import { menubarContract, menubarMenuContract, nonModalMenubarMenuContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Menubar named `name`; `menu(item)` drives the menu of the bar item named
 * `item` with the Menu driver's actions and queries. `modal: false` for a non-modal bar.
 */
export function getMenubar(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly modal?: boolean },
  options?: DriverOptions,
) {
  const { modal, ...locate } = anchor
  const bar = createDriverWith(menubarContract, target, [locate], options)
  const menus =
    modal === false
      ? (nonModalMenubarMenuContract as unknown as typeof menubarMenuContract) // same actions and queries; only the traits differ
      : menubarMenuContract
  return Object.assign(bar, {
    menu: (item: string | RegExp) => createDriverWith(menus, target, [{ name: item }], options),
  })
}
