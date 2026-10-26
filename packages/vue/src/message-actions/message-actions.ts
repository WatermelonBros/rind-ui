// Message Actions (add-message-actions): a Toolbar (roving focus, one Tab stop) of the actions
// on a chat message. Copy is a Clipboard and Feedback a Toggle Group, both hosted by the
// Toolbar; the parts carry the message-actions attributes, so the theme and the contract find
// them by this component's scope.

import {
  announcerCapability,
  type MessageActionsEvent,
  type MessageActionsMessages,
  type MessageOverrides,
  messageActionsActive,
  messageActionsConnect,
  messageActionsMachine,
  messageActionsMessages,
  type PartProps,
  type RegenerateState,
} from "@rind-ui/core"
import {
  computed,
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
import * as Clipboard from "../clipboard/clipboard.parts"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import * as ToggleGroup from "../toggle-group/toggle-group.parts"
import * as Toolbar from "../toolbar/toolbar.parts"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "message-actions": MessageActionsMessages
  }
}

/** What the Root's default slot receives. */
export interface MessageActionsRenderState {
  readonly active: boolean
  readonly editing: boolean
  readonly regenerate: RegenerateState
  readonly index: number
  readonly count: number
}

type Api = ReturnType<typeof messageActionsConnect>

interface Ctx {
  readonly api: () => Api
  readonly send: (event: MessageActionsEvent) => void
  readonly editEl: { value: Element | null }
}
const MessageActionsKey: InjectionKey<Ctx> = Symbol("rind-ui.message-actions")
function useMessageActions(part: string): Ctx {
  const ctx = inject(MessageActionsKey, null)
  if (!ctx) throw new Error(`MessageActions.${part} must be inside MessageActions.Root`)
  return ctx
}
type DefaultSlot = SlotsType<{ default?: () => VNodeChild }>

const Root = defineComponent({
  name: "MessageActionsRoot",
  inheritAttrs: false,
  props: {
    /** Forces the row visible. */
    active: { type: Boolean, default: undefined },
    /** Regenerate the message. */
    onRegenerate: Function as PropType<() => void | Promise<void>>,
    /** Controlled editing (`v-model:editing`). */
    editing: { type: Boolean, default: undefined },
    /** Uncontrolled editing. Default false. */
    defaultEditing: { type: Boolean, default: undefined },
    /** How many versions the message has. Default 0. */
    count: Number,
    /** Controlled version index, 0-based (`v-model:index`). */
    index: Number,
    /** Uncontrolled version index. Default 0. */
    defaultIndex: Number,
    /** The version buttons wrap around. */
    loop: Boolean,
    messages: Object as PropType<MessageOverrides<MessageActionsMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    /**
     * The message element whose hover, focus and touch show the row. Default: the Root's
     * parent element.
     */
    host: Function as PropType<() => Element | null>,
    id: String,
  },
  emits: {
    /** Edit was toggled. */
    editingChange: (_editing: boolean) => true,
    "update:editing": (_editing: boolean) => true,
    /** A move between versions. */
    indexChange: (_index: number) => true,
    "update:index": (_index: number) => true,
  },
  slots: Object as SlotsType<{ default?: (state: MessageActionsRenderState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("message-actions", messageActionsMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const editEl = shallowRef<Element | null>(null)
    const { view, send } = useMachine(
      messageActionsMachine,
      () => ({
        active: props.active,
        onRegenerate: () => props.onRegenerate?.(),
        ...(props.editing === undefined ? {} : { editing: props.editing }),
        defaultEditing: props.defaultEditing,
        onEditingChange: (e: boolean) => {
          emit("editingChange", e)
          emit("update:editing", e)
        },
        count: props.count,
        ...(props.index === undefined ? {} : { index: props.index }),
        defaultIndex: props.defaultIndex,
        onIndexChange: (i: number) => {
          emit("indexChange", i)
          emit("update:index", i)
        },
        loop: props.loop,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
      }),
      {
        ...env,
        // After editing ends, the focus comes back to Edit unless it went somewhere on purpose.
        restoreEditFocus: () => {
          const el = editEl.value
          const active = el?.ownerDocument.activeElement
          if (el instanceof HTMLElement && (active == null || active === el.ownerDocument.body))
            el.focus({ preventScroll: true })
        },
      },
    )
    const isActive = () => messageActionsActive(view.value.context, { active: props.active })
    const api = computed(() =>
      messageActionsConnect(
        {
          instance: instance(),
          active: isActive(),
          editing: view.value.values.editing === true,
          regenerate: view.value.context.regenerate,
          count: props.count ?? 0,
          index: view.value.values.index ?? 0,
          loop: props.loop,
          messages: messages.value,
          named: attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined,
        },
        env,
      ),
    )
    const rootEl = shallowRef<Element | null>(null)
    onMounted(() => {
      // The message's own hover, focus and touch show the row (design §1).
      const found = props.host?.() ?? rootEl.value?.parentElement ?? null
      if (!found) return
      // Elements dispatch the HTMLElement events listened to here (SVG ones included).
      const el = found as HTMLElement
      const on = <K extends keyof HTMLElementEventMap>(
        type: K,
        listener: (e: HTMLElementEventMap[K]) => void,
      ) => {
        el.addEventListener(type, listener, { passive: true })
        onBeforeUnmount(() => el.removeEventListener(type, listener))
      }
      on("pointerenter", () => send({ type: "POINTER.ENTER" }))
      on("pointerleave", () => send({ type: "POINTER.LEAVE" }))
      on("focusin", () => send({ type: "FOCUS.IN" }))
      // Out of the message only: a move between its own elements stays inside.
      on("focusout", (e) => {
        if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget)))
          send({ type: "FOCUS.OUT" })
      })
      on("touchstart", () => send({ type: "TOUCH" }))
    })
    const state = (): MessageActionsRenderState => ({
      active: isActive(),
      editing: view.value.values.editing === true,
      regenerate: view.value.context.regenerate,
      index: view.value.values.index ?? 0,
      count: props.count ?? 0,
    })
    provide(MessageActionsKey, { api: () => api.value, send, editEl })
    return () =>
      h(
        Toolbar.Root,
        {
          ...attrs,
          ...normalizeProps(api.value.root()),
          id: props.id ?? instance(),
          ref: refTo(rootEl),
        },
        () => slots.default?.(state()),
      )
  },
})

