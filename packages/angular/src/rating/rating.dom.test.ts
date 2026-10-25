// The Rating contract model (React's matrix) against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import { platforms, ratingContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Rating } from "./rating"

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
interface Cfg {
  readonly defaultValue?: number
  readonly allowHalf?: boolean
  readonly allowClear?: boolean
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly required?: boolean
  readonly count?: number
  /** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
  readonly applying?: boolean
}
/** The configuration the next fixture renders, and whether it is the form fixture. */
let current: { cfg: Cfg; form: boolean } = { cfg: {}, form: false }

const RATING = `<div
      rindRatingRoot
      name="score"
      [value]="value()"
      [defaultValue]="cfg.defaultValue"
      [allowHalf]="cfg.allowHalf"
      [allowClear]="cfg.allowClear"
      [readonly]="cfg.readOnly ?? false"
      [disabled]="cfg.disabled ?? false"
      [required]="cfg.required ?? false"
      [count]="cfg.count"
      (valueChange)="apply($event)"
    >
      <label rindRatingLabel>Score</label>
      <div rindRatingControl>
        @for (i of stars(); track i) {
          <span rindRatingItem [index]="i" style="display: inline-block; width: 24px; height: 24px"></span>
        }
      </div>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Rating],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    @if (form) {
      <form>${RATING}<button type="reset">Reset</button></form>
    } @else {
      ${RATING}
    }
  </ng-container>`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly cfg = current.cfg
  readonly form = current.form
  readonly value = signal(current.cfg.applying ? current.cfg.defaultValue : undefined)
  stars() {
    return Array.from({ length: this.cfg.count ?? 5 }, (_, i) => i + 1)
  }
  apply(v: number) {
    if (this.cfg.applying) this.value.set(v)
  }
}
const STAR = { display: "inline-block", width: "24px", height: "24px" }
const reactRating = (p: Cfg) =>
  r(
    R.Rating.Root,
    { name: "score", ...p } as never,
    r(R.Rating.Label, null, "Score"),
    r(
      R.Rating.Control,
      null,
      Array.from({ length: p.count ?? 5 }, (_, k) => k + 1).map((i) =>
        r(R.Rating.Item, { key: i, index: i, style: STAR }),
      ),
    ),
  )
const configs: { name: string; props: Record<string, unknown>; cfg: Cfg }[] = [
  { name: "uncontrolled", props: { defaultValue: 1 }, cfg: { defaultValue: 1 } },
  { name: "unrated", props: {}, cfg: {} },
  {
    name: "half stars, allowClear",
    props: { defaultValue: 2.5, allowHalf: true, allowClear: true },
    cfg: { defaultValue: 2.5, allowHalf: true, allowClear: true },
  },
  {
    name: "read-only",
    props: { defaultValue: 3, readOnly: true },
    cfg: { defaultValue: 3, readOnly: true },
  },
  {
    name: "controlled, applying",
    props: { defaultValue: 2 },
    cfg: { defaultValue: 2, applying: true },
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
  describe(`angular rating model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        current = { cfg: cfg.cfg, form: true }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Score" }] as never,
      props: { ...base, ...cfg.props } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      a11y,
    })
  })
}

describe("Angular Rating matches React", () => {
  it("unrated, a value, half, read-only, disabled, required", async () => {
    for (const cfg of [
      {},
      { defaultValue: 3 },
      { defaultValue: 2.5, allowHalf: true },
      { defaultValue: 3, readOnly: true },
      { disabled: true, required: true, count: 3 },
    ] as Cfg[]) {
      current = { cfg, form: false }
      await both(reactRating(cfg), Tree)
    }
  })
})
