import type {
  BreadcrumbsCurrentValue,
  BreadcrumbsItemState,
  BreadcrumbsMessages,
  BreadcrumbsTrail,
  BreadcrumbsTrailItem,
  breadcrumbsConnect,
  Href,
  ItemRegistry,
  RouterOptions,
} from "@rind-ui/core"
import { createContext } from "../context"

/** What an Item's Link reports up: where it goes and its text (the ellipsis menu's item). */
export interface ItemMeta {
  readonly current?: boolean | undefined
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly text?: string | undefined
}

export const breadcrumbsContext = createContext<{
  readonly instance: () => string
  readonly connect: () => ReturnType<typeof breadcrumbsConnect>
  readonly trail: () => BreadcrumbsTrail
  readonly items: () => readonly BreadcrumbsTrailItem[]
  readonly currentValue: () => BreadcrumbsCurrentValue
  readonly messages: () => BreadcrumbsMessages
  /** Null with the data-driven `items` prop: nothing registers. */
  readonly registry: ItemRegistry | null
  readonly setMeta: (key: string, meta: ItemMeta) => void
}>("breadcrumbs")

export const breadcrumbsItem = createContext<{
  readonly state: () => BreadcrumbsItemState
  /** Written by the Item's Link after it renders. */
  readonly reportLink: (meta: ItemMeta) => void
}>("breadcrumbs-item")
