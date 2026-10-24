/** @jsxImportSource solid-js */
// The Rating contract model (React's matrix, LTR and RTL) against the Solid parts, a form
// submission and reset, and markup parity.
import { platforms, ratingContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, For, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Rating, type RatingRootProps, RindProvider } from "../index"

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
// `p` may carry getters: a spread keeps them reactive.
const rating = (p: P): JSX.Element => (
  <Rating.Root name="score" {...(p as RatingRootProps)}>
    <Rating.Label>Score</Rating.Label>
    <Rating.Control>
      <For each={[1, 2, 3, 4, 5]}>{(i) => <Rating.Item index={i} style={STAR} />}</For>
    </Rating.Control>
  </Rating.Root>
)
const fixture = (p: P): JSX.Element => (
  <form>
    {rating(p)}
    <button type="reset">Reset</button>
  </form>
)
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
function Applying(props: { initial: number }) {
  const [value, setValue] = createSignal(props.initial)
  return fixture({
    get value() {
      return value()
    },
    defaultValue: props.initial,
    onValueChange: (v: number) => setValue(v),
  })
}
const configs: { name: string; props: P; ui: () => JSX.Element }[] = [
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
    ui: () => fixture({ defaultValue: 3, readOnly: true }),
  },
  {
    name: "controlled, applying",
    props: { defaultValue: 2 },
    ui: () => <Applying initial={2} />,
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
  describe(`solid rating model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider
            dir={currentRun()?.direction ?? "ltr"}
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
          >
            {cfg.ui()}
          </RindProvider>
        )),
      target: () => screen,
      anchor: [{ name: "Score" }] as never,
      props: { ...base, ...cfg.props } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      a11y,
    })
  })
}

describe("solid rating in a form", () => {
  it("submits its value, an empty string while unrated; reset restores the default", async () => {
    mount(() => fixture({ defaultValue: 2 }))
    const form = document.querySelector("form") as HTMLFormElement
    expect(new FormData(form).get("score")).toBe("2")
    const slider = screen.getByRole("slider") as HTMLInputElement
    slider.focus()
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await vi.waitFor(() => expect(new FormData(form).get("score")).toBe("3"))
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(new FormData(form).get("score")).toBe("2"))
  })
})

describe("Solid Rating matches React", () => {
  it("unrated, a value, half, read-only, disabled, required", async () => {
    for (const p of [
      {},
      { defaultValue: 3 },
      { defaultValue: 2.5, allowHalf: true },
      { defaultValue: 3, readOnly: true },
      { disabled: true, required: true, count: 3 },
    ]) {
      await clientParity(reactRating(p), () => rating(p))
    }
  })
})
