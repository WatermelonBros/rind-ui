// The Grid List contract model (React's matrix) against the Svelte parts, and DOM parity.
import {
  createListCollection,
  type GridListProps,
  gridListContract,
  gridListIds,
  gridListTraits,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { Fragment as RFragment, createElement as r } from "react"
import { describe, it } from "vitest"
import People from "../../fixtures/grid-list/people.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

type Row = { readonly key: string; readonly disabled?: boolean; readonly href?: string }
const PEOPLE: readonly Row[] = ["Ada", "Grace", "Alan", "Edsger"].map((key) => ({ key }))
type Config = Pick<GridListProps, "selectionMode" | "selectionBehavior"> & {
  readonly rows?: readonly Row[]
  readonly actions?: boolean
  readonly checkboxes?: boolean
  readonly controls?: boolean
  readonly childNavigation?: "arrow" | "tab"
  /** A parent controls the value (the $sync:value prop step runs). */
  readonly controlled?: boolean
}
const rootOf = (cfg: Config) => ({
  selectionMode: cfg.selectionMode ?? "none",
  ...(cfg.selectionBehavior ? { selectionBehavior: cfg.selectionBehavior } : {}),
  ...(cfg.actions ? { onAction: () => {} } : {}),
  ...(cfg.childNavigation ? { childNavigation: cfg.childNavigation } : {}),
})
const reactList = (cfg: Config, extra: Record<string, unknown> = {}) =>
  r(
    R.GridList.Root,
    { ...rootOf(cfg), ...extra } as never,
    r(R.GridList.Label, null, "People"),
    r(
      R.GridList.List,
      null,
      (cfg.rows ?? PEOPLE).map((row) =>
        r(
          R.GridList.Item,
          { key: row.key, value: row.key, disabled: row.disabled, href: row.href } as never,
          cfg.checkboxes ? r(R.GridList.ItemCheckbox) : null,
          r(R.GridList.ItemText, null, row.key),
          cfg.controls
            ? r(
                RFragment,
                null,
                r(R.GridList.ItemControl, null, "Edit"),
                r(R.GridList.ItemControl, null, "Delete"),
              )
            : null,
        ),
      ),
      r(R.GridList.Empty, null, "No people"),
    ),
  )

function config(name: string, cfg: Config) {
  const events = gridListContract.events as Record<string, unknown>
  const contract = {
    ...gridListContract,
    traits: gridListTraits(cfg),
    events: {
      ...events,
      ...(cfg.actions ? {} : { ACTION: { skip: "no onAction in this class (Enter selects)" } }),
      ...(cfg.controls && cfg.childNavigation !== "tab"
        ? {
            NAVIGATE_CHILD: {
              from: {
                idle: { skip: "arrows need focus on a row: taken from focused" },
                focused: {
                  action: "arrowIn",
                  event: () => ({ direction: "next", count: 2 + (cfg.checkboxes ? 1 : 0) }),
                },
              },
            },
          }
        : cfg.childNavigation === "tab"
          ? { NAVIGATE_CHILD: { skip: "tab mode: arrows never move between a row's children" } }
          : {}),
    },
  } as unknown as typeof gridListContract
  const rows = cfg.rows ?? PEOPLE
  const props = (value?: unknown) =>
    ({
      rows,
      root: rootOf(cfg),
      checkboxes: cfg.checkboxes === true,
      controls: cfg.controls === true,
      ...(value === undefined ? {} : { value }),
    }) as never
  describe(`svelte grid list model: ${name}`, () => {
    testMachine(contract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => mount(People, props(cfg.controlled ? [] : undefined)),
      ...(cfg.controlled
        ? {
            rerender: (
              next: { value?: unknown },
              rendered: { rerender(p: object): Promise<void> },
            ) => rendered.rerender(props(next.value ?? [])),
          }
        : {}),
      target: () => screen,
      anchor: [{ name: "People" }],
      props: {
        collection: createListCollection({
          items: rows,
          getKey: (row) => row.key,
          getText: (row) => row.key,
          isDisabled: (row) => row.disabled === true,
        }),
        ids: gridListIds("oracle"),
        strategy: "roving",
        selectionMode: cfg.selectionMode ?? "none",
        selectionBehavior: cfg.selectionBehavior,
        disallowEmptySelection: undefined,
        disabledBehavior: undefined,
        focusableWhenDisabled: undefined,
        disabled: undefined,
        loop: undefined,
        typeaheadTimeout: undefined,
        checkboxes: cfg.checkboxes ? new Set(rows.map((row) => row.key)) : undefined,
        messages: undefined,
        ...(cfg.controlled ? { value: [] } : {}),
        defaultValue: (cfg.selectionMode ?? "none") === "multiple" ? [] : null,
        ...(cfg.actions ? { onAction: () => {} } : {}),
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}
config("actions, no selection", { actions: true })
config("single", { selectionMode: "single" })
config("multiple toggle", { selectionMode: "multiple" })
config("multiple controlled", { selectionMode: "multiple", controlled: true })
config("multiple replace with actions", {
  selectionMode: "multiple",
  selectionBehavior: "replace",
  actions: true,
})
config("checkboxes and actions", { selectionMode: "multiple", checkboxes: true, actions: true })
config("controls, arrow mode", { selectionMode: "single", controls: true })
config("controls, tab mode", { selectionMode: "single", controls: true, childNavigation: "tab" })
config("disabled rows", {
  selectionMode: "multiple",
  rows: PEOPLE.map((p) => (p.key === "Grace" ? { ...p, disabled: true } : p)),
})
config("links", { rows: PEOPLE.map((p) => ({ ...p, href: `#${p.key}` })) })

describe("Svelte Grid List matches React", () => {
  it("selection, checkboxes, controls, links, empty", async () => {
    for (const cfg of [
      { selectionMode: "multiple", checkboxes: true },
      { selectionMode: "single", controls: true },
      { rows: PEOPLE.map((p) => ({ ...p, href: `#${p.key}` })) },
      { rows: [] },
    ] as Config[]) {
      await clientParity(reactList(cfg), People, {
        rows: cfg.rows ?? PEOPLE,
        root: rootOf(cfg),
        checkboxes: cfg.checkboxes === true,
        controls: cfg.controls === true,
        provider: false,
      } as never)
    }
  })
})
