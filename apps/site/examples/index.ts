import type { ComponentType } from "react"
import * as accordion from "./accordion"
import * as button from "./button"
import * as checkbox from "./checkbox"
import * as checkboxGroup from "./checkbox-group"
import * as collapsible from "./collapsible"
import * as field from "./field"
import * as fieldset from "./fieldset"
import * as form from "./form"
import * as heading from "./heading"
import * as label from "./label"
import * as link from "./link"
import * as radioGroup from "./radio-group"
import * as switchEx from "./switch"
import * as textField from "./text-field"
import * as toggle from "./toggle"
import type { Variants } from "./types"

/** A component's example module: its live examples as exported functions, titled by `variants`. */
export type ExampleModule = { readonly variants: Variants } & Readonly<Record<string, unknown>>

/** Component page slug → its examples. A page without an entry shows no live example. */
export const examples: Readonly<Record<string, ExampleModule>> = {
  accordion,
  button,
  checkbox,
  "checkbox-group": checkboxGroup,
  collapsible,
  field,
  fieldset,
  form,
  heading,
  label,
  link,
  "radio-group": radioGroup,
  switch: switchEx,
  "text-field": textField,
  toggle,
}

/** The example function `name` of a module, if it is one. */
export const exampleComponent = (mod: ExampleModule, name: string): ComponentType | undefined => {
  const fn = mod[name]
  // Every function export of an example module is a component taking no props.
  return typeof fn === "function" ? (fn as ComponentType) : undefined
}
