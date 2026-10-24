/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  children as resolve,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { Button, type ButtonState } from "../button/button"
import { afterMount } from "../lifecycle"
import { Link, type LinkState } from "../link/link"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    pagination: PaginationMessages
  }
}

/** Root's children state (spec "Anatomy"). */
export interface PaginationRootState extends PaginationState {
  /** The visible range: pages and ellipses with stable keys. */
  readonly pages: readonly PaginationEntry[]
  /** Goes to a page (reason `SET_PAGE`), e.g. from a "go to page" field. */
  readonly setPage: (page: number) => void
  /** For a page-size control: keeps the first item of the current page visible. */
  readonly setPageSize: (pageSize: number) => void
}

interface Ctx {
  readonly api: Accessor<ReturnType<typeof paginationConnect>>
  readonly state: Accessor<PaginationRootState>
  readonly send: (e: PaginationEvent) => void
  readonly getPageHref: () => ((page: number, pageSize: number) => string) | undefined
  readonly focusableWhenDisabled: () => boolean
}
const PaginationContext = createContext<Ctx>()
function usePagination(part: string): Ctx {
  const ctx = useContext(PaginationContext)
  if (!ctx) throw new Error(`Pagination.${part} must be inside Pagination.Root`)
  return ctx
}

export type PaginationRootProps = Omit<JSX.HTMLAttributes<HTMLElement>, "children" | "id"> & {
  /** The page count; or pass `count` (items) with a page size, never both. */
  readonly totalPages?: number | undefined
  /** The item count: the pages follow from the page size. */
  readonly count?: number | undefined
  /** Controlled page. */
  readonly page?: number | undefined
  readonly defaultPage?: number | undefined
  readonly onPageChange?: ((page: number, details: PaginationChangeDetails) => void) | undefined
  /** Controlled page size, with `count`. */
  readonly pageSize?: number | undefined
  readonly defaultPageSize?: number | undefined
  readonly onPageSizeChange?: ((size: number, details: PaginationChangeDetails) => void) | undefined
  readonly siblingCount?: number | undefined
  readonly boundaryCount?: number | undefined
  /** Every control ignores activation (disable while loading). */
  readonly disabled?: boolean | undefined
  /** Default `true`: unavailable controls keep focus (`aria-disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Renders links instead of buttons (spec "Buttons And Links"). */
  readonly getPageHref?: ((page: number, pageSize: number) => string) | undefined
  readonly messages?: MessageOverrides<PaginationMessages> | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<PaginationRootState> | undefined
  readonly children?: JSX.Element | ((state: PaginationRootState) => JSX.Element)
}

