import {
  type MessageOverrides,
  type PaginationChangeDetails,
  type PaginationDirection,
  type PaginationEntry,
  type PaginationEvent,
  type PaginationMessages,
  type PaginationState,
  paginationConnect,
  paginationMachine,
  paginationMessages,
  paginationState,
  warnControlledWithoutHandler,
  warnDuplicateLandmark,
  warnPaginationInputs,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  type InjectionKey,
  inject,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  Text,
  type VNodeChild,
  watch,
} from "vue"
import { Button } from "../button/button"
import { changeEmitter } from "../emit-change"
import { Link } from "../link/link"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { asChildProp, elements, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    pagination: PaginationMessages
  }
}

/** Root's slot state (spec "Anatomy"). */
export interface PaginationRootState extends PaginationState {
  /** The visible range: pages and ellipses with stable keys. */
  readonly pages: readonly PaginationEntry[]
  /** Goes to a page (reason `SET_PAGE`), e.g. from a "go to page" field. */
  readonly setPage: (page: number) => void
  /** For a page-size control: keeps the first item of the current page visible. */
  readonly setPageSize: (pageSize: number) => void
}

interface Ctx {
  readonly api: () => ReturnType<typeof paginationConnect>
  readonly state: () => PaginationRootState
  readonly send: (e: PaginationEvent) => void
  readonly getPageHref: () => ((page: number, pageSize: number) => string) | undefined
  readonly focusableWhenDisabled: () => boolean
}
const PaginationKey: InjectionKey<Ctx> = Symbol("rind-ui.pagination")
function usePagination(part: string): Ctx {
  const ctx = inject(PaginationKey, null)
  if (!ctx) throw new Error(`Pagination.${part} must be inside Pagination.Root`)
  return ctx
}

const Root = defineComponent({
  name: "PaginationRoot",
  inheritAttrs: false,
  props: {
    /** The page count; or pass `count` (items) with a page size, never both. */
    totalPages: Number,
    /** The item count: the pages follow from the page size. */
    count: Number,
    /** Controlled page (`v-model:page`). */
    page: Number,
    defaultPage: Number,
    /** Controlled page size (`v-model:pageSize`), with `count`. */
    pageSize: Number,
    defaultPageSize: Number,
    siblingCount: Number,
    boundaryCount: Number,
    /** Every control ignores activation (disable while loading). */
    disabled: Boolean,
    /** Default `true`: unavailable controls keep focus (`aria-disabled`). */
    focusableWhenDisabled: { type: Boolean, default: true },
    /** Renders links instead of buttons (spec "Buttons And Links"). */
    getPageHref: Function as PropType<(page: number, pageSize: number) => string>,
    messages: Object as PropType<MessageOverrides<PaginationMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    pageChange: (_page: number, _details: PaginationChangeDetails) => true,
    "update:page": (_page: number) => true,
    pageSizeChange: (_size: number, _details: PaginationChangeDetails) => true,
    "update:pageSize": (_size: number) => true,
  },
  slots: Object as SlotsType<{ default?: (state: PaginationRootState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("pagination", paginationMessages, () => props.messages)
    const vnode = getCurrentInstance()?.vnode
    const listens = (...names: string[]) =>
      names.some((n) => typeof vnode?.props?.[n] === "function")
    const onPageChange = changeEmitter<number, PaginationEvent>(
      (v, d) => emit("pageChange", v, d),
      (v) => emit("update:page", v),
    )
    const onPageSizeChange = changeEmitter<number, PaginationEvent>(
      (v, d) => emit("pageSizeChange", v, d),
      (v) => emit("update:pageSize", v),
    )
    const machineProps = () => ({
      totalPages: props.totalPages,
      count: props.count,
      page: props.page,
      defaultPage: props.defaultPage,
      onPageChange,
      pageSize: props.pageSize,
      defaultPageSize: props.defaultPageSize,
      onPageSizeChange,
      siblingCount: props.siblingCount,
      boundaryCount: props.boundaryCount,
      disabled: props.disabled,
    })
    const { view, send } = useMachine(paginationMachine, machineProps)
    const base = computed(() => paginationState(machineProps(), view.value.values))
    const api = computed(() =>
      paginationConnect({
        instance: instance(),
        state: base.value,
        messages: messages.value,
        disabled: props.disabled,
        siblingCount: props.siblingCount,
        boundaryCount: props.boundaryCount,
      }),
    )
    const state = computed(
      (): PaginationRootState => ({
        ...base.value,
        pages: api.value.pages(),
        setPage: (n) => send({ type: "SET_PAGE", page: n, modality: "virtual" }),
        setPageSize: (n) => send({ type: "SET_PAGE_SIZE", pageSize: n }),
      }),
    )
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      watch(
        () =>
          [
            props.totalPages,
            props.count,
            props.pageSize,
            props.siblingCount,
            props.boundaryCount,
          ] as const,
        ([totalPages, count, pageSize, siblingCount, boundaryCount]) =>
          warnPaginationInputs({ totalPages, count, pageSize, siblingCount, boundaryCount }),
        { immediate: true },
      )
      watch(
        () => [props.page, props.pageSize] as const,
        ([page, pageSize]) => {
          warnControlledWithoutHandler(
            "page",
            page !== undefined,
            listens("onPageChange", "onUpdate:page"),
          )
          warnControlledWithoutHandler(
            "pageSize",
            pageSize !== undefined,
            listens("onPageSizeChange", "onUpdate:pageSize"),
          )
        },
        { immediate: true },
      )
      watch(
        () => [attrs["aria-label"], attrs["aria-labelledby"]],
        () => {
          if (el.value instanceof HTMLElement) warnDuplicateLandmark(el.value)
        },
        { immediate: true, flush: "post" },
      )
    })
    provide(PaginationKey, {
      api: () => api.value,
      state: () => state.value,
      send,
      getPageHref: () => props.getPageHref,
      focusableWhenDisabled: () => props.focusableWhenDisabled,
    })
    return () => {
      const labelled = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      return renderPart(
        "nav",
        mergeProps({ ...normalizeProps(api.value.root(labelled)), ref: refTo(el) }, attrs),
        slots.default?.(state.value),
        props.asChild,
      )
    }
  },
})

