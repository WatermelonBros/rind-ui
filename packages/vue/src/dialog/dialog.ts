import {
  DIALOG_PARENT_KINDS,
  type DialogChangeDetails,
  type DialogCloseReason,
  type DialogMessages,
  type DialogProps,
  type DismissEvent,
  dialogConnect,
  dialogLayerId,
  dialogMachine,
  dialogMessages,
  type FocusTarget,
  getLayerStack,
  type HeadingLevel,
  type LayerMeta,
  type MessageOverrides,
  type Modality,
  partId,
  type Service,
} from "@rind-ui/core"
import {
  type ComputedRef,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import { provideHeadingSection } from "../heading/heading"
import { joinHandlers } from "../join-handlers"
import { keepStyle } from "../keep-style"
import { provideLayer, useParentLayer } from "../layer-context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    dialog: DialogMessages
  }
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }
type View = ReturnType<Service<typeof dialogMachine>["view"]>

/** A dialog-family member's context (Dialog, Drawer): internal. */
export interface DialogCtx {
  /** The family member: `dialog` or `drawer` (scope, names). */
  readonly scope: string
  /** The layer kind: `alertdialog` for a `role="alertdialog"` dialog. */
  readonly kind: () => "dialog" | "alertdialog" | "drawer"
  readonly role: () => "dialog" | "alertdialog"
  readonly service: Service<typeof dialogMachine>
  readonly view: ComputedRef<View>
  readonly root: () => string
  readonly modal: () => boolean
  readonly keepMounted: () => boolean
  readonly titleFocusTarget: () => boolean
  readonly messages: ComputedRef<DialogMessages>
  readonly contentMounted: ShallowRef<boolean>
  readonly titleLevel: ShallowRef<HeadingLevel>
  /** Ids of the mounted title and description: the only source of the ARIA references. */
  readonly rendered: ShallowRef<Rendered>
  /** The stack's metadata for this layer, followed while open. */
  readonly meta: ShallowRef<LayerMeta | undefined>
}

export const DialogKey: InjectionKey<DialogCtx> = Symbol("rind-ui.dialog")
export function useDialog(part: string): DialogCtx {
  const ctx = inject(DialogKey, null)
  if (!ctx) throw new Error(`${part} must be inside its Dialog or Drawer Root`)
  return ctx
}

const isOpen = (ctx: DialogCtx) => ctx.view.value.matches("open")

/** The connect input, for a family member's own parts (a drawer's Handle). */
export function dialogInput(
  ctx: DialogCtx,
  focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {},
) {
  const view = ctx.view.value
  return {
    instance: ctx.root(),
    open: view.matches("open"),
    opener: view.context.opener,
    closeReason: view.context.closeReason,
    rendered: ctx.rendered.value,
    contentMounted: ctx.contentMounted.value,
    meta: ctx.meta.value,
    titleFocusTarget: ctx.titleFocusTarget(),
    ...focus,
    messages: ctx.messages.value,
  }
}

export function dialogApi(
  ctx: DialogCtx,
  focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {},
) {
  return dialogConnect(
    { ...dialogInput(ctx, focus), scope: ctx.scope, role: ctx.role(), modal: ctx.modal() },
    ctx.service.send,
  )
}

/** What the Root's template ref exposes. */
export interface DialogActions {
  open(): void
  close(): void
}

/** The content's role: a dialog, or a confirmation that interrupts. */
export type DialogRole = "dialog" | "alertdialog"

export interface DialogTriggerState {
  readonly open: boolean
}

