import {
  DIALOG_PARENT_KINDS,
  type DialogChangeDetails,
  type DialogMessages,
  type DialogProps,
  type DismissEvent,
  dialogConnect,
  dialogLayerId,
  type dialogMachine,
  getLayerStack,
  type HeadingLevel,
  type LayerMeta,
  type Modality,
  partId,
  type Service,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { createContext } from "../context"
import { useParentLayer } from "../layer-context"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import type { DialogActions, DialogRole } from "./types"

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }
type View = ReturnType<Service<typeof dialogMachine>["view"]>

/** A dialog-family member's context (Dialog, Drawer): internal. */
export interface DialogHost {
  /** The family member: `dialog` or `drawer` (scope, names). */
  readonly scope: string
  /** The layer kind: `alertdialog` for a `role="alertdialog"` dialog. */
  readonly kind: () => "dialog" | "alertdialog" | "drawer"
  readonly role: () => DialogRole
  readonly service: Service<typeof dialogMachine>
  readonly view: () => View
  readonly root: () => string
  readonly modal: () => boolean
  readonly keepMounted: () => boolean
  readonly titleFocusTarget: () => boolean
  readonly messages: () => DialogMessages
  /** Mutable shared state (a `$state` object owned by the Root). */
  readonly shared: {
    contentMounted: boolean
    titleLevel: HeadingLevel
    /** Ids of the mounted title and description: the only source of the ARIA references. */
    rendered: Rendered
    /** The stack's metadata for this layer, followed while open. */
    meta: LayerMeta | undefined
  }
}
export const dialogHost = createContext<DialogHost>("dialog")

export const isOpen = (ctx: DialogHost) => ctx.view().matches("open")

/** The connect input, for a family member's own parts (a drawer's Handle). */
export function dialogInput(
  ctx: DialogHost,
  focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {},
) {
  const view = ctx.view()
  return {
    instance: ctx.root(),
    open: view.matches("open"),
    opener: view.context.opener,
    closeReason: view.context.closeReason,
    rendered: ctx.shared.rendered,
    contentMounted: ctx.shared.contentMounted,
    meta: ctx.shared.meta,
    titleFocusTarget: ctx.titleFocusTarget(),
    ...focus,
    messages: ctx.messages(),
  }
}

export function dialogApi(
  ctx: DialogHost,
  focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {},
) {
  return dialogConnect(
    { ...dialogInput(ctx, focus), scope: ctx.scope, role: ctx.role(), modal: ctx.modal() },
    ctx.service.send,
  )
}

/** The Root's own props (Dialog and Drawer), as getters. */
export interface DialogRootInput {
  readonly role: () => DialogRole
  readonly open: () => boolean | undefined
  /** Writes `bind:open` back (only when bound). */
  readonly setOpen: (open: boolean) => void
  readonly defaultOpen: () => boolean | undefined
  readonly onOpenChange: () => ((open: boolean, details: DialogChangeDetails) => void) | undefined
  readonly modal: () => boolean | undefined
  readonly closeOnEscape: () => boolean | undefined
  readonly closeOnInteractOutside: () => boolean | undefined
  readonly initialFocus: () => DialogProps["initialFocus"]
  readonly finalFocus: () => DialogProps["finalFocus"]
  readonly onEscapeKeyDown: () => ((event: DismissEvent) => void) | undefined
  readonly onInteractOutside: () => ((event: DismissEvent) => void) | undefined
  readonly id: () => string | undefined
  readonly uid: string
  readonly keepMounted: () => boolean
  readonly messages: () => DialogMessages
  /** A family member's own machine props (a drawer's side, snap points). */
  readonly extra?: () => Record<string, unknown>
}

/** A dialog-family member's Root: its machine, scope and layer kind. Call during initialisation. */
export function useDialogRoot(
  family: {
    readonly scope: string
    readonly kind: "dialog" | "drawer"
    readonly machine: typeof dialogMachine
  },
  input: DialogRootInput,
): { readonly host: DialogHost; readonly actions: DialogActions } {
  const parent = useParentLayer(DIALOG_PARENT_KINDS)
  const env = useEnvironment()
  const root = () => input.id() ?? input.uid
  const machine = useMachine(
    family.machine,
    () => ({
      role: input.role(),
      open: input.open(),
      defaultOpen: input.defaultOpen(),
      onOpenChange: (next: boolean, details: DialogChangeDetails) => {
        let cancelled = false
        input.onOpenChange()?.(next, {
          ...details,
          cancel: () => {
            cancelled = true
            details.cancel()
          },
        })
        if (!cancelled) input.setOpen(next)
      },
      modal: input.modal(),
      closeOnEscape: input.closeOnEscape(),
      closeOnInteractOutside: input.closeOnInteractOutside(),
      initialFocus: input.initialFocus(),
      finalFocus: input.finalFocus(),
      onEscapeKeyDown: input.onEscapeKeyDown(),
      onInteractOutside: input.onInteractOutside(),
      root: root(),
      parent: parent(),
      ...input.extra?.(),
    }),
    env,
  )
  const shared = $state({
    contentMounted: false,
    titleLevel: 2 as HeadingLevel,
    rendered: {} as Rendered,
    meta: undefined as LayerMeta | undefined,
  })
  $effect(() => {
    shared.meta = undefined
    if (!machine.view.matches("open")) return
    const layer = dialogLayerId(family.scope, root())
    return untrack(() => {
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => {
        shared.meta = stack.get(layer)?.meta()
      }
      read()
      return stack.subscribe(read)
    })
  })
  const host: DialogHost = {
    scope: family.scope,
    kind: () => (input.role() === "alertdialog" ? "alertdialog" : family.kind),
    role: input.role,
    service: machine.service,
    view: () => machine.view,
    root,
    // A confirmation is always modal.
    modal: () => input.role() === "alertdialog" || input.modal() !== false,
    keepMounted: input.keepMounted,
    titleFocusTarget: () => input.initialFocus() === "title",
    messages: input.messages,
    shared,
  }
  dialogHost.set(host)
  return {
    host,
    actions: {
      open: () => machine.send({ type: "OPEN" }),
      close: () => machine.send({ type: "CLOSE" }),
    },
  }
}

/** Focus and modality of a button part, plus its press. Call during initialisation. */
export function useButton(onPress: (modality: Modality) => void, disabled = () => false) {
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  $effect(() => env.modality.subscribe(() => {}))
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
  })
  return {
    env,
    get focused() {
      return focused
    },
    get modality() {
      return modality.current
    },
    press,
    handlers: {
      onfocus: () => (focused = true),
      onblur: () => (focused = false),
    },
  }
}

/** A repeatable button's id: the consumer's, else the instance's plus a generated suffix. */
export function partIdOf(ctx: DialogHost, part: string, own: string | undefined, uid: string) {
  return own ?? partId(ctx.scope, ctx.root(), `${part}-${uid}`)
}

/** Registers a title/description part with the Root while it is mounted. */
export function useRegistered(ctx: DialogHost, part: "title" | "description") {
  $effect(() => {
    const id = partId(ctx.scope, ctx.root(), part)
    untrack(() => {
      ctx.shared.rendered = { ...ctx.shared.rendered, [part]: id }
    })
    return () =>
      untrack(() => {
        ctx.shared.rendered = { ...ctx.shared.rendered, [part]: undefined }
      })
  })
}
