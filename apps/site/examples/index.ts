import type { ComponentType } from "react"
import * as accordion from "./accordion"
import * as alert from "./alert"
import * as alertDialog from "./alert-dialog"
import * as announcements from "./announcements"
import * as aspectRatio from "./aspect-ratio"
import * as autosize from "./autosize"
import * as avatar from "./avatar"
import * as badge from "./badge"
import * as breadcrumbs from "./breadcrumbs"
import * as button from "./button"
import * as checkboxGroup from "./checkbox-group"
import * as collapsible from "./collapsible"
import * as collections from "./collections"
import * as colorArea from "./color-area"
import * as colorField from "./color-field"
import * as colorPicker from "./color-picker"
import * as colorSlider from "./color-slider"
import * as colorSwatch from "./color-swatch"
import * as colorSwatchPicker from "./color-swatch-picker"
import * as combobox from "./combobox"
import * as contextMenu from "./context-menu"
import * as dialog from "./dialog"
import * as field from "./field"
import * as fieldset from "./fieldset"
import * as focusAndModality from "./focus-and-modality"
import * as form from "./form"
import * as heading from "./heading"
import * as hiddenFormInput from "./hidden-form-input"
import * as hiddenUntilFound from "./hidden-until-found"
import * as hoverCard from "./hover-card"
import * as image from "./image"
import * as keyboardAndRtl from "./keyboard-and-rtl"
import * as label from "./label"
import * as labels from "./labels"
import * as link from "./link"
import * as listbox from "./listbox"
import * as menu from "./menu"
import * as messagesAndProvider from "./messages-and-provider"
import * as meter from "./meter"
import * as numberInput from "./number-input"
import * as overlays from "./overlays"
import * as pagination from "./pagination"
import * as passwordInput from "./password-input"
import * as pinInput from "./pin-input"
import * as popover from "./popover"
import * as positioning from "./positioning"
import * as pressAndHover from "./press-and-hover"
import * as progress from "./progress"
import * as qrCode from "./qr-code"
import * as radioGroup from "./radio-group"
import * as scrollArea from "./scroll-area"
import * as searchField from "./search-field"
import * as segmentedControl from "./segmented-control"
import * as select from "./select"
import * as separator from "./separator"
import * as skeleton from "./skeleton"
import * as slider from "./slider"
import * as switchEx from "./switch"
import * as tabs from "./tabs"
import * as textField from "./text-field"
import * as toggleGroup from "./toggle-group"
import * as toolbar from "./toolbar"
import * as tooltip from "./tooltip"
import type { Variants } from "./types"
import * as visuallyHidden from "./visually-hidden"

/** A component's example module: its live examples as exported functions, titled by `variants`. */
export type ExampleModule = { readonly variants: Variants } & Readonly<Record<string, unknown>>

/** Component page slug → its examples. A page without an entry shows no live example. */
export const examples: Readonly<Record<string, ExampleModule>> = {
  announcements,
  autosize: autosize,
  "hidden-form-input": hiddenFormInput,
  labels: labels,
  "visually-hidden": visuallyHidden,
  menu,
  "messages-and-provider": messagesAndProvider,
  accordion,
  alert,
  "alert-dialog": alertDialog,
  "aspect-ratio": aspectRatio,
  avatar,
  badge,
  breadcrumbs,
  button,
  "checkbox-group": checkboxGroup,
  collapsible,
  "color-area": colorArea,
  "color-field": colorField,
  "color-picker": colorPicker,
  "color-slider": colorSlider,
  "color-swatch": colorSwatch,
  "color-swatch-picker": colorSwatchPicker,
  combobox,
  collections,
  "context-menu": contextMenu,
  dialog,
  field,
  "focus-and-modality": focusAndModality,
  fieldset,
  form,
  heading,
  image,
  meter,
  progress,
  "hidden-until-found": hiddenUntilFound,
  "keyboard-and-rtl": keyboardAndRtl,
  overlays,
  pagination,
  "password-input": passwordInput,
  "pin-input": pinInput,
  popover,
  positioning,
  "hover-card": hoverCard,
  label,
  link,
  listbox,
  "number-input": numberInput,
  "press-and-hover": pressAndHover,
  "radio-group": radioGroup,
  "search-field": searchField,
  "segmented-control": segmentedControl,
  select,
  separator,
  "qr-code": qrCode,
  "scroll-area": scrollArea,
  skeleton,
  slider,
  switch: switchEx,
  tabs,
  "text-field": textField,
  "toggle-group": toggleGroup,
  toolbar,
  tooltip,
}

/** The example function `name` of a module, if it is one. */
export const exampleComponent = (mod: ExampleModule, name: string): ComponentType | undefined => {
  const fn = mod[name]
  // Every function export of an example module is a component taking no props.
  return typeof fn === "function" ? (fn as ComponentType) : undefined
}

/** The example a page opens with: its first visible variant (usually `Basic`). */
export const heroName = (mod: ExampleModule): string | undefined =>
  Object.entries(mod.variants).find(([, v]) => !v.hidden)?.[0]
