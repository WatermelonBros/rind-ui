// Drawer: the Dialog's parts with the drawer service, plus Handle, Indent and IndentBackground.
// Wiring only: the drawer's own attributes come from `drawerExtras` and are passed to the
// Dialog parts as props.
import {
  type ChangeDetails,
  type DrawerEvent,
  type DrawerMessages,
  type DrawerSide,
  type dialogMachine,
  dialogMessages,
  drawerExtras,
  drawerIndentProps,
  drawerMachine,
  drawerMessages,
  drawerSide,
  drawerStack,
  type MessageOverrides,
  resolvedPoints,
  type Service,
  type SnapPoint,
} from "@rind-ui/core"
import {
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import {
  Backdrop as DialogBackdrop,
  Content as DialogContent,
  Positioner as DialogPositioner,
  dialogRootEmits,
  dialogRootProps,
  setupDialogRoot,
  useDialog,
} from "../dialog/dialog"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    drawer: DrawerMessages
  }
}

type DrawerService = Service<typeof drawerMachine>

interface Settings {
  readonly messages: () => DrawerMessages
  readonly side: () => DrawerSide | undefined
  readonly dir: () => "ltr" | "rtl"
  readonly snapPoints: () => readonly SnapPoint[] | undefined
}
const SettingsKey: InjectionKey<Settings> = Symbol("rind-ui.drawer")

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

const Root = defineComponent({
  name: "DrawerRoot",
  props: {
    ...dialogRootProps,
    messages: Object as PropType<MessageOverrides<DrawerMessages>>,
    /** Default "bottom". Logical sides resolve from the direction. */
    side: String as PropType<DrawerSide>,
    /** Fraction of the content's size a release must reach to dismiss (default 0.5). */
    swipeThreshold: Number,
    /** px/ms toward the edge that dismisses (default 0.5). */
    swipeVelocityThreshold: Number,
    /** Default true; false keeps the gesture for snap points only. */
    closeOnSwipe: { type: Boolean, default: undefined },
    snapPoints: Array as PropType<readonly SnapPoint[]>,
    /** Controlled snap point (`v-model:snapPoint`). */
    snapPoint: { type: [Number, String] as PropType<SnapPoint>, default: undefined },
    defaultSnapPoint: { type: [Number, String] as PropType<SnapPoint>, default: undefined },
    snapToSequentialPoints: { type: Boolean, default: undefined },
  },
  emits: {
    ...dialogRootEmits,
    snapPointChange: (_value: SnapPoint, _details: ChangeDetails<DrawerEvent>) => true,
    "update:snapPoint": (_value: SnapPoint) => true,
  },
  slots: Object as Slots<{ open: boolean }>,
  setup(props, { slots, emit, expose }) {
    const messages = useMessages("drawer", drawerMessages, () => props.messages)
    const locale = useLocale(() => undefined)
    // The Dialog's messages, its close label the drawer's.
    const dialogStrings = useMessages("dialog", dialogMessages, () => ({
      close: messages.value.close,
    }))
    const onSnapPointChange = (v: SnapPoint, d: ChangeDetails<DrawerEvent>) => {
      let cancelled = false
      emit("snapPointChange", v, {
        ...d,
        cancel() {
          cancelled = true
          d.cancel()
        },
      })
      if (!cancelled) emit("update:snapPoint", v)
    }
    provide(SettingsKey, {
      messages: () => messages.value,
      side: () => props.side,
      dir: () => locale.value.dir,
      snapPoints: () => props.snapPoints,
    })
    const ctx = setupDialogRoot(
      {
        scope: "drawer",
        kind: "drawer",
        // Sound: the drawer machine is the Dialog's pieces plus its own; every Dialog part
        // reads and sends only the Dialog's context, values and events, which it keeps.
        machine: drawerMachine as unknown as typeof dialogMachine,
      },
      props,
      emit as never,
      expose,
      dialogStrings,
      // The drawer's props ride along: the drawer machine reads them.
      () => ({
        side: props.side,
        dir: locale.value.dir,
        swipeThreshold: props.swipeThreshold,
        swipeVelocityThreshold: props.swipeVelocityThreshold,
        closeOnSwipe: props.closeOnSwipe,
        snapPoints: props.snapPoints,
        snapPoint: props.snapPoint,
        defaultSnapPoint: props.defaultSnapPoint,
        onSnapPointChange,
        snapToSequentialPoints: props.snapToSequentialPoints,
      }),
    )
    return () => slots.default?.({ open: ctx.view.value.matches("open") })
  },
})

