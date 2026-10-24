import {
  type DrawerMessages,
  type DrawerSide,
  drawerExtras,
  type drawerMachine,
  drawerSide,
  resolvedPoints,
  type Service,
  type SnapPoint,
} from "@rind-ui/core"
import { createContext } from "../context"
import { dialogHost } from "../dialog/context.svelte"

type DrawerService = Service<typeof drawerMachine>

export interface DrawerSettings {
  readonly messages: () => DrawerMessages
  readonly side: () => DrawerSide | undefined
  readonly dir: () => "ltr" | "rtl"
  readonly snapPoints: () => readonly SnapPoint[] | undefined
}
export const drawerSettings = createContext<DrawerSettings>("drawer")

/** The drawer's own view: its service and the extras for the Dialog parts. Call during initialisation. */
export function useDrawer() {
  const ctx = dialogHost.get()
  // Sound: this Root's service is the drawer machine's (see the Root).
  const service = ctx.service as unknown as DrawerService
  const settings = drawerSettings.get()
  const extras = () => {
    // Sound: the view is the drawer machine's (its context and values extend the Dialog's).
    const view = ctx.view() as unknown as ReturnType<DrawerService["view"]>
    const props = { side: settings.side(), dir: settings.dir(), snapPoints: settings.snapPoints() }
    return drawerExtras(
      {
        instance: ctx.root(),
        open: view.matches("open"),
        closeReason: view.context.closeReason,
        side: drawerSide(props),
        swipe: view.context.swipe,
        nested: view.context.nested,
        size: view.context.sizes.content,
        resolved: resolvedPoints(props, view.context.sizes),
        snapPoint: view.values.snapPoint ?? null,
        messages: settings.messages(),
      },
      service.send,
    )
  }
  return { ctx, service, extras }
}
