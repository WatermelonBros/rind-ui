import type { PaginationEvent, paginationConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { PaginationRootState } from "./types"

export const paginationContext = createContext<{
  readonly api: () => ReturnType<typeof paginationConnect>
  readonly state: () => PaginationRootState
  readonly send: (e: PaginationEvent) => void
  readonly getPageHref: () => ((page: number, pageSize: number) => string) | undefined
  readonly focusableWhenDisabled: () => boolean
}>("pagination")
