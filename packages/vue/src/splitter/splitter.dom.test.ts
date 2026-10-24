// The Splitter contract model (React's matrix) against the Vue parts, and markup parity.
import { platforms, type SplitterPanel, splitterContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { type ConsumerInvariant, currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { defineComponent, h, type PropType, shallowRef, type VNode } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, Splitter } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  sizes: undefined,
  defaultSizes: undefined,
  step: undefined,
  disabled: undefined,
  handleDisabled: undefined,
}
/** jsdom has no layout: the drag steps are walked in browser mode only. */
const contract = inJsdom
  ? {
      ...splitterContract,
      events: {
        ...splitterContract.events,
        "POINTER.DOWN": { skip: "no layout in jsdom: walked in browser mode" },
      },
    }
  : splitterContract
const NAMES = ["Sidebar", "Editor", "Preview"]
type P = Record<string, unknown> & { readonly panels: readonly SplitterPanel[] }
const box = (p: P) => {
  const length = 400 + (p.panels.length - 1) * 10
  const vertical = p["orientation"] === "vertical"
  return {
    vertical,
    style: vertical
      ? { width: "200px", height: `${length}px` }
      : { width: `${length}px`, height: "100px" },
  }
}
/** 400 px of panels' space (10 px handles), so a percent is a whole number of pixels. */
const fixture = (p: P) => {
  const { vertical, style } = box(p)
  return h(Splitter.Root, { ...p, style }, () =>
    p.panels.flatMap((_, i) => [
      h(Splitter.Panel, { key: `p${i}`, index: i }, () => NAMES[i]),
      i < p.panels.length - 1
        ? h(Splitter.Handle, {
            key: `h${i}`,
            index: i,
            "aria-label": NAMES[i],
            style: vertical ? { height: "10px" } : { width: "10px" },
          })
        : null,
    ]),
  )
}
const reactFixture = (p: P) => {
  const { vertical, style } = box(p)
  return r(
    R.Splitter.Root,
    { ...p, style } as never,
    p.panels.flatMap((_, i) => [
      r(R.Splitter.Panel, { key: `p${i}`, index: i }, NAMES[i]),
      i < p.panels.length - 1
        ? r(R.Splitter.Handle, {
            key: `h${i}`,
            index: i,
            "aria-label": NAMES[i],
            style: vertical ? { height: "10px" } : { width: "10px" },
          })
        : null,
    ]),
  )
}
/** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
const Applying = defineComponent({
  props: {
    initial: { type: Array as PropType<number[]>, required: true },
    panels: { type: Array as PropType<SplitterPanel[]>, required: true },
    commit: { type: Function, required: true },
  },
  setup(props) {
    const sizes = shallowRef<readonly number[]>(props.initial)
    return () =>
      fixture({
        panels: props.panels,
        sizes: sizes.value,
        "onUpdate:sizes": (v: readonly number[]) => (sizes.value = v),
        onSizesCommit: props.commit,
      })
  },
})
const two = [{ min: 10 }, { min: 10 }]
const collapsible = [{ collapsible: true, min: 20 }, {}]
const three = [{ min: 10 }, { min: 10 }, { min: 10 }]
const configs: { name: string; props: P; ui: (commit: () => void) => VNode }[] = [
  {
    name: "horizontal, uncontrolled",
    props: { panels: two, defaultSizes: [30, 70] },
    ui: (c) => fixture({ panels: two, defaultSizes: [30, 70], onSizesCommit: c }),
  },
  {
    name: "vertical",
    props: { panels: two, defaultSizes: [30, 70] },
    ui: (c) =>
      fixture({ panels: two, defaultSizes: [30, 70], orientation: "vertical", onSizesCommit: c }),
  },
  {
    name: "collapsible",
    props: { panels: collapsible, defaultSizes: [30, 70] },
    ui: (c) => fixture({ panels: collapsible, defaultSizes: [30, 70], onSizesCommit: c }),
  },
  {
    name: "three panels",
    props: { panels: three, defaultSizes: [20, 30, 50] },
    ui: (c) => fixture({ panels: three, defaultSizes: [20, 30, 50], onSizesCommit: c }),
  },
  {
    name: "controlled, applying",
    props: { panels: two, defaultSizes: [30, 70] },
    ui: (c) => h(Applying, { initial: [30, 70], panels: two, commit: c }),
  },
]

for (const cfg of configs) {
  describe(`vue splitter model: ${cfg.name}`, () => {
    let pageCommits = 0
    let oracleCommits = 0
    const commits: ConsumerInvariant<typeof splitterContract> = {
      name: "splitter-commit-count",
      check: async () =>
        pageCommits === oracleCommits
          ? undefined
          : `sizesCommit ran ${pageCommits} times, the oracle ${oracleCommits}`,
    }
    testMachine(contract, {
      test: it,
      setup: () => {
        pageCommits = 0
        oracleCommits = 0
        return mount(() =>
          h(
            RindProvider,
            {
              dir: currentRun()?.direction ?? "ltr",
              environment: { platform: currentRun()?.platform ?? platforms.linux },
            },
            () => cfg.ui(() => pageCommits++),
          ),
        )
      },
      target: () => screen,
      anchor: [{ name: "Sidebar" }] as never,
      props: { ...base, ...cfg.props, onSizesCommit: () => oracleCommits++ } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      invariants: [commits],
      a11y,
    })
  })
}

describe("Vue Splitter matches React", () => {
  it("two, three, vertical, collapsible, disabled", async () => {
    for (const p of [
      { panels: two, defaultSizes: [30, 70] },
      { panels: three },
      { panels: two, orientation: "vertical" },
      { panels: collapsible, defaultSizes: [0, 100] },
      { panels: two, disabled: true },
    ] as P[]) {
      await serverParity(reactFixture(p), () => fixture(p))
      await clientParity(reactFixture(p), () => fixture(p))
    }
  })
})
