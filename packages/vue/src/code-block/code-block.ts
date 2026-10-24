import {
  announcerCapability,
  type ChangeDetails,
  type CodeBlockCopyDetails,
  type CodeBlockCopyState,
  type CodeBlockEvent,
  type CodeBlockMessages,
  type CodeGrammar,
  type CodeLanguage,
  type CodeTokenType,
  clipboardCapability,
  codeBlockConnect,
  codeBlockMachine,
  codeBlockMessages,
  codeBlockTokens,
  type LineRanges,
  lineRuns,
  type MessageOverrides,
  type OverflowWatch,
  parseRanges,
  partId,
  splitLines,
  type TrustedCodeHtml,
  watchOverflow,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  type StyleValue,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { changeEmitter } from "../emit-change"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"
import { VisuallyHidden } from "../visually-hidden"

declare module "../provider" {
  interface RindMessageScopes {
    "code-block": CodeBlockMessages
  }
}

/** One highlighted token, rendered as text (never HTML). */
export interface CodeToken {
  readonly text: string
  /** Rendered as `data-token`, coloured by the theme's `--rind-code-token-<type>`. */
  readonly token?: CodeTokenType
  readonly className?: string
  readonly style?: StyleValue
}

/** What `Content`'s slot and `Line` receive for each source line. */
export interface CodeBlockLine {
  /** 0-based position in the source. */
  readonly index: number
  /** The line's number (`startLineNumber` + index). */
  readonly number: number
  /** The line's source text. */
  readonly text: string
  readonly highlighted: boolean
}

/** What every part's slot receives. */
export interface CodeBlockRenderState {
  readonly copyState: CodeBlockCopyState
  readonly wrapped: boolean
  readonly expanded: boolean
  readonly collapsible: boolean
  readonly scrollable: boolean
}

interface Ctx {
  readonly api: () => ReturnType<typeof codeBlockConnect>
  readonly send: (event: CodeBlockEvent) => void
  readonly state: () => CodeBlockRenderState
  readonly lines: () => readonly CodeBlockLine[]
  readonly tokens: () => readonly (readonly CodeToken[])[] | undefined
  readonly html: () => TrustedCodeHtml | undefined
  readonly copyAnchor: { value: Element | null }
  readonly registry: PartRegistry<"title">
  readonly titleId: () => string
}
const CodeBlockKey: InjectionKey<Ctx> = Symbol("rind-ui.code-block")
function useCodeBlock(part: string): Ctx {
  const ctx = inject(CodeBlockKey, null)
  if (!ctx) throw new Error(`CodeBlock.${part} must be inside CodeBlock.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: CodeBlockRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "CodeBlockRoot",
  inheritAttrs: false,
  props: {
    /** The source: rendered when no highlight is given, and what Copy writes. */
    code: { type: String, required: true },
    /**
     * Built-in highlighting: a built-in language name (any case) or your own `CodeGrammar`. An
     * unknown name renders plain. `lines` and `html` win over it. A custom grammar must be
     * module-level: the tokens are memoized on its identity.
     */
    language: [String, Object] as PropType<CodeLanguage | (string & {}) | CodeGrammar>,
    /** Your highlighter's tokens, one list per source line, rendered as text. */
    lines: Array as PropType<readonly (readonly CodeToken[])[]>,
    /** Highlighter output from `trustedCodeHtml()`, injected per line. Never user input. */
    html: Object as PropType<TrustedCodeHtml>,
    lineNumbers: Boolean,
    startLineNumber: { type: Number, default: 1 },
    highlightLines: [String, Array] as PropType<LineRanges>,
    /** Blocks longer than this start collapsed to it. */
    maxLines: Number,
    /** Controlled wrapping (`v-model:wrapped`). */
    wrapped: { type: Boolean, default: undefined },
    defaultWrapped: { type: Boolean, default: undefined },
    /** Controlled expansion (`v-model:expanded`). */
    expanded: { type: Boolean, default: undefined },
    defaultExpanded: { type: Boolean, default: undefined },
    /** How long `copied` / `error` last (ms). Default 2000. */
    copyFeedbackDuration: Number,
    messages: Object as PropType<MessageOverrides<CodeBlockMessages>>,
    /** Default: the provider's locale (the announcement's language). */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    wrappedChange: (_wrapped: boolean, _details: ChangeDetails<CodeBlockEvent>) => true,
    "update:wrapped": (_wrapped: boolean) => true,
    expandedChange: (_expanded: boolean, _details: ChangeDetails<CodeBlockEvent>) => true,
    "update:expanded": (_expanded: boolean) => true,
    copy: (_details: CodeBlockCopyDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability, clipboardCapability)
    const messages = useMessages("code-block", codeBlockMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const registry = usePartRegistry<"title">({ scope: "code-block", root: instance() })
    const copyAnchor = shallowRef<Element | null>(null)
    const source = computed(() => splitLines(props.code))
    const collapsible = computed(
      () => props.maxLines !== undefined && source.value.length > props.maxLines,
    )
    const onWrappedChange = changeEmitter<boolean, CodeBlockEvent>(
      (v, d) => emit("wrappedChange", v, d),
      (v) => emit("update:wrapped", v),
    )
    const onExpandedChange = changeEmitter<boolean, CodeBlockEvent>(
      (v, d) => emit("expandedChange", v, d),
      (v) => emit("update:expanded", v),
    )
    const { view, send } = useMachine(
      codeBlockMachine,
      () => ({
        code: props.code,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
        copyFeedbackDuration: props.copyFeedbackDuration,
        onCopy: (d: CodeBlockCopyDetails) => emit("copy", d),
        getCopyAnchor: () => (copyAnchor.value instanceof HTMLElement ? copyAnchor.value : null),
        collapsible: collapsible.value,
        wrapped: props.wrapped,
        defaultWrapped: props.defaultWrapped,
        onWrappedChange,
        expanded: props.expanded,
        defaultExpanded: props.defaultExpanded ?? !collapsible.value,
        onExpandedChange,
      }),
      env,
    )
    // Keyed on the grammar's identity: a grammar object made in render re-lexes on every render.
    const tokens = computed(() =>
      codeBlockTokens({
        code: props.code,
        language: props.language,
        lines: props.lines,
        html: props.html,
      }),
    )
    const highlighted = computed(() => parseRanges(props.highlightLines))
    const lines = computed(() =>
      source.value.map((text, index) => {
        const number = props.startLineNumber + index
        return { index, number, text, highlighted: highlighted.value.has(number) }
      }),
    )
    const titleId = useRenderedId(registry, "title")
    const state = computed(
      (): CodeBlockRenderState => ({
        copyState: view.value.state,
        wrapped: view.value.values.wrapped,
        expanded: view.value.values.expanded,
        collapsible: collapsible.value,
        scrollable: view.value.context.scrollable,
      }),
    )
    const api = computed(() =>
      codeBlockConnect(
        {
          instance: instance(),
          ...state.value,
          lineNumbers: props.lineNumbers,
          startLineNumber: props.startLineNumber,
          maxLines: collapsible.value ? props.maxLines : undefined,
          highlighted: highlighted.value,
          highlightRuns: lineRuns(highlighted.value),
          messages: messages.value,
          titleId: titleId.value,
          contentId: partId("code-block", instance(), "content"),
          descriptionId: partId("code-block", instance(), "description"),
        },
        env,
      ),
    )
    provide(CodeBlockKey, {
      api: () => api.value,
      send,
      state: () => state.value,
      lines: () => lines.value,
      tokens: () => tokens.value,
      html: () => props.html,
      copyAnchor,
      registry,
      titleId: () => partId("code-block", instance(), "title"),
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(state.value),
        props.asChild,
      )
  },
})

const Header = defineComponent({
  name: "CodeBlockHeader",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCodeBlock("Header")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().header()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Title = defineComponent({
  name: "CodeBlockTitle",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCodeBlock("Title")
    const own = () => props.id ?? ctx.titleId()
    useRegisterPart(ctx.registry, "title", own)
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().title(own())), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

type TriggerKind = "copyTrigger" | "wrapTrigger" | "collapseTrigger"
function trigger(kind: TriggerKind, label: string, onPress: (ctx: Ctx) => void) {
  return defineComponent({
    name: `CodeBlock${label}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useCodeBlock(label)
      const env = useEnvironment()
      const el = shallowRef<Element | null>(null)
      const measured = shallowRef<string | null>(null)
      const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
      onMounted(measure)
      onUpdated(measure)
      const setEl = (node: unknown) => {
        refTo(el)(node)
        if (kind === "copyTrigger") ctx.copyAnchor.value = el.value
      }
      const press = usePress({
        env,
        send: (e) => {
          if (e.type === "PRESS") onPress(ctx)
        },
      })
      // Tracks the modality from mount, so the first keyboard focus is already visible.
      onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
      const focused = shallowRef(false)
      const modality = useModality(env.modality, () => focused.value)
      return () => {
        const children = slots["default"]?.(ctx.state())
        const tag = renderedTag("button", children, props.asChild, measured.value)
        const named = children !== undefined && children !== null
        const own = normalizeProps(
          ctx.api()[kind]({ tag, named, focused: focused.value, modality: modality.value }),
        )
        return renderPart(
          "button",
          mergeProps(
            {
              ...joinHandlers(own, press.props, {
                onFocusin: () => (focused.value = true),
                onFocusout: () => (focused.value = false),
              }),
              ref: setEl,
            },
            attrs,
          ),
          children,
          props.asChild,
        )
      }
    },
  })
}
const CopyTrigger = trigger("copyTrigger", "CopyTrigger", (ctx) => ctx.send({ type: "COPY" }))
const WrapTrigger = trigger("wrapTrigger", "WrapTrigger", (ctx) =>
  ctx.send({ type: "WRAP.TOGGLE" }),
)
const CollapseTrigger = trigger("collapseTrigger", "CollapseTrigger", (ctx) =>
  ctx.send({ type: "EXPAND.TOGGLE" }),
)

