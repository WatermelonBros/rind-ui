import type { Chip, comboboxConnect, hiddenFormInput, PartProps } from "@rind-ui/core"
import { createContext } from "../context"

type Api = ReturnType<typeof comboboxConnect>

/** What the Root gives its parts; getters stay reactive. */
export interface ComboboxHost {
  readonly api: () => Api
  readonly open: () => boolean
  readonly disabled: () => boolean
  readonly chips: () => readonly Chip[]
  readonly keys: () => readonly string[]
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly setConstraint: (el: HTMLInputElement | null) => void
  /** A user change happened since the last sync (the hidden input dispatches events). */
  readonly pending: { current: boolean }
  readonly reset: () => void
  readonly autofill: (text: string) => boolean
  readonly keepMounted: () => boolean
  readonly setPresent: (present: boolean) => void
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: () => boolean
  readonly mountLabel: (on: boolean) => void
  readonly inline: boolean
  readonly freeText: boolean
}
export const comboboxHost = createContext<ComboboxHost>("combobox")
export const comboboxChip = createContext<string>("combobox-chip")

/** What the popup parts (Positioner, Popup) read from their host: Combobox, Tags Input. */
export interface PopupHost {
  /** The component name in warnings ("Combobox", "TagsInput"). */
  readonly name: string
  readonly api: () => { positioner(): PartProps; popup(): PartProps }
  readonly open: () => boolean
  readonly keepMounted: () => boolean
  readonly setPresent: (present: boolean) => void
  /** The positioner joins the top layer (the engine has the Popover API). */
  readonly topLayer: () => boolean
  /** A list in place: the popup parts render nothing. */
  readonly inline: boolean
}
export const popupHost = createContext<PopupHost>("combobox-popup")