export interface DialogContentState {
  readonly open: boolean
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

/** The Root's props, shared by the family (Drawer adds its own). */
export const dialogRootProps = {
  /** `alertdialog`: a confirmation. Always modal, an outside press never closes it, focus starts on Cancel, a missing description warns. */
  role: { type: String as PropType<DialogRole>, default: "dialog" },
  /** Controlled visibility (`v-model:open`). */
  open: { type: Boolean, default: undefined },
  defaultOpen: { type: Boolean, default: undefined },
  /** Default true (a confirmation is always modal). */
  modal: { type: Boolean, default: undefined },
  /** Default true. */
  closeOnEscape: { type: Boolean, default: undefined },
  /** Default: `modal` (never for a confirmation). */
  closeOnInteractOutside: { type: Boolean, default: undefined },
  /** `null`: the overlay's rule; `false`: focus does not move; a part name or a function. */
  initialFocus: {
    type: [String, Function, Boolean] as PropType<
      "content" | "title" | "cancel" | (() => FocusTarget) | null | false
    >,
    default: undefined,
  },
  /** `null`: back to the opener; `false`: focus does not move. */
  finalFocus: {
    type: [Function, Boolean] as PropType<
      ((reason: DialogCloseReason | undefined) => FocusTarget) | null | false
    >,
    default: undefined,
  },
  /** The base of the generated part ids. Default: a generated id. */
  id: String,
  /** Content, backdrop and positioner stay mounted (hidden) while closed. */
  keepMounted: Boolean,
  messages: Object as PropType<MessageOverrides<DialogMessages>>,
} as const

export const dialogRootEmits = {
  openChange: (_open: boolean, _details: DialogChangeDetails) => true,
  "update:open": (_open: boolean) => true,
  /** Escape is about to close it; `event.preventDefault()` keeps it open. */
  escapeKeyDown: (_event: DismissEvent) => true,
  /** A press or focus outside is about to close it; `event.preventDefault()` keeps it open. */
  interactOutside: (_event: DismissEvent) => true,
}

type RootProps = {
  readonly role: DialogRole
  readonly open: boolean | undefined
  readonly defaultOpen: boolean | undefined
  readonly modal: boolean | undefined
  readonly closeOnEscape: boolean | undefined
  readonly closeOnInteractOutside: boolean | undefined
  readonly initialFocus: DialogProps["initialFocus"]
  readonly finalFocus: DialogProps["finalFocus"]
  readonly id: string | undefined
  readonly keepMounted: boolean
  readonly messages: MessageOverrides<DialogMessages> | undefined
}
type Emit = ((e: "openChange", open: boolean, details: DialogChangeDetails) => void) &
  ((e: "update:open", open: boolean) => void) &
  ((e: "escapeKeyDown" | "interactOutside", event: DismissEvent) => void)

/** A dialog-family member's Root setup: its machine, scope and layer kind. Internal. */
export function setupDialogRoot(
  family: {
    readonly scope: string
    readonly kind: "dialog" | "drawer"
    readonly machine: typeof dialogMachine
  },
  props: RootProps,
  emit: Emit,
  expose: (exposed: DialogActions) => void,
  messages: ComputedRef<DialogMessages>,
  /** A family member's own machine props (a drawer's side, snap points). */
  extra: () => Record<string, unknown> = () => ({}),
): DialogCtx {
  const root = useRootId(() => props.id)
  const parent = useParentLayer(DIALOG_PARENT_KINDS)
  const env = useEnvironment()
  // As changeEmitter, for the dialog's own details type (its reasons are the dialog's).
  const onOpenChange = (v: boolean, d: DialogChangeDetails) => {
    let cancelled = false
    emit("openChange", v, {
      ...d,
      cancel() {
        cancelled = true
        d.cancel()
      },
    })
    if (!cancelled) emit("update:open", v)
  }
  const { view, send, service } = useMachine(
    family.machine,
    () => ({
      role: props.role,
      open: props.open,
      defaultOpen: props.defaultOpen,
      onOpenChange,
      modal: props.modal,
      closeOnEscape: props.closeOnEscape,
      closeOnInteractOutside: props.closeOnInteractOutside,
      initialFocus: props.initialFocus,
      finalFocus: props.finalFocus,
      onEscapeKeyDown: (e: DismissEvent) => emit("escapeKeyDown", e),
      onInteractOutside: (e: DismissEvent) => emit("interactOutside", e),
      root: root(),
      parent: parent(),
      ...extra(),
    }),
    env,
  )
  expose({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) })
  const meta = shallowRef<LayerMeta | undefined>(undefined)
  onMounted(() =>
    watch(
      [() => view.value.matches("open"), root] as const,
      ([open, id], _, onCleanup) => {
        meta.value = undefined
        if (!open) return
        const node = env.dom.getRootNode()
        const stack = getLayerStack("body" in node ? node : node.ownerDocument)
        const read = () => (meta.value = stack.get(dialogLayerId(family.scope, id))?.meta())
        read()
        onCleanup(stack.subscribe(read))
      },
      { immediate: true },
    ),
  )
  const ctx: DialogCtx = {
    scope: family.scope,
    kind: () => (props.role === "alertdialog" ? "alertdialog" : family.kind),
    role: () => props.role,
    service,
    view,
    root,
    // A confirmation is always modal.
    modal: () => props.role === "alertdialog" || props.modal !== false,
    keepMounted: () => props.keepMounted,
    titleFocusTarget: () => props.initialFocus === "title",
    messages,
    contentMounted: shallowRef(false),
    titleLevel: shallowRef<HeadingLevel>(2),
    rendered: shallowRef<Rendered>({}),
    meta,
  }
  provide(DialogKey, ctx)
  return ctx
}

