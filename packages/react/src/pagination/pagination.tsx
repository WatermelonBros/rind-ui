"use client"

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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { Button, type ButtonProps } from "../button/button"
import { Link, type LinkProps } from "../link/link"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    pagination: PaginationMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** Root's render state (spec "Anatomy"). */
export interface PaginationRootState extends PaginationState {
  /** The visible range: pages and ellipses with stable keys. */
  readonly pages: readonly PaginationEntry[]
  /** Goes to a page (reason `SET_PAGE`), e.g. from a "go to page" field. */
  readonly setPage: (page: number) => void
  /** For a page-size control: keeps the first item of the current page visible. */
  readonly setPageSize: (pageSize: number) => void
}

/** `totalPages`, or `count` with a page size: never both (spec "Total Pages"). */
export type PaginationTotal =
  | {
      readonly totalPages: number
      readonly count?: never
      readonly pageSize?: never
      readonly defaultPageSize?: never
      readonly onPageSizeChange?: never
    }
  | {
      readonly count: number
      readonly totalPages?: never
      readonly pageSize?: number
      readonly defaultPageSize?: number
      readonly onPageSizeChange?: (pageSize: number, details: PaginationChangeDetails) => void
    }

export type PaginationRootProps = Omit<ComponentPropsWithRef<"nav">, "children" | "onChange"> &
  PaginationTotal & {
    readonly page?: number
    readonly defaultPage?: number
    readonly onPageChange?: (page: number, details: PaginationChangeDetails) => void
    readonly siblingCount?: number
    readonly boundaryCount?: number
    /** Every control ignores activation (disable while loading). */
    readonly disabled?: boolean
    /** Default `true`: unavailable controls keep focus (`aria-disabled`). */
    readonly focusableWhenDisabled?: boolean
    /** Renders links instead of buttons (spec "Buttons And Links"). */
    readonly getPageHref?: (page: number, pageSize: number) => string
    readonly messages?: MessageOverrides<PaginationMessages>
    readonly render?: RenderProp<PaginationRootState>
    /** The parts, or a function of the state (to map `pages`). */
    readonly children?: ReactNode | ((state: PaginationRootState) => ReactNode)
  }

interface Ctx {
  readonly api: ReturnType<typeof paginationConnect>
  readonly state: PaginationRootState
  readonly send: (e: PaginationEvent) => void
  readonly getPageHref: PaginationRootProps["getPageHref"]
  readonly focusableWhenDisabled: boolean
}
const PaginationContext = createContext<Ctx | null>(null)
function usePagination(part: string): Ctx {
  const ctx = useContext(PaginationContext)
  if (!ctx) throw new Error(`Pagination.${part} must be inside Pagination.Root`)
  return ctx
}

function Root(props: PaginationRootProps) {
  const {
    totalPages,
    count,
    page,
    defaultPage,
    onPageChange,
    pageSize,
    defaultPageSize,
    onPageSizeChange,
    siblingCount,
    boundaryCount,
    disabled = false,
    focusableWhenDisabled = true,
    getPageHref,
    messages: ownMessages,
    render,
    children,
    id,
    ref,
    ...rest
  } = props
  const instance = useRootId(id)
  const messages = useMessages("pagination", paginationMessages, ownMessages)
  const machineProps = {
    totalPages,
    count,
    page,
    defaultPage,
    onPageChange,
    pageSize,
    defaultPageSize,
    onPageSizeChange,
    siblingCount,
    boundaryCount,
    disabled,
  }
  const { view, send } = useMachine(paginationMachine, machineProps)
  const base = paginationState(machineProps, view.values)
  const api = paginationConnect({
    instance,
    state: base,
    messages,
    disabled,
    siblingCount,
    boundaryCount,
  })
  const state: PaginationRootState = {
    ...base,
    pages: api.pages(),
    setPage: (n) => send({ type: "SET_PAGE", page: n, modality: "virtual" }),
    setPageSize: (n) => send({ type: "SET_PAGE_SIZE", pageSize: n }),
  }
  const el = useRef<HTMLElement | null>(null)
  useEffect(
    () => warnPaginationInputs({ totalPages, count, pageSize, siblingCount, boundaryCount }),
    [totalPages, count, pageSize, siblingCount, boundaryCount],
  )
  useEffect(() => {
    warnControlledWithoutHandler("page", page !== undefined, onPageChange !== undefined)
    warnControlledWithoutHandler("pageSize", pageSize !== undefined, onPageSizeChange !== undefined)
  }, [page, onPageChange, pageSize, onPageSizeChange])
  const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  useIsoLayoutEffect(() => {
    if (el.current) warnDuplicateLandmark(el.current)
  }, [labelled, rest["aria-label"], rest["aria-labelledby"]])
  const merged = mergeProps(
    { ...normalizeProps(api.root(labelled)), ref: composeRefs(el, ref) },
    rest,
  )
  const content = typeof children === "function" ? children(state) : children
  return (
    <PaginationContext value={{ api, state, send, getPageHref, focusableWhenDisabled }}>
      {renderPart("nav", { ...merged, children: content }, render, state)}
    </PaginationContext>
  )
}

export type PaginationListProps = ComponentPropsWithRef<"ul"> & { readonly render?: RenderProp }

function List({ render, ...rest }: PaginationListProps) {
  const ctx = usePagination("List")
  return renderPart("ul", mergeProps(normalizeProps(ctx.api.list()), rest), render, undefined)
}