function Root(props: PaginationRootProps) {
  const [local, rest] = splitProps(props, [
    "totalPages",
    "count",
    "page",
    "defaultPage",
    "onPageChange",
    "pageSize",
    "defaultPageSize",
    "onPageSizeChange",
    "siblingCount",
    "boundaryCount",
    "disabled",
    "focusableWhenDisabled",
    "getPageHref",
    "messages",
    "id",
    "render",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const messages = useMessages("pagination", paginationMessages, () => local.messages)
  const machineProps = () => ({
    totalPages: local.totalPages,
    count: local.count,
    page: local.page,
    defaultPage: local.defaultPage,
    onPageChange: local.onPageChange,
    pageSize: local.pageSize,
    defaultPageSize: local.defaultPageSize,
    onPageSizeChange: local.onPageSizeChange,
    siblingCount: local.siblingCount,
    boundaryCount: local.boundaryCount,
    disabled: local.disabled === true,
  })
  const { view, send } = useMachine(paginationMachine, machineProps)
  const base = createMemo(() => paginationState(machineProps(), view().values))
  const api = createMemo(() =>
    paginationConnect({
      instance: instance(),
      state: base(),
      messages: messages(),
      disabled: local.disabled === true,
      siblingCount: local.siblingCount,
      boundaryCount: local.boundaryCount,
    }),
  )
  // Entries keep their identity while equal, so a `<For each={state.pages}>` keeps the DOM (and
  // the focus) of a page across page changes: the connect output makes new objects.
  const known = new Map<string, PaginationEntry>()
  const pages = createMemo(() =>
    api()
      .pages()
      .map((e) => {
        const prev = known.get(e.key)
        if (prev && JSON.stringify(prev) === JSON.stringify(e)) return prev
        known.set(e.key, e)
        return e
      }),
  )
  const state = createMemo(
    (): PaginationRootState => ({
      ...base(),
      pages: pages(),
      setPage: (n) => send({ type: "SET_PAGE", page: n, modality: "virtual" }),
      setPageSize: (n) => send({ type: "SET_PAGE_SIZE", pageSize: n }),
    }),
  )
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => {
    createEffect(() =>
      warnPaginationInputs({
        totalPages: local.totalPages,
        count: local.count,
        pageSize: local.pageSize,
        siblingCount: local.siblingCount,
        boundaryCount: local.boundaryCount,
      }),
    )
    createEffect(() => {
      warnControlledWithoutHandler(
        "page",
        local.page !== undefined,
        typeof untrack(() => local.onPageChange) === "function",
      )
      warnControlledWithoutHandler(
        "pageSize",
        local.pageSize !== undefined,
        typeof untrack(() => local.onPageSizeChange) === "function",
      )
    })
    createEffect(() => {
      rest["aria-label"]
      rest["aria-labelledby"]
      const node = el()
      if (node instanceof HTMLElement) warnDuplicateLandmark(node)
    })
  })
  const stateView = reactive<PaginationRootState>(state)
  const merged = createMemo(() => {
    const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    return mergeProps({ ...normalizeProps(api().root(labelled)), ref: setEl }, rest)
  })
  const children = () => resolveChildren(local.children, stateView)
  return (
    <PaginationContext.Provider
      value={{
        api,
        state,
        send,
        getPageHref: () => local.getPageHref,
        focusableWhenDisabled: () => local.focusableWhenDisabled ?? true,
      }}
    >
      {renderPart(local.render, merged, stateView, children, (p) => (
        <nav {...p}>{children()}</nav>
      ))}
    </PaginationContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

function List(props: PartProps<JSX.HTMLAttributes<HTMLUListElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePagination("List")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().list()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <ul {...p}>{children()}</ul>)
}

export type PaginationItemProps = PartProps<JSX.HTMLAttributes<HTMLLIElement>> & {
  /** What the item holds (`data-type`). Default `"page"`. */
  readonly type?: "page" | "ellipsis" | "trigger" | undefined
}

function Item(props: PaginationItemProps) {
  const [local, rest] = splitProps(props, ["type", "render", "children"])
  const ctx = usePagination("Item")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().item(local.type ?? "page")), rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <li {...p}>{children()}</li>)
}

interface ControlOptions {
  /** Default: the Root's (`true`). */
  readonly focusableWhenDisabled?: boolean | undefined
}
type Activation = "pointer" | "keyboard" | "touch" | "virtual"

/** A Button, or a Link when the Root has `getPageHref` (spec "Buttons And Links"). */
function Control(props: {
  readonly ctx: Ctx
  readonly own: Record<string | symbol, unknown>
  readonly c: {
    readonly disabled: boolean
    readonly href: string | undefined
    readonly current: boolean
  }
  readonly focusableWhenDisabled: boolean | undefined
  readonly render: RenderProp<ButtonState> | RenderProp<LinkState> | undefined
  readonly content: () => JSX.Element
  readonly onActivate: (modality: Activation) => void
}): JSX.Element {
  const keepsFocus = () => props.focusableWhenDisabled ?? props.ctx.focusableWhenDisabled()
  return (
    <Show
      when={props.ctx.getPageHref() !== undefined}
      fallback={
        <Button
          {...(props.own as object)}
          disabled={props.c.disabled}
          focusableWhenDisabled={keepsFocus()}
          render={props.render as RenderProp<ButtonState> | undefined}
          onPress={(d: { modality: Activation }) => props.onActivate(d.modality)}
        >
          {props.content()}
        </Button>
      }
    >
      <Link
        {...(props.own as object)}
        {...(props.c.href === undefined ? {} : { href: props.c.href })}
        {...(props.c.current ? { current: "page" as const } : {})}
        disabled={props.c.disabled}
        focusableWhenDisabled={keepsFocus()}
        render={props.render as RenderProp<LinkState> | undefined}
        // Same-tab activations only: a ⌘/Ctrl/middle click opens elsewhere and the page stays.
        onActivate={(a: { disposition: string; modality: Activation }) => {
          if (a.disposition === "same-tab") props.onActivate(a.modality)
        }}
      >
        {props.content()}
      </Link>
    </Show>
  )
}