const Root = defineComponent({
  name: "DialogRoot",
  props: dialogRootProps,
  emits: dialogRootEmits,
  slots: Object as Slots<{ open: boolean }>,
  setup(props, { slots, emit, expose }) {
    const messages = useMessages("dialog", dialogMessages, () => props.messages)
    const ctx = setupDialogRoot(
      { scope: "dialog", kind: "dialog", machine: dialogMachine },
      props,
      emit as Emit,
      expose,
      messages,
    )
    return () => slots.default?.({ open: isOpen(ctx) })
  },
})

/** Focus and modality of a button part, plus its press. */
function useButton(onPress: (modality: Modality) => void, disabled: () => boolean = () => false) {
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
  })
  const handlers = {
    onFocus: () => (focused.value = true),
    onBlur: () => (focused.value = false),
  }
  return { env, focused, modality, press, handlers }
}

/** A part id for a repeatable button: the consumer's, else the instance's plus a generated suffix. */
function usePartId(ctx: DialogCtx, part: string, own: () => string | undefined) {
  const generated = useId()
  return () => own() ?? partId(ctx.scope, ctx.root(), `${part}-${generated.replace(/:/g, "")}`)
}

export const Trigger = defineComponent({
  name: "DialogTrigger",
  inheritAttrs: false,
  props: { id: String, disabled: Boolean, ...asChildProp },
  slots: Object as Slots<DialogTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = useDialog("Trigger")
    const id = usePartId(ctx, "trigger", () => props.id)
    const b = useButton(
      (m) => dialogApi(ctx).pressTrigger(id(), m),
      () => props.disabled,
    )
    return () => {
      const own = normalizeProps(
        dialogApi(ctx).trigger({
          id: id(),
          focused: b.focused.value,
          modality: b.modality.value,
          pressed: b.press.pressed.value,
          disabled: props.disabled,
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(own, b.press.props, b.handlers),
          ...(props.disabled ? { disabled: true } : {}),
        },
        attrs,
      )
      return renderPart("button", merged, slots.default?.({ open: isOpen(ctx) }), props.asChild)
    }
  },
})

