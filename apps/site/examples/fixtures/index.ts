import type { ExampleModule } from "../index"
import * as accordion from "./accordion"
import * as anchored from "./anchored"
import * as announce from "./announce"
import * as button from "./button"
import * as checkbox from "./checkbox"
import * as checkboxGroup from "./checkbox-group"
import * as collapsible from "./collapsible"
import * as dialog from "./dialog"
import * as disclosure from "./disclosure"
import * as field from "./field"
import * as fieldset from "./fieldset"
import * as form from "./form"
import * as heading from "./heading"
import * as label from "./label"
import * as layer from "./layer"
import * as link from "./link"
import * as listbox from "./listbox"
import * as press from "./press"
import * as radioGroup from "./radio-group"
import * as segmentedControl from "./segmented-control"
import * as separator from "./separator"
import * as switchEx from "./switch"
import * as tabs from "./tabs"
import * as textField from "./text-field"
import * as toggle from "./toggle"
import * as toggleGroup from "./toggle-group"
import * as toolbar from "./toolbar"
import * as visuallyHidden from "./visually-hidden"

/**
 * Harness-only modules, keyed by slug: the ported Storybook stories and the testing fixtures.
 * Their examples are `hidden` (not on a docs page); a slug may also have a docs module.
 */
export const fixtures: Readonly<Record<string, ExampleModule>> = {
  accordion,
  anchored,
  announce,
  button,
  checkbox,
  "checkbox-group": checkboxGroup,
  collapsible,
  dialog,
  disclosure,
  field,
  fieldset,
  form,
  heading,
  label,
  layer,
  link,
  listbox,
  press,
  "radio-group": radioGroup,
  "segmented-control": segmentedControl,
  separator,
  switch: switchEx,
  tabs,
  "text-field": textField,
  toggle,
  "toggle-group": toggleGroup,
  toolbar,
  "visually-hidden": visuallyHidden,
}
