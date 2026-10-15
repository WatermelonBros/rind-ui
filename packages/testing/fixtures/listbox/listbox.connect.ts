import {
  type Collection,
  type CollectionContext,
  type CollectionKey,
  type CompositeEnv,
  type CompositeParts,
  composite,
  type FocusStrategy,
  itemId,
  type LoadingStatus,
  partId,
  toKey,
} from "@rind-ui/core"
import type { ListboxEvent } from "./listbox.machine"

export interface ListboxState {
  readonly collection: Collection<unknown>
  readonly context: CollectionContext
  readonly value: readonly string[]
  readonly strategy: FocusStrategy
  readonly selectionMode: "none" | "single" | "multiple"
  readonly orientation: "vertical" | "horizontal"
  readonly focusableWhenDisabled?: boolean | undefined
  readonly disabledBehavior?: "all" | "selection" | undefined
  readonly loading?: LoadingStatus | undefined
  /** Static parts not registered yet (server render, first paint). */
  readonly pending?: boolean | undefined
  readonly typingAhead: () => boolean
}

export const listboxIds = (root: string) => ({
  list: partId("listbox", root, "list"),
  item: (key: CollectionKey) => itemId("listbox", root, "item", key),
})

/** Listbox state → framework-neutral props per part (the collection's own props). */
export function connect(
  s: ListboxState,
  send: (event: ListboxEvent) => void,
  env: CompositeEnv,
  root: string,
): CompositeParts {
  const parts = composite(
    {
      collection: s.collection,
      highlightedKey: s.context.highlightedKey,
      highlightSource: s.context.highlightSource,
      selection: new Set(s.value.map(toKey)),
      selectionMode: s.selectionMode,
      focusableWhenDisabled: s.focusableWhenDisabled,
      disabledBehavior: s.disabledBehavior,
      loading: s.loading,
      pending: s.pending,
      typingAhead: s.typingAhead,
    },
    send,
    env,
    {
      scope: "listbox",
      instance: root,
      ids: listboxIds(root),
      strategy: s.strategy,
      orientation: s.orientation,
      listRole: "listbox",
      itemRole: "option",
    },
  )
  return {
    ...parts,
    list: () => ({
      ...parts.list(),
      // Focus anywhere in the list (the list itself or a roving item) enters it.
      onFocusIn: () => send({ type: "FOCUS", modality: env.modality.modality() }),
    }),
  }
}