export const Backdrop = defineComponent({
  name: "DialogBackdrop",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useDialog("Backdrop")
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(() => isOpen(ctx), el, { keepMounted: ctx.keepMounted })
    return () => {
      // Non-modal dialogs render no backdrop: the page stays usable (zag#3401).
      if (!ctx.modal() || !presence.mounted) return null
      const merged = mergeProps(
        {
          ...normalizeProps(dialogApi(ctx).backdrop()),
          hidden: !isOpen(ctx) && ctx.keepMounted(),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("div", merged, slots.default?.(), props.asChild)
    }
  },
})

export const Positioner = defineComponent({
  name: "DialogPositioner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useDialog("Positioner")
    const el = shallowRef<Element | null>(null)
    // It holds the content: it stays while the content's exit animations run.
    const presence = usePresence(() => isOpen(ctx), el, {
      keepMounted: ctx.keepMounted,
      subtree: () => true,
    })
    return () => {
      if (!presence.mounted) return null
      const merged = mergeProps(
        {
          ...normalizeProps(dialogApi(ctx).positioner()),
          hidden: !isOpen(ctx) && ctx.keepMounted(),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("div", merged, slots.default?.(), props.asChild)
    }
  },
})

export const Content = defineComponent({
  name: "DialogContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<DialogContentState>,
  setup(props, { attrs, slots }) {
    const ctx = useDialog("Content")
    const env = useEnvironment()
    // Layers opened from here are this dialog's children; headings inside the body are one
    // level below the title.
    provideLayer(
      () => dialogLayerId(ctx.scope, ctx.root()),
      () => ctx.kind(),
    )
    provideHeadingSection(() => Math.min(6, ctx.titleLevel.value + 1) as HeadingLevel)
    const focusWithin = shallowRef(false)
    const contentFocused = shallowRef(false)
    const modality = useModality(env.modality, () => contentFocused.value)
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(() => isOpen(ctx), el, { keepMounted: ctx.keepMounted })
    // The scroll lock writes to this element's style too.
    const kept = keepStyle()
    onMounted(() =>
      watch(
        () => (presence.mounted ? el.value : null),
        (node, _, onCleanup) => {
          ctx.contentMounted.value = node !== null
          if (!(node instanceof HTMLElement)) return
          onCleanup(() => (ctx.contentMounted.value = false))
          // Focus within, from the DOM itself: native focusin/focusout on the content plus a
          // check of the active element on attach and at the next frame (the initial focus
          // move), so it holds where a focus move does not reach the handlers (WebKit on Linux).
          const sync = () => {
            const active = node.ownerDocument.activeElement
            focusWithin.value = active !== null && node.contains(active)
            contentFocused.value = active === node
          }
          const onFocusOut = (e: FocusEvent) => {
            const next = e.relatedTarget as Node | null
            if (next && node.contains(next)) return
            focusWithin.value = false
            contentFocused.value = false
          }
          sync()
          const frame = env.scheduler.requestAnimationFrame(sync)
          node.addEventListener("focusin", sync)
          node.addEventListener("focusout", onFocusOut)
          onCleanup(() => {
            env.scheduler.cancelAnimationFrame(frame)
            node.removeEventListener("focusin", sync)
            node.removeEventListener("focusout", onFocusOut)
          })
        },
        { immediate: true, flush: "post" },
      ),
    )
    return () => {
      if (!presence.mounted) return null
      const open = isOpen(ctx)
      const exiting = !open && presence.state === "exiting"
      const {
        "aria-labelledby": labelledBy,
        "aria-describedby": describedBy,
        ...rest
      } = attrs as Record<string, unknown>
      const own = dialogApi(ctx, {
        focusWithin: focusWithin.value,
        contentFocused: contentFocused.value,
        modality: modality.value,
      }).content({
        labelledBy: labelledBy as string | undefined,
        describedBy: describedBy as string | undefined,
      })
      const merged = mergeProps(
        {
          ...normalizeProps(own),
          hidden: !open && !exiting && ctx.keepMounted(),
          // Closing: presses on the exiting content do nothing (mui/base-ui#3153).
          ...(exiting ? { inert: "" } : {}),
          ref: refTo(el),
        },
        rest,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.({ open }), props.asChild))
    }
  },
})

/** Registers a title/description part with the Root while it is mounted. */
function useRegistered(ctx: DialogCtx, part: "title" | "description") {
  onMounted(() =>
    watch(
      () => partId(ctx.scope, ctx.root(), part),
      (id, _, onCleanup) => {
        ctx.rendered.value = { ...ctx.rendered.value, [part]: id }
        onCleanup(() => (ctx.rendered.value = { ...ctx.rendered.value, [part]: undefined }))
      },
      { immediate: true },
    ),
  )
}

export const Title = defineComponent({
  name: "DialogTitle",
  inheritAttrs: false,
  props: {
    /** The heading level (default 2); headings in the content are one level below. */
    level: { type: Number as PropType<HeadingLevel>, default: 2 },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useDialog("Title")
    useRegistered(ctx, "title")
    watch(
      () => props.level,
      (level) => (ctx.titleLevel.value = level),
      { immediate: true },
    )
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const children = slots.default?.()
      const fallback = `h${props.level}`
      const tag = renderedTag(fallback, children, props.asChild, measured.value)
      const merged = mergeProps(
        { ...normalizeProps(dialogApi(ctx).title({ level: props.level, tag })), ref: refTo(el) },
        attrs,
      )
      return renderPart(fallback, merged, children, props.asChild)
    }
  },
})