/** The drawer's own view: its service, props and the extras for the Dialog parts. */
function useDrawer(part: string) {
  const ctx = useDialog(`Drawer.${part}`)
  // Sound: this Root's service is the drawer machine's (see Root).
  const service = ctx.service as unknown as DrawerService
  const settings = inject(SettingsKey, null)
  if (!settings) throw new Error(`Drawer.${part} must be inside Drawer.Root`)
  const extras = () => {
    // Sound: the view is the drawer machine's (its context and values extend the Dialog's).
    const view = ctx.view.value as unknown as ReturnType<DrawerService["view"]>
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

/** A Dialog part with the drawer's extras merged under the consumer's props. */
function withExtras(
  name: string,
  part: typeof DialogPositioner | typeof DialogBackdrop | typeof DialogContent,
  pick: (extras: ReturnType<ReturnType<typeof useDrawer>["extras"]>) => Record<string, unknown>,
) {
  return defineComponent({
    name: `Drawer${name}`,
    inheritAttrs: false,
    slots: Object as SlotsType<{ default?: (state: never) => VNodeChild }>,
    setup(_, { attrs, slots }) {
      const { extras } = useDrawer(name)
      return () =>
        h(part as never, mergeProps(normalizeProps(pick(extras()) as never), attrs), slots)
    },
  })
}

const Positioner = withExtras("Positioner", DialogPositioner, (e) => e.positioner())
const Backdrop = withExtras("Backdrop", DialogBackdrop, (e) => e.backdrop())
const Content = withExtras("Content", DialogContent, (e) => e.content())

/** Inside the content: a button cycling the snap points (two or more), else decorative. */
const Handle = defineComponent({
  name: "DrawerHandle",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const { extras } = useDrawer("Handle")
    const env = useEnvironment()
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") extras().pressHandle(e.modality)
      },
      disabled: () => !extras().handleIsButton,
    })
    return () => {
      const x = extras()
      const own = normalizeProps(
        x.handle({
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
        }),
      )
      if (!x.handleIsButton) {
        return renderPart("div", mergeProps(own, attrs), slots.default?.(), props.asChild)
      }
      const merged = mergeProps(
        joinHandlers(own, press.props, {
          onFocus: () => (focused.value = true),
          onBlur: () => (focused.value = false),
        }),
        attrs,
      )
      return renderPart("button", merged, slots.default?.(), props.asChild)
    }
  },
})

/** `data-active` while a modal drawer is open in the document; the progress after mount. */
function indentPart(name: string, part: "indent" | "indent-background") {
  return defineComponent({
    name: `Drawer${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const env = useEnvironment()
      const active = shallowRef(false)
      const el = shallowRef<Element | null>(null)
      // After mount: the server and the first client render carry no variable (base-ui#4509).
      onMounted(() => {
        const stack = drawerStack(env)
        active.value = stack.active()
        onBeforeUnmount(stack.subscribe(() => (active.value = stack.active())))
        if (el.value instanceof HTMLElement) onBeforeUnmount(stack.registerIndent(el.value))
      })
      return () =>
        renderPart(
          "div",
          mergeProps(
            { ...normalizeProps(drawerIndentProps(part, active.value)), ref: refTo(el) },
            attrs,
          ),
          slots.default?.(),
          props.asChild,
        )
    },
  })
}

const Indent = indentPart("Indent", "indent")
const IndentBackground = indentPart("IndentBackground", "indent-background")

// The Dialog's own parts, as they are: re-exported (a const alias would leak Vue's slot types).
export { CloseTrigger, Description, Portal, Title, Trigger } from "../dialog/dialog"
/** The parts, by name: `drawer.parts.ts` re-exports them as the `Drawer` namespace. */
export { Backdrop, Content, Handle, Indent, IndentBackground, Positioner, Root }