const List = defineComponent({
  name: "PaginationList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = usePagination("List")
    return () =>
      renderPart(
        "ul",
        mergeProps(normalizeProps(ctx.api().list()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const Item = defineComponent({
  name: "PaginationItem",
  inheritAttrs: false,
  props: {
    /** What the item holds (`data-type`). Default `"page"`. */
    type: { type: String as PropType<"page" | "ellipsis" | "trigger">, default: "page" },
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = usePagination("Item")
    return () =>
      renderPart(
        "li",
        mergeProps(normalizeProps(ctx.api().item(props.type)), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const controlProps = {
  /** Default: the Root's (`true`). */
  focusableWhenDisabled: { type: Boolean, default: undefined },
  ...asChildProp,
} as const

/** A Button, or a Link when the Root has `getPageHref` (spec "Buttons And Links"). */
function control(
  ctx: Ctx,
  own: Record<string, unknown>,
  attrs: Record<string, unknown>,
  c: { readonly disabled: boolean; readonly href: string | undefined; readonly current: boolean },
  focusableWhenDisabled: boolean | undefined,
  asChild: boolean,
  content: () => VNodeChild,
  onActivate: (modality: "pointer" | "keyboard" | "touch" | "virtual") => void,
) {
  const merged = mergeProps(own, attrs)
  const keepsFocus = focusableWhenDisabled ?? ctx.focusableWhenDisabled()
  if (ctx.getPageHref() !== undefined) {
    return h(
      Link,
      {
        ...merged,
        ...(c.href === undefined ? {} : { href: c.href }),
        ...(c.current ? { current: "page" as const } : {}),
        disabled: c.disabled,
        focusableWhenDisabled: keepsFocus,
        asChild,
        // Same-tab activations only: a ⌘/Ctrl/middle click opens elsewhere and the page stays.
        onActivate: (a: {
          disposition: string
          modality: "pointer" | "keyboard" | "touch" | "virtual"
        }) => {
          if (a.disposition === "same-tab") onActivate(a.modality)
        },
      },
      { default: content },
    )
  }
  return h(
    Button,
    {
      ...merged,
      disabled: c.disabled,
      focusableWhenDisabled: keepsFocus,
      asChild,
      onPress: (d: { modality: "pointer" | "keyboard" | "touch" | "virtual" }) =>
        onActivate(d.modality),
    },
    { default: content },
  )
}

const Page = defineComponent({
  name: "PaginationPage",
  inheritAttrs: false,
  props: {
    /** The page number it goes to; `aria-current="page"` when it is the current page. */
    value: { type: Number, required: true },
    ...controlProps,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = usePagination("Page")
    return () => {
      const labelled = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      const c = ctx.api().page(props.value, labelled)
      const s = ctx.state()
      return control(
        ctx,
        normalizeProps(c.props),
        attrs,
        {
          disabled: c.disabled,
          current: props.value === s.page,
          href: ctx.getPageHref()?.(props.value, s.pageSize),
        },
        props.focusableWhenDisabled,
        props.asChild,
        () => slots.default?.() ?? String(props.value),
        (modality) => ctx.send({ type: "SET_PAGE", page: props.value, modality }),
      )
    }
  },
})

const CHEVRON: Record<PaginationDirection, string> = {
  first: "M11 4 7 8l4 4M6 4v8",
  previous: "M10 4 6 8l4 4",
  next: "m6 4 4 4-4 4",
  last: "m5 4 4 4-4 4M10 4v8",
}
const EVENT = { first: "FIRST", previous: "PREV", next: "NEXT", last: "LAST" } as const
const TARGET: Record<PaginationDirection, (s: PaginationState) => number> = {
  first: () => 1,
  previous: (s) => Math.max(1, s.page - 1),
  next: (s) => Math.min(s.totalPages, s.page + 1),
  last: (s) => s.totalPages,
}

function trigger(direction: PaginationDirection) {
  const name = (direction[0]?.toUpperCase() ?? "") + direction.slice(1)
  return defineComponent({
    name: `Pagination${name}`,
    inheritAttrs: false,
    props: controlProps,
    setup(props, { attrs, slots }) {
      const ctx = usePagination(name)
      const el = shallowRef<Element | null>(null)
      // Element children are checked after mount, so an icon-only trigger keeps the message name.
      const measured = shallowRef<boolean | null>(null)
      const measure = () => {
        if (slots["default"] && el.value) measured.value = el.value.textContent?.trim() !== ""
      }
      onMounted(measure)
      onUpdated(measure)
      return () => {
        const labelled = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
        const out = slots["default"]?.()
        // Text children name the trigger at once (also on the server).
        const textNow = elements(out ?? null).some(
          (v) => v.type === Text && String(v.children).trim() !== "",
        )
        const c = ctx.api().trigger(direction, labelled || (measured.value ?? textNow))
        const s = ctx.state()
        const icon = h(
          "svg",
          {
            "aria-hidden": "true",
            viewBox: "0 0 16 16",
            width: "1em",
            height: "1em",
            "data-direction": direction,
          },
          [
            h("path", {
              d: CHEVRON[direction],
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "1.5",
            }),
          ],
        )
        return control(
          ctx,
          { ...normalizeProps(c.props), ref: refTo(el) },
          attrs,
          {
            disabled: c.disabled,
            current: false,
            // Unavailable: no href (zag#3399); Link also drops it while disabled.
            href: c.disabled ? undefined : ctx.getPageHref()?.(TARGET[direction](s), s.pageSize),
          },
          props.focusableWhenDisabled,
          props.asChild,
          () => out ?? icon,
          (modality) => ctx.send({ type: EVENT[direction], modality }),
        )
      }
    },
  })
}

const Ellipsis = defineComponent({
  name: "PaginationEllipsis",
  inheritAttrs: false,
  props: {
    /** Which gap it stands for, before or after the current page (`data-position`). Default: "end". */
    position: { type: String as PropType<"start" | "end">, default: "end" },
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = usePagination("Ellipsis")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().ellipsis(props.position)), attrs),
        slots.default?.() ?? "…",
        props.asChild,
      )
  },
})

/** Navigation between the pages of a list (spec "Pagination"). */
const First = trigger("first")
const Previous = trigger("previous")
const Next = trigger("next")
const Last = trigger("last")

/** The parts, by name: `pagination.parts.ts` re-exports them as the `Pagination` namespace. */
export { Ellipsis, First, Item, Last, List, Next, Page, Previous, Root }
