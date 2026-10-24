import type {
  Chip,
  Collection,
  ComboboxFilter,
  Delimiters,
  LoadingStatus,
  PositioningProps,
  TagRefusal,
  TagsInputMessages,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLInputAttributes,
  HTMLLabelAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

export interface TagsInputChangeDetails {
  readonly reason: string
}

/** One suggestion of a data-driven Tags Input: choosing it creates the tag `key`. */
export interface TagsInputItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}

export interface TagsInputRootProps {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string | undefined
  /** The Tags Input parts (Root renders no element). */
  readonly children?: Snippet | undefined
  /** The tags; `bind:value` controls them. */
  value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: TagsInputChangeDetails) => void)
    | undefined
  /** The draft; `bind:inputValue` controls it. */
  inputValue?: string | undefined
  readonly defaultInputValue?: string | undefined
  readonly onInputValueChange?:
    | ((text: string, details: TagsInputChangeDetails) => void)
    | undefined
  /** Default ",". Strings match literally. */
  readonly delimiter?: Delimiters | undefined
  /** Default: the delimiters plus newline, tab and ";". */
  readonly pasteDelimiter?: Delimiters | undefined
  readonly addOnPaste?: boolean | undefined
  readonly normalize?: ((text: string) => string) | undefined
  readonly allowDuplicates?: boolean | undefined
  readonly compare?: ((a: string, b: string) => boolean) | undefined
  readonly max?: number | undefined
  readonly validate?: ((text: string, value: readonly string[]) => true | string) | undefined
  readonly onRefuse?: ((refusal: TagRefusal) => void) | undefined
  readonly blurBehavior?: "keep" | "add" | "clear" | undefined
  readonly editable?: boolean | undefined
  readonly removeOnBackspace?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly required?: boolean | undefined
  readonly name?: string | undefined
  readonly inputName?: string | undefined
  /** The id of the form the submitted tags (and the named text input) belong to. */
  readonly form?: string | undefined
  readonly messages?: Partial<TagsInputMessages> | undefined
  /** Suggestions: the input becomes a combobox; choosing one creates a tag from its key. */
  readonly items?: readonly TagsInputItemData[] | undefined
  /** Suggestions built by the consumer (virtualized or async lists). */
  readonly collection?: Collection<unknown> | undefined
  /** The suggestion matcher; `null` lists them unfiltered (consumer or server filtering). */
  readonly filter?: ComboboxFilter | undefined
  /** The draft the given suggestions answer (async): another draft's are stale. */
  readonly itemsQuery?: string | undefined
  readonly loading?: LoadingStatus | undefined
  /** The suggestions' LoadMore sentinel came into view. */
  readonly onLoadMore?: (() => void) | undefined
  /** Choosing a suggestion closes the popup (default false). */
  readonly closeOnSelect?: boolean | undefined
  /** With suggestions, typed text may become a tag (default true). */
  readonly allowCustom?: boolean | undefined
  readonly autoHighlight?: boolean | undefined
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. */
  readonly typingPause?: number | undefined
  readonly positioning?: PositioningProps | undefined
  readonly keepMounted?: boolean | undefined
}

export type TagsInputLabelProps = Part<HTMLLabelAttributes>
export type TagsInputControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type TagsInputInputProps = Omit<HTMLInputAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
}
export type TagsInputClearTriggerProps = Part<HTMLButtonAttributes>
export type TagsInputChipsProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  /** Renders one chip; default: ChipText, ChipInput while edited, and ChipRemove. */
  readonly children?: Snippet<[Chip]> | undefined
}
export type TagsInputChipProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** Locks this tag: it cannot be edited or removed, and clearing keeps it. */
  readonly disabled?: boolean | undefined
}
export type TagsInputChipTextProps = Part<HTMLAttributes<HTMLSpanElement>>
export type TagsInputChipInputProps = TagsInputInputProps
export type TagsInputChipRemoveProps = Part<HTMLButtonAttributes>