export type PaginationItemProps = ComponentPropsWithRef<"li"> & {
  /** What the item holds (`data-type`). Default `"page"`. */
  readonly type?: "page" | "ellipsis" | "trigger"
  readonly render?: RenderProp
}

function Item({ type = "page", render, ...rest }: PaginationItemProps) {
  const ctx = usePagination("Item")
  return renderPart("li", mergeProps(normalizeProps(ctx.api.item(type)), rest), render, undefined)
}

/** What a page control's or trigger's `render` callback receives. */
export interface PaginationControlState {
  readonly disabled: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

type ControlProps = Omit<
  ButtonProps,
  "render" | "disabled" | "focusableWhenDisabled" | "onPress" | "type" | "messages"
> & {
  readonly render?: RenderProp<PaginationControlState>
  /** Default: the Root's (`true`). */
  readonly focusableWhenDisabled?: boolean
}

/** A Button, or a Link when the Root has `getPageHref` (spec "Buttons And Links"). */
function Control(
  ctx: Ctx,
  own: Readonly<Record<string, unknown>>,
  rest: ControlProps,
  control: {
    readonly disabled: boolean
    readonly href: string | undefined
    readonly current: boolean
  },
  onActivate: (modality: "pointer" | "keyboard" | "touch" | "virtual") => void,
) {
  const { render, focusableWhenDisabled = ctx.focusableWhenDisabled, ...props } = rest
  const merged = mergeProps(own, props)
  // Link's and Button's states have every field the control state names.
  const asLink = render === undefined ? {} : { render: render as NonNullable<LinkProps["render"]> }
  const asButton =
    render === undefined ? {} : { render: render as NonNullable<ButtonProps["render"]> }
  if (ctx.getPageHref !== undefined) {
    // The merged props are `a` props (the control props minus Button-only callbacks).
    const linkProps = merged as LinkProps
    return (
      <Link
        {...linkProps}
        {...(control.href === undefined ? {} : { href: control.href })}
        {...(control.current ? { current: "page" as const } : {})}
        {...asLink}
        disabled={control.disabled}
        focusableWhenDisabled={focusableWhenDisabled}
        // Same-tab activations only: a ⌘/Ctrl/middle click opens elsewhere and the page stays.
        onActivate={(a) => {
          if (a.disposition === "same-tab") onActivate(a.modality)
        }}
      />
    )
  }
  return (
    <Button
      // The merged props are `button` props built from ButtonProps.
      {...(merged as ButtonProps)}
      {...asButton}
      disabled={control.disabled}
      focusableWhenDisabled={focusableWhenDisabled}
      onPress={(d) => onActivate(d.modality)}
    />
  )
}

export type PaginationPageProps = ControlProps & {
  /** The page number it goes to; `aria-current="page"` when it is the current page. */
  readonly value: number
}

function Page({ value, children, ...rest }: PaginationPageProps) {
  const ctx = usePagination("Page")
  const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const c = ctx.api.page(value, labelled)
  return Control(
    ctx,
    { ...normalizeProps(c.props), children: children ?? value },
    rest,
    {
      disabled: c.disabled,
      current: value === ctx.state.page,
      href: ctx.getPageHref?.(value, ctx.state.pageSize),
    },
    (modality) => ctx.send({ type: "SET_PAGE", page: value, modality }),
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

function trigger(direction: PaginationDirection) {
  return function Trigger({ children, ref, ...rest }: ControlProps) {
    const ctx = usePagination(direction[0]?.toUpperCase() + direction.slice(1))
    const el = useRef<HTMLElement | null>(null)
    const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    // Text children name the trigger at once (also on the server); element children are
    // checked after commit, so an icon-only trigger keeps the message name.
    const [hasText, setHasText] = useState(
      typeof children === "string" || typeof children === "number",
    )
    useIsoLayoutEffect(() => {
      if (children !== undefined && el.current) setHasText(el.current.textContent?.trim() !== "")
    }, [children])
    const c = ctx.api.trigger(direction, labelled || hasText)
    const icon = (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="1em"
        height="1em"
        data-direction={direction}
      >
        <path d={CHEVRON[direction]} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
    return Control(
      ctx,
      { ...normalizeProps(c.props), ref: composeRefs(el, ref), children: children ?? icon },
      rest,
      {
        disabled: c.disabled,
        current: false,
        // Unavailable: no href (zag#3399); Link also drops it while disabled.
        href: c.disabled
          ? undefined
          : ctx.getPageHref?.(TARGET[direction](ctx.state), ctx.state.pageSize),
      },
      (modality) => ctx.send({ type: EVENT[direction], modality }),
    )
  }
}

export type PaginationEllipsisProps = ComponentPropsWithRef<"span"> & {
  /** Which gap it stands for, before or after the current page (`data-position`). Default: "end". */
  readonly position?: "start" | "end"
  readonly render?: RenderProp
}

function Ellipsis({ position = "end", children, render, ...rest }: PaginationEllipsisProps) {
  const ctx = usePagination("Ellipsis")
  const props = mergeProps(normalizeProps(ctx.api.ellipsis(position)), rest)
  return renderPart("span", { ...props, children: children ?? "…" }, render, undefined)
}

/** Navigation between the pages of a list (spec "Pagination"). */
export const Pagination = {
  Root,
  List,
  Item,
  Page,
  Ellipsis,
  First: trigger("first"),
  Previous: trigger("previous"),
  Next: trigger("next"),
  Last: trigger("last"),
}
