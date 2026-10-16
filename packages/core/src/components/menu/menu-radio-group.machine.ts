// A menu's radio group (design §3): one controllable `value`, set by activating one of its
// radio items. A sibling service of the menu level, owned by the RadioGroup part.

import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type MenuRadioGroupEvent = { readonly type: "SELECT"; readonly value: string }

export interface MenuRadioGroupProps {
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<MenuRadioGroupEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
}

// No item selected: the controllable is typed by its non-null value (as Tabs does).
const NONE = null as unknown as string

export const menuRadioGroupMachine = setup({
  types: type<{
    props: MenuRadioGroupProps
    events: MenuRadioGroupEvent
    env: object
    context: object
    values: "value"
  }>(),
  guards: {
    enabled: ({ props }) => props.disabled !== true,
  },
  actions: {
    select: ({ event, set }) => {
      if (event.type === "SELECT") set("value", event.value)
    },
  },
}).machine({
  id: "menu-radio-group",
  initial: "ready",
  context: () => ({}),
  values: { value: { fallback: NONE } },
  states: {
    ready: { on: { SELECT: { guard: "enabled", actions: ["select"] } } },
  },
})

export type MenuRadioGroupMachine = typeof menuRadioGroupMachine
