// The Rating contract model (React's matrix) against the Vue parts, and markup parity.
import { platforms, ratingContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { defineComponent, h, shallowRef } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Rating, RindProvider } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  value: undefined,
  defaultValue: undefined,
  count: undefined,
  allowHalf: undefined,
  allowClear: undefined,
  disabled: undefined,
  readOnly: undefined,
}
type P = Record<string, unknown>
const STAR = { display: "inline-block", width: "24px", height: "24px" }
const rating = (p: P) =>
  h(Rating.Root, { name: "score", ...p }, () => [
    h(Rating.Label, null, () => "Score"),
    h(Rating.Control, null, () =>
      [1, 2, 3, 4, 5].map((i) => h(Rating.Item, { key: i, index: i, style: STAR })),
    ),
  ])
const fixture = (p: P) => h("form", null, [rating(p), h("button", { type: "reset" }, "Reset")])
const reactRating = (p: P) =>
  r(
    R.Rating.Root,
    { name: "score", ...p } as never,
    r(R.Rating.Label, null, "Score"),
    r(
      R.Rating.Control,
      null,
      [1, 2, 3, 4, 5].map((i) => r(R.Rating.Item, { key: i, index: i, style: STAR })),
    ),
  )
/** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
const Applying = defineComponent({
  props: { initial: { type: Number, required: true } },
  setup(props) {
    const value = shallowRef(props.initial)
    return () =>
      fixture({
        modelValue: value.value,
        defaultValue: props.initial,
        "onUpdate:modelValue": (v: number) => (value.value = v),
      })
  },
})
const configs: { name: string; props: P; ui: () => ReturnType<typeof h> }[] = [
  { name: "uncontrolled", props: { defaultValue: 1 }, ui: () => fixture({ defaultValue: 1 }) },
  { name: "unrated", props: {}, ui: () => fixture({}) },
  {
    name: "half stars, allowClear",
    props: { defaultValue: 2.5, allowHalf: true, allowClear: true },
    ui: () => fixture({ defaultValue: 2.5, allowHalf: true, allowClear: true }),
  },
  {
    name: "read-only",
    props: { defaultValue: 3, readOnly: true },
    ui: () => fixture({ defaultValue: 3, readonly: true }),
  },
  {
    name: "controlled, applying",
    props: { defaultValue: 2 },
    ui: () => h(Applying, { initial: 2 }),
  },
]
/** jsdom has no layout: the hover steps are walked in browser mode only. */
const contract = inJsdom
  ? {
      ...ratingContract,
      events: {
        ...ratingContract.events,
        "POINTER.MOVE": { skip: "no layout in jsdom: walked in browser mode" },
      },
    }
  : ratingContract

for (const cfg of configs) {
  describe(`vue rating model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        mount(() =>
          h(
            RindProvider,
            {
              dir: currentRun()?.direction ?? "ltr",
              environment: { platform: currentRun()?.platform ?? platforms.linux },
            },
            cfg.ui,
          ),
        ),
      target: () => screen,
      anchor: [{ name: "Score" }] as never,
      props: { ...base, ...cfg.props } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      a11y,
    })
  })
}

describe("Vue Rating matches React", () => {
  it("unrated, a value, half, read-only, disabled, required", async () => {
    for (const [react, vue] of [
      [{}, {}],
      [{ defaultValue: 3 }, { defaultValue: 3 }],
      [
        { defaultValue: 2.5, allowHalf: true },
        { defaultValue: 2.5, allowHalf: true },
      ],
      [
        { defaultValue: 3, readOnly: true },
        { defaultValue: 3, readonly: true },
      ],
      [
        { disabled: true, required: true, count: 3 },
        { disabled: true, required: true, count: 3 },
      ],
    ] as const) {
      await serverParity(reactRating(react), () => rating(vue))
      await clientParity(reactRating(react), () => rating(vue))
    }
  })
})
