// The Splitter contract model (React's matrix) against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import { platforms, type SplitterPanel, splitterContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { type ConsumerInvariant, currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Splitter } from "./splitter"

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
interface P {
  readonly panels: readonly SplitterPanel[]
  readonly defaultSizes?: readonly number[]
  readonly orientation?: "horizontal" | "vertical"
  readonly disabled?: boolean
  /** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
  readonly applying?: boolean
}
const box = (p: P) => {
  const length = 400 + (p.panels.length - 1) * 10
  const vertical = p.orientation === "vertical"
  return {
    vertical,
    style: vertical
      ? { width: "200px", height: `${length}px` }
      : { width: `${length}px`, height: "100px" },
  }
}
/** The configuration the next fixture renders, and the commit counter it reports to. */
let current: { p: P; commit: () => void } = { p: { panels: [] }, commit: () => {} }

/** 400 px of panels' space (10 px handles), so a percent is a whole number of pixels. */
@Component({
  selector: "rind-f",
  imports: [RindProvider, Splitter],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    <div
      rindSplitterRoot
      [panels]="p.panels"
      [defaultSizes]="p.applying ? undefined : p.defaultSizes"
      [sizes]="p.applying ? sizes() : undefined"
      [orientation]="p.orientation ?? 'horizontal'"
      [disabled]="p.disabled ?? false"
      [style]="box.style"
      (sizesChange)="sizes.set($event)"
      (sizesCommit)="commit()"
    >
      @for (panel of p.panels; track $index; let i = $index, last = $last) {
        <div rindSplitterPanel [index]="i">{{ names[i] }}</div>
        @if (!last) {
          <div rindSplitterHandle [index]="i" [attr.aria-label]="names[i]" [style]="handleStyle"></div>
        }
      }
    </div>
  </ng-container>`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly p = current.p
  readonly commit = current.commit
  readonly names = NAMES
  readonly box = box(current.p)
  readonly handleStyle = this.box.vertical ? { height: "10px" } : { width: "10px" }
  readonly sizes = signal<readonly number[] | undefined>(current.p.defaultSizes)
}
const reactFixture = (p: P) => {
  const { vertical, style } = box(p)
  const { applying: _applying, ...props } = p
  return r(
    R.Splitter.Root,
    { ...props, style } as never,
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
const configs: { name: string; props: Record<string, unknown>; p: P }[] = [
  {
    name: "horizontal, uncontrolled",
    props: { panels: two, defaultSizes: [30, 70] },
    p: { panels: two, defaultSizes: [30, 70] },
  },
  {
    name: "vertical",
    props: { panels: two, defaultSizes: [30, 70] },
    p: { panels: two, defaultSizes: [30, 70], orientation: "vertical" },
  },
  {
    name: "collapsible",
    props: { panels: collapsible, defaultSizes: [30, 70] },
    p: { panels: collapsible, defaultSizes: [30, 70] },
  },
  {
    name: "three panels",
    props: { panels: three, defaultSizes: [20, 30, 50] },
    p: { panels: three, defaultSizes: [20, 30, 50] },
  },
  {
    name: "controlled, applying",
    props: { panels: two, defaultSizes: [30, 70] },
    p: { panels: two, defaultSizes: [30, 70], applying: true },
  },
]

for (const cfg of configs) {
  describe(`angular splitter model: ${cfg.name}`, () => {
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
        current = { p: cfg.p, commit: () => pageCommits++ }
        return mount(Tree)
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

describe("Angular Splitter matches React", () => {
  it("two, three, vertical, collapsible, disabled", async () => {
    for (const p of [
      { panels: two, defaultSizes: [30, 70] },
      { panels: three },
      { panels: two, orientation: "vertical" },
      { panels: collapsible, defaultSizes: [0, 100] },
      { panels: two, disabled: true },
    ] as P[]) {
      current = { p, commit: () => {} }
      await both(reactFixture(p), Tree)
    }
  })
})