export type PaginationPageProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "value"
> &
  ControlOptions & {
    /** The page number it goes to; `aria-current="page"` when it is the current page. */
    readonly value: number
    readonly render?: RenderProp<ButtonState> | RenderProp<LinkState> | undefined
    readonly children?: JSX.Element
  }

function Page(props: PaginationPageProps) {
  const [local, rest] = splitProps(props, ["value", "focusableWhenDisabled", "render", "children"])
  const ctx = usePagination("Page")
  const c = createMemo(() => {
    const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    return ctx.api().page(local.value, labelled)
  })
  const own = createMemo(() => mergeProps(normalizeProps(c().props), rest))
  const content = resolve(() => local.children)
  return (
    <Control
      ctx={ctx}
      own={own()}
      c={{
        get disabled() {
          return c().disabled
        },
        get current() {
          return local.value === ctx.state().page
        },
        get href() {
          return ctx.getPageHref()?.(local.value, ctx.state().pageSize)
        },
      }}
      focusableWhenDisabled={local.focusableWhenDisabled}
      render={local.render}
      content={() => content() ?? String(local.value)}
      onActivate={(modality) => ctx.send({ type: "SET_PAGE", page: local.value, modality })}
    />
  )
}

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

/** Text nodes among the children (an icon-only trigger has none). */
function hasTextNow(nodes: unknown): boolean {
  if (Array.isArray(nodes)) return nodes.some(hasTextNow)
  if (typeof nodes === "string") return nodes.trim() !== ""
  if (typeof Text !== "undefined" && nodes instanceof Text) return nodes.data.trim() !== ""
  return false
}

export type PaginationTriggerProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children"> &
  ControlOptions & {
    readonly render?: RenderProp<ButtonState> | RenderProp<LinkState> | undefined
    readonly children?: JSX.Element
  }

function trigger(direction: PaginationDirection) {
  const name = (direction[0]?.toUpperCase() ?? "") + direction.slice(1)
  return function Trigger(props: PaginationTriggerProps) {
    const [local, rest] = splitProps(props, ["focusableWhenDisabled", "render", "children"])
    const ctx = usePagination(name)
    const [el, setEl] = createSignal<Element | null>(null)
    const given = resolve(() => local.children)
    // Element children are checked after mount, so an icon-only trigger keeps the message name.
    const [measured, setMeasured] = createSignal<boolean | null>(null)
    afterMount(() =>
      createEffect(() => {
        const node = el()
        if (given() !== undefined && node) setMeasured(node.textContent?.trim() !== "")
      }),
    )
    const c = createMemo(() => {
      const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
      // Text children name the trigger at once (also on the server).
      return ctx.api().trigger(direction, labelled || (measured() ?? hasTextNow(given())))
    })
    const own = createMemo(() => mergeProps({ ...normalizeProps(c().props), ref: setEl }, rest))
    return (
      <Control
        ctx={ctx}
        own={own()}
        c={{
          get disabled() {
            return c().disabled
          },
          current: false,
          // Unavailable: no href (zag#3399); Link also drops it while disabled.
          get href() {
            const s = ctx.state()
            return c().disabled ? undefined : ctx.getPageHref()?.(TARGET[direction](s), s.pageSize)
          },
        }}
        focusableWhenDisabled={local.focusableWhenDisabled}
        render={local.render}
        content={() =>
          given() ?? (
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              width="1em"
              height="1em"
              data-direction={direction}
            >
              <path d={CHEVRON[direction]} fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
          )
        }
        onActivate={(modality) => ctx.send({ type: EVENT[direction], modality })}
      />
    )
  }
}

export type PaginationEllipsisProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** Which gap it stands for, before or after the current page (`data-position`). Default: "end". */
  readonly position?: "start" | "end" | undefined
}

function Ellipsis(props: PaginationEllipsisProps) {
  const [local, rest] = splitProps(props, ["position", "render", "children"])
  const ctx = usePagination("Ellipsis")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().ellipsis(local.position ?? "end")), rest),
  )
  const content = resolve(() => local.children)
  const children = () => content() ?? "…"
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** Navigation between the pages of a list (spec "Pagination"). */
const First = trigger("first")
const Previous = trigger("previous")
const Next = trigger("next")
const Last = trigger("last")

/** The parts, by name: `pagination.parts.ts` re-exports them as the `Pagination` namespace. */
export { Ellipsis, First, Item, Last, List, Next, Page, Previous, Root }