/** A Toolbar item with this component's attributes, from `own(b)`. */
function actionButton(
  name: string,
  own: (api: Api, b: Parameters<Api["edit"]>[0]) => PartProps,
  press: (ctx: Ctx) => void,
  keepEl = false,
) {
  return defineComponent({
    name: `MessageActions${name}`,
    inheritAttrs: false,
    slots: Object as DefaultSlot,
    setup(_, { attrs, slots }) {
      const ctx = useMessageActions(name)
      const env = useEnvironment()
      // Tracks the modality from mount, so the first keyboard focus is already visible.
      onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
      const focused = shallowRef(false)
      const modality = useModality(env.modality, () => focused.value)
      return () =>
        h(Toolbar.Item, { focusableWhenDisabled: true }, () =>
          // The Toolbar's props go under these: this part's scope wins.
          h(
            "button",
            mergeProps(
              {
                ...joinHandlers(
                  normalizeProps(
                    own(ctx.api(), {
                      tag: "button",
                      focused: focused.value,
                      modality: modality.value,
                    }),
                  ),
                  {
                    onClick: (e: MouseEvent) => {
                      if ((e.currentTarget as HTMLElement).hasAttribute("data-disabled")) return
                      press(ctx)
                    },
                    onFocusin: () => (focused.value = true),
                    onFocusout: () => (focused.value = false),
                  },
                ),
                ...(keepEl ? { ref: refTo(ctx.editEl) } : {}),
              },
              attrs,
            ),
            [slots.default?.()],
          ),
        )
    },
  })
}

/** Your own action: a Toolbar item (its slot's element is the control). */
const Item = defineComponent({
  name: "MessageActionsItem",
  inheritAttrs: false,
  slots: Object as DefaultSlot,
  setup(_, { attrs, slots }) {
    const ctx = useMessageActions("Item")
    return () =>
      h(Toolbar.Item, mergeProps(normalizeProps(ctx.api().item()), attrs), () => slots.default?.())
  },
})

/** Clipboard's Trigger under a Toolbar item: the toolbar's scope gives way to Clipboard's. */
const CopyTrigger = defineComponent({
  name: "MessageActionsCopyTrigger",
  inheritAttrs: false,
  slots: Object as DefaultSlot,
  setup(_, { attrs, slots }) {
    return () => {
      const { "data-scope": _s, "data-part": _p, "data-instance": _i, ...rest } = attrs
      return h(Clipboard.Trigger, rest, () => slots.default?.())
    }
  },
})

