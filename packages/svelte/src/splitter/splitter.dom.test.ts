// The Splitter contract model (React's matrix) against the Svelte parts, and DOM parity.
import { type SplitterPanel, splitterContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { type ConsumerInvariant, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Editor from "../../fixtures/splitter/editor.svelte"

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
const two = [{ min: 10 }, { min: 10 }]
const collapsible = [{ collapsible: true, min: 20 }, {}]
const three = [{ min: 10 }, { min: 10 }, { min: 10 }]
const configs: {
  name: string
  props: P
  svelte: (commit: () => void) => Record<string, unknown>
}[] = [
  {
    name: "horizontal, uncontrolled",
    props: { panels: two, defaultSizes: [30, 70] },
    svelte: (c) => ({ root: { panels: two, defaultSizes: [30, 70], onSizesCommit: c } }),
  },
  {
    name: "vertical",
    props: { panels: two, defaultSizes: [30, 70] },
    svelte: (c) => ({
      root: { panels: two, defaultSizes: [30, 70], orientation: "vertical", onSizesCommit: c },
    }),
  },
  {
    name: "collapsible",
    props: { panels: collapsible, defaultSizes: [30, 70] },
    svelte: (c) => ({ root: { panels: collapsible, defaultSizes: [30, 70], onSizesCommit: c } }),
  },
  {
    name: "three panels",
    props: { panels: three, defaultSizes: [20, 30, 50] },
    svelte: (c) => ({ root: { panels: three, defaultSizes: [20, 30, 50], onSizesCommit: c } }),
  },
  {
    name: "controlled, applying",
    props: { panels: two, defaultSizes: [30, 70] },
    svelte: (c) => ({ root: { panels: two, onSizesCommit: c }, applying: [30, 70] }),
  },
]

for (const cfg of configs) {
  describe(`svelte splitter model: ${cfg.name}`, () => {
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
        return mount(Editor, cfg.svelte(() => pageCommits++) as never)
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

describe("Svelte Splitter matches React", () => {
  it("two, three, vertical, collapsible, disabled", async () => {
    for (const p of [
      { panels: two, defaultSizes: [30, 70] },
      { panels: three },
      { panels: two, orientation: "vertical" },
      { panels: collapsible, defaultSizes: [0, 100] },
      { panels: two, disabled: true },
    ] as P[]) {
      await clientParity(reactFixture(p), Editor, { root: p, provider: false } as never)
    }
  })
})
