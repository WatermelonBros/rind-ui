import type { ComponentType } from "react"
import * as accordion from "./accordion"
import * as alertDialog from "./alert-dialog"
import * as announcements from "./announcements"
import * as autosize from "./autosize"
import * as button from "./button"
import * as checkbox from "./checkbox"
import * as checkboxGroup from "./checkbox-group"
import * as collapsible from "./collapsible"
import * as dialog from "./dialog"
import * as field from "./field"
import * as fieldset from "./fieldset"
import * as focusAndModality from "./focus-and-modality"
import * as form from "./form"
import * as heading from "./heading"
import * as hiddenFormInput from "./hidden-form-input"
import * as hiddenUntilFound from "./hidden-until-found"
import * as keyboardAndRtl from "./keyboard-and-rtl"
import * as label from "./label"
import * as labels from "./labels"
import * as link from "./link"
import * as messagesAndProvider from "./messages-and-provider"
import * as pressAndHover from "./press-and-hover"
import * as radioGroup from "./radio-group"
import * as segmentedControl from "./segmented-control"
import * as separator from "./separator"
import * as slider from "./slider"
import * as switchEx from "./switch"
import * as tabs from "./tabs"
import * as textField from "./text-field"
import * as toggle from "./toggle"
import * as toggleGroup from "./toggle-group"
import * as toolbar from "./toolbar"
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
  "messages-and-provider": messagesAndProvider,
  accordion,
  "alert-dialog": alertDialog,
  button,
  checkbox,
  "checkbox-group": checkboxGroup,
  collapsible,
  dialog,
  field,
  "focus-and-modality": focusAndModality,
  fieldset,
  form,
  heading,
  "hidden-until-found": hiddenUntilFound,
  "keyboard-and-rtl": keyboardAndRtl,
  label,
  link,
  "press-and-hover": pressAndHover,
  "radio-group": radioGroup,
  "segmented-control": segmentedControl,
  separator,
  slider,
  switch: switchEx,
  tabs,
  "text-field": textField,
  toggle,
  "toggle-group": toggleGroup,
  toolbar,
}

/** The example function `name` of a module, if it is one. */
export const exampleComponent = (mod: ExampleModule, name: string): ComponentType | undefined => {
  const fn = mod[name]
  // Every function export of an example module is a component taking no props.
  return typeof fn === "function" ? (fn as ComponentType) : undefined
}