const Line = defineComponent({
  name: "CodeBlockLine",
  inheritAttrs: false,
  props: {
    /** The line to render: one entry of the tokens from `Root` (number, text and token spans). */
    line: { type: Object as PropType<CodeBlockLine>, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCodeBlock("Line")
    return () => {
      const line = props.line
      const own = mergeProps(normalizeProps(ctx.api().line(line.number)), attrs)
      const html = ctx.html()?.lines[line.index]
      const tokens = ctx.tokens()?.[line.index]
      const slot = slots.default?.(ctx.state())
      if (slot === undefined && html !== undefined)
        return renderPart("span", { ...own, innerHTML: html }, undefined, props.asChild)
      const content =
        slot ??
        (tokens
          ? tokens.map((t, i) =>
              // Plain text is not wrapped: fewer nodes on long blocks.
              t.token === undefined && t.className === undefined && t.style === undefined
                ? t.text
                : h(
                    "span",
                    {
                      key: i,
                      ...(t.token === undefined ? {} : normalizeProps(ctx.api().token(t.token))),
                      ...(t.className === undefined ? {} : { class: t.className }),
                      ...(t.style === undefined ? {} : { style: t.style }),
                    },
                    t.text,
                  ),
            )
          : line.text)
      return renderPart("span", own, content, props.asChild)
    }
  },
})

const Content = defineComponent({
  name: "CodeBlockContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  /** Renders each line (default `<CodeBlock.Line :line="line" />`). */
  slots: Object as SlotsType<{ default?: (line: CodeBlockLine) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useCodeBlock("Content")
    const el = shallowRef<Element | null>(null)
    let overflow: OverflowWatch | null = null
    onMounted(() => {
      const node = el.value
      if (!(node instanceof HTMLElement)) return
      overflow = watchOverflow(node, (o) => ctx.send({ type: "OVERFLOW.CHANGE", overflow: o }))
      // Wrap, expansion and the code change the content's layout: measure again after the update.
      watch(
        () => [ctx.state().wrapped, ctx.state().expanded, ctx.lines()],
        () => overflow?.remeasure(),
        { flush: "post" },
      )
    })
    onBeforeUnmount(() => {
      overflow?.stop()
      overflow = null
    })
    return () => {
      const api = ctx.api()
      const body = h(
        "code",
        normalizeProps(api.code()),
        ctx
          .lines()
          .map((line) =>
            h(Fragment, { key: line.index }, [
              line.index > 0 ? "\n" : null,
              slots.default ? slots.default(line) : h(Line, { line }),
            ]),
          ),
      )
      const description = api.descriptionText
      return [
        renderPart(
          "pre",
          mergeProps({ ...normalizeProps(api.content()), ref: refTo(el) }, attrs),
          body,
          props.asChild,
        ),
        description
          ? h(VisuallyHidden, normalizeProps(api.description()), () => description)
          : null,
      ]
    }
  },
})

/** The parts, by name: `code-block.parts.ts` re-exports them as the `CodeBlock` namespace. */
export { CollapseTrigger, Content, CopyTrigger, Header, Line, Root, Title, WrapTrigger }