export const Description = defineComponent({
  name: "DialogDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useDialog("Description")
    useRegistered(ctx, "description")
    return () =>
      renderPart(
        "p",
        mergeProps(normalizeProps(dialogApi(ctx).description()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** Cancel and Action: press-activated buttons that close with their own reason. */
function closeButton(part: "cancel" | "action") {
  return defineComponent({
    name: part === "cancel" ? "DialogCancel" : "DialogAction",
    inheritAttrs: false,
    props: { id: String, disabled: Boolean, ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useDialog(part === "cancel" ? "Cancel" : "Action")
      const id = usePartId(ctx, part, () => props.id)
      const b = useButton(
        (m) => {
          if (part === "cancel") dialogApi(ctx).pressCancel(m)
          else dialogApi(ctx).pressAction(id(), m)
        },
        () => props.disabled,
      )
      return () => {
        const own = normalizeProps(
          dialogApi(ctx)[part]({
            id: id(),
            focused: b.focused.value,
            modality: b.modality.value,
            pressed: b.press.pressed.value,
            disabled: props.disabled,
          }),
        )
        const merged = mergeProps(
          {
            ...joinHandlers(own, b.press.props, b.handlers),
            ...(props.disabled ? { disabled: true } : {}),
          },
          attrs,
        )
        return renderPart("button", merged, slots.default?.(), props.asChild)
      }
    },
  })
}

export const Cancel = closeButton("cancel")
export const Action = closeButton("action")

export const CloseTrigger = defineComponent({
  name: "DialogCloseTrigger",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useDialog("CloseTrigger")
    const id = usePartId(ctx, "close", () => props.id)
    const el = shallowRef<Element | null>(null)
    const b = useButton((m) => {
      const node = el.value as HTMLButtonElement | null
      // A submit button of a form: close on that form's submit, so the form is still
      // connected when it submits (radix#1109, #1779); an invalid form keeps it open.
      if (node?.type === "submit" && node.form) {
        const form = node.form
        const onSubmit = () => dialogApi(ctx).pressClose(m)
        form.addEventListener("submit", onSubmit, { once: true })
        b.env.scheduler.setTimeout(() => form.removeEventListener("submit", onSubmit), 0)
        return
      }
      dialogApi(ctx).pressClose(m)
    })
    // No content of its own (an icon): named by messages.close.
    const empty = shallowRef(false)
    const measure = () => (empty.value = (el.value?.textContent ?? "").trim() === "")
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const own = normalizeProps(
        dialogApi(ctx).closeTrigger({
          id: id(),
          focused: b.focused.value,
          modality: b.modality.value,
          pressed: b.press.pressed.value,
          empty: empty.value,
        }),
      )
      const merged = mergeProps(
        { ...joinHandlers(own, b.press.props, b.handlers), ref: refTo(el) },
        attrs,
      )
      return renderPart("button", merged, slots.default?.(), props.asChild)
    }
  },
})

export const Portal = defineComponent({
  name: "DialogPortal",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const ctx = useDialog("Portal")
    const env = useEnvironment()
    // The opener once open; before that (and when opened programmatically) the first trigger,
    // so the host carries the trigger's theme, dir and lang from the first open on.
    const logicalParent = () => {
      const opener = ctx.view.value.context.opener
      return (
        (opener ? env.dom.getById(opener) : null) ??
        env.dom
          .getRootNode()
          .querySelector?.(
            `[data-scope="${ctx.scope}"][data-part="trigger"][data-instance="${ctx.root()}"]`,
          ) ??
        null
      )
    }
    return () => h(PortalPart, { logicalParent, ...attrs }, slots)
  },
})

export { Root }
