import type {
  Chip,
  Collection,
  ComboboxActionDetails,
  ComboboxFilter,
  ComboboxMessages,
  ComboboxPage,
  LoadingStatus,
  PositioningProps,
  ScrollToIndexDetails,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLInputAttributes,
  HTMLLabelAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

/** One option of a data-driven combobox. */
export interface ComboboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}

export interface ComboboxChangeDetails {
  readonly reason: string
}

export interface ComboboxInputChangeDetails extends ComboboxChangeDetails {
  /** Aborted when a newer text change is reported or the popup closes (async fetches). */
  readonly signal: AbortSignal
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}

interface Common {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string | undefined
  readonly children?: Snippet | undefined
  readonly items?: readonly ComboboxItemData[] | undefined
  /** A collection built by the consumer (virtualized or async lists). */
  readonly collection?: Collection<unknown> | undefined
  /** The text; `bind:inputValue` controls it. */
  inputValue?: string | undefined
  readonly defaultInputValue?: string | undefined
  readonly onInputValueChange?:
    | ((text: string, details: ComboboxInputChangeDetails) => void)
    | undefined
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ComboboxChangeDetails) => void) | undefined
  readonly allowCustomValue?: boolean | undefined
  /** Multiple: Backspace in the empty input arms, then removes, the last chip. */
  readonly removeOnBackspace?: boolean | undefined
  readonly closeOnSelect?: boolean | undefined
  /** Multiple: clears the text after a choice. Default: true. */
  readonly clearInputOnSelect?: boolean | undefined
  readonly selectOnTab?: boolean | undefined
  /** Opens when the text changes. Default: true. */
  readonly openOnInput?: boolean | undefined
  /** ArrowDown / ArrowUp in the input open the popup. Default: true. */
  readonly openOnArrow?: boolean | undefined
  readonly openOnInputPress?: boolean | undefined
  readonly openOnFocus?: boolean | undefined
  readonly autoHighlight?: boolean | undefined
  /** Keeps a pointer highlight when the pointer leaves the list. Default: false (true inline). */
  readonly keepHighlight?: boolean | undefined
  readonly autoComplete?: "list" | "both" | undefined
  /** The matcher; `null` lists the collection unfiltered (consumer or server filtering). */
  readonly filter?: ComboboxFilter | undefined
  /** The query the given collection answers (async): another query's results are stale. */
  readonly itemsQuery?: string | undefined
  readonly loading?: LoadingStatus | undefined
  readonly onLoadMore?: (() => void) | undefined
  /** The items are virtualized: highlight scrolling goes through `scrollToIndex`. */
  readonly virtualized?: boolean | undefined
  /** Scrolls the highlighted item into view instead of the native `scrollIntoView`. */
  readonly scrollToIndex?: ((details: ScrollToIndexDetails) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly required?: boolean | undefined
  /** Clearing the text keeps the selection instead of emptying it. */
  readonly disallowEmptySelection?: boolean | undefined
  /** Wraps the highlight at the ends of the list. Default: false. */
  readonly loop?: boolean | undefined
  readonly messages?: Partial<ComboboxMessages> | undefined
  /** Side, align, offset, collisions. */
  readonly positioning?: PositioningProps | undefined
  /** Keep the popup in the DOM (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. */
  readonly typingPause?: number | undefined
  /** The form name of the selected key(s); the visible text is not submitted. */
  readonly name?: string | undefined
  /** Submits the visible text under this name too. */
  readonly inputName?: string | undefined
  /** The id of the form the hidden inputs belong to. */
  readonly form?: string | undefined
  /** Runs an item (inline), or follows a choice (free text). */
  readonly onAction?: ((key: string, details: ComboboxActionDetails) => void) | undefined
  /** The list in place, always shown, items run `onAction` (a command palette). Fixed. */
  readonly inline?: boolean | undefined
  /** Inline: the current page (`depth` 0: the root page). */
  readonly page?: ComboboxPage | undefined
  /** Inline: Backspace on an empty query above the root page. */
  readonly onBack?: (() => void) | undefined
  /** Free text: Escape on a closed popup clears the text (default false). */
  readonly clearOnEscape?: boolean | undefined
  /** Free text: Enter on a highlighted suggestion fills, then submits the form. */
  readonly submitOnChoose?: boolean | undefined
  /** Free text: the input's native `autocomplete` (default "off"). */
  readonly formAutoComplete?: string | undefined
}

type Selection =
  | {
      /** Free text (an autocomplete): the text is the value, suggestions only fill it. */
      readonly selectionMode: "none"
      readonly multiple?: false | undefined
      value?: undefined
      readonly defaultValue?: undefined
      readonly onValueChange?: undefined
    }
  | {
      readonly selectionMode?: "single" | "multiple" | undefined
      readonly multiple?: false | undefined
      /** The value; `bind:value` controls it. */
      value?: string | null | undefined
      readonly defaultValue?: string | null | undefined
      readonly onValueChange?:
        | ((value: string | null, details: ComboboxChangeDetails) => void)
        | undefined
    }
  | {
      readonly selectionMode?: "single" | "multiple" | undefined
      readonly multiple: true
      value?: readonly string[] | undefined
      readonly defaultValue?: readonly string[] | undefined
      readonly onValueChange?:
        | ((value: readonly string[], details: ComboboxChangeDetails) => void)
        | undefined
    }

export type ComboboxRootProps = Common & Selection

export type ComboboxLabelProps = Part<HTMLLabelAttributes>
export type ComboboxControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type ComboboxInputProps = Omit<HTMLInputAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
}
export type ComboboxTriggerProps = Part<HTMLButtonAttributes>
export type ComboboxClearTriggerProps = Part<HTMLButtonAttributes>
export type ComboboxPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type ComboboxPopupProps = Part<HTMLAttributes<HTMLDivElement>>
export type ComboboxLoadingProps = Part<HTMLAttributes<HTMLDivElement>>
export type ComboboxChipsProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  /** Renders one chip; default: its text and a remove button. */
  readonly children?: Snippet<[Chip]> | undefined
}
export type ComboboxChipProps = Part<HTMLAttributes<HTMLSpanElement>>
export type ComboboxChipRemoveProps = Part<HTMLButtonAttributes>
