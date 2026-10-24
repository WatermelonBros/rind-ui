// The Rating contract model (React's matrix) against the Svelte parts, and DOM parity.
import { ratingContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Score from "../../fixtures/rating/score.svelte"

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
const configs: { name: string; props: P; svelte: P }[] = [
  { name: "uncontrolled", props: { defaultValue: 1 }, svelte: { root: { defaultValue: 1 } } },
  { name: "unrated", props: {}, svelte: {} },
  {
    name: "half stars, allowClear",
    props: { defaultValue: 2.5, allowHalf: true, allowClear: true },
    svelte: { root: { defaultValue: 2.5, allowHalf: true, allowClear: true } },
  },
  {
    name: "read-only",
    props: { defaultValue: 3, readOnly: true },
    svelte: { root: { defaultValue: 3, readonly: true } },
  },
  { name: "controlled, applying", props: { defaultValue: 2 }, svelte: { applying: 2 } },
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
  describe(`svelte rating model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => mount(Score, cfg.svelte as never),
      target: () => screen,
      anchor: [{ name: "Score" }] as never,
      props: { ...base, ...cfg.props } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      a11y,
    })
  })
}

describe("Svelte Rating matches React", () => {
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
      await clientParity(reactRating(react), Score, { root: vue, provider: false } as never)
    }
  })
})
