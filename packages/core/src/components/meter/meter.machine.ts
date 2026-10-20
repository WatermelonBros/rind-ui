// Meter (design §2): one state. Every attribute is a pure function of props (range-value +
// meterZone) and a Meter never announces. The service exists so the contract, the driver and
// `testMachine` apply: a value change (onProps) is an internal transition that remembers the
// resolved value, the edge the model's prop steps walk (design §5) and the `valued` trait reads.

import { setup, type } from "../../machine/setup"
import { resolveRangeValue } from "../shared/range-value"

export interface MeterProps {
  readonly value?: number | null | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly low?: number | undefined
  readonly high?: number | undefined
  readonly optimum?: number | undefined
}

export type MeterEvent = { readonly type: "VALUE.CHANGE" }

export interface MeterContext {
  /** The clamped value (min when missing). */
  readonly value: number
}

const resolved = (props: MeterProps) => {
  const r = resolveRangeValue(props)
  return r.value ?? r.min
}

export const meterMachine = /* @__PURE__ */ setup({
  types: type<{ props: MeterProps; events: MeterEvent; env: object; context: MeterContext }>(),
  actions: {
    remember: ({ props, set }) => set("value", resolved(props)),
  },
}).machine({
  id: "meter",
  initial: "idle",
  context: (props) => ({ value: resolved(props) }),
  onProps: { value: "VALUE.CHANGE" },
  states: { idle: { on: { "VALUE.CHANGE": { actions: ["remember"] } } } },
})

export type MeterMachine = typeof meterMachine