/** Copies `value` with Clipboard's states and announcements; its trigger is a Toolbar item. */
const Copy = defineComponent({
  name: "MessageActionsCopy",
  inheritAttrs: false,
  props: {
    /** What a press copies; a function is called at press time (the message's latest text). */
    value: { type: [String, Function] as PropType<string | (() => string)>, required: true },
  },
  slots: Object as DefaultSlot,
  setup(props, { attrs, slots }) {
    const ctx = useMessageActions("Copy")
    // A press re-reads a function value: the Clipboard reads `value` when the write starts.
    const reads = shallowRef(0)
    const text = () => {
      void reads.value
      return typeof props.value === "function" ? props.value() : props.value
    }
    return () =>
      h("span", mergeProps(normalizeProps(ctx.api().copy()), attrs), [
        h(
          Clipboard.Root,
          { value: text(), messages: { copy: ctx.api().names.copy }, asChild: true },
          () =>
            h("span", null, [
              h(Toolbar.Item, { focusableWhenDisabled: true }, () =>
                h(CopyTrigger, { onClickCapture: () => reads.value++ }, () => slots.default?.()),
              ),
            ]),
        ),
      ])
  },
})

/** Calls `onRegenerate`; disabled and busy until its promise settles. */
const Regenerate = actionButton(
  "Regenerate",
  (api, b) => api.regenerate(b),
  (ctx) => ctx.send({ type: "PRESS.REGENERATE" }),
)
/** Toggles editing (`aria-pressed`); the focus comes back to it when editing ends. */
const Edit = actionButton(
  "Edit",
  (api, b) => api.edit(b),
  (ctx) => ctx.send({ type: "PRESS.EDIT" }),
  true,
)
/** The previous version; disabled but focusable on the first (unless `loop`). */
const VersionPrevious = actionButton(
  "VersionPrevious",
  (api, b) => api.versionPrevious(b),
  (ctx) => ctx.send({ type: "PRESS.PREVIOUS" }),
)
/** The next version; disabled but focusable on the last (unless `loop`). */
const VersionNext = actionButton(
  "VersionNext",
  (api, b) => api.versionNext(b),
  (ctx) => ctx.send({ type: "PRESS.NEXT" }),
)

/** Thumbs up/down: a single, deselectable Toggle Group named `messages.feedback`. */
const Feedback = defineComponent({
  name: "MessageActionsFeedback",
  inheritAttrs: false,
  slots: Object as DefaultSlot,
  setup(_, { attrs, slots }) {
    const ctx = useMessageActions("Feedback")
    return () =>
      h(
        ToggleGroup.Root,
        {
          "aria-label": ctx.api().names.feedback,
          ...mergeProps(normalizeProps(ctx.api().feedback()), attrs),
          selectionMode: "single",
        },
        () => slots.default?.(),
      )
  },
})

/** `value="up"` or `"down"`, named "Good response" / "Bad response". */
const FeedbackItem = defineComponent({
  name: "MessageActionsFeedbackItem",
  inheritAttrs: false,
  props: {
    /** Thumbs up or down. */
    value: { type: String as PropType<"up" | "down">, required: true },
  },
  slots: Object as DefaultSlot,
  setup(props, { attrs, slots }) {
    const ctx = useMessageActions("FeedbackItem")
    return () =>
      h(
        ToggleGroup.Item,
        {
          ...mergeProps(
            {
              "aria-label": props.value === "up" ? ctx.api().names.up : ctx.api().names.down,
            },
            normalizeProps(ctx.api().feedbackItem(props.value)),
            attrs,
          ),
          value: props.value,
        },
        () => slots.default?.(),
      )
  },
})

/** A group ("Versions"), rendered from two versions. */
const Versions = defineComponent({
  name: "MessageActionsVersions",
  inheritAttrs: false,
  slots: Object as DefaultSlot,
  setup(_, { attrs, slots }) {
    const ctx = useMessageActions("Versions")
    return () =>
      ctx.api().hasVersions
        ? h("div", mergeProps(normalizeProps(ctx.api().versions()), attrs), [slots.default?.()])
        : null
  },
})

/** "2 / 3", `aria-hidden` (a move announces "Version 2 of 3"); its content replaces it. */
const VersionStatus = defineComponent({
  name: "MessageActionsVersionStatus",
  inheritAttrs: false,
  slots: Object as DefaultSlot,
  setup(_, { attrs, slots }) {
    const ctx = useMessageActions("VersionStatus")
    return () =>
      h("span", mergeProps(normalizeProps(ctx.api().versionStatus()), attrs), [
        slots.default?.() ?? ctx.api().versionText,
      ])
  },
})

/** The parts, by name: `message-actions.parts.ts` re-exports them as the `MessageActions` namespace. */
export {
  Copy,
  Edit,
  Feedback,
  FeedbackItem,
  Item,
  Regenerate,
  Root,
  VersionNext,
  VersionPrevious,
  VersionStatus,
  Versions,
}
