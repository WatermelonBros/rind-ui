/** @jsxImportSource solid-js */
// The Grid List contract model (React's matrix) against the Solid parts, and markup parity.
import {
  createListCollection,
  type GridListProps,
  gridListContract,
  gridListIds,
  gridListTraits,
  platforms,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { Fragment as RFragment, createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { GridList, type GridListRootProps, RindProvider } from "../index"

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
// `extra` may carry getters: a spread keeps them reactive.
const list = (cfg: Config, extra: Record<string, unknown> = {}): JSX.Element => (
  <GridList.Root {...({ ...rootOf(cfg), ...extra } as GridListRootProps)}>
    <GridList.Label>People</GridList.Label>
    <GridList.List>
      <For each={[...(cfg.rows ?? PEOPLE)]}>
        {(row) => (
          <GridList.Item value={row.key} disabled={row.disabled} href={row.href}>
            {cfg.checkboxes ? <GridList.ItemCheckbox /> : null}
            <GridList.ItemText>{row.key}</GridList.ItemText>
            {cfg.controls ? (
              <>
                <GridList.ItemControl>Edit</GridList.ItemControl>
                <GridList.ItemControl>Delete</GridList.ItemControl>
              </>
            ) : null}
          </GridList.Item>
        )}
      </For>
      <GridList.Empty>No people</GridList.Empty>
    </GridList.List>
  </GridList.Root>
)
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
  const ui = (p: { value?: unknown }): JSX.Element => (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
    >
      <button type="button">Before</button>
      {list(
        cfg,
        cfg.controlled
          ? {
              get value() {
                return p.value
              },
            }
          : {},
      )}
      <button type="button">After</button>
    </RindProvider>
  )
  describe(`solid grid list model: ${name}`, () => {
    testMachine(contract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => mount(ui, cfg.controlled ? { value: [] } : {}),
      ...(cfg.controlled
        ? {
            rerender: (
              next: { value?: unknown },
              rendered: { rerender(p: object): Promise<void> },
            ) => rendered.rerender({ value: next.value ?? [] }),
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

describe("Solid Grid List matches React", () => {
  it("selection, checkboxes, controls, links, empty", async () => {
    for (const cfg of [
      { selectionMode: "multiple", checkboxes: true },
      { selectionMode: "single", controls: true },
      { rows: PEOPLE.map((p) => ({ ...p, href: `#${p.key}` })) },
      { rows: [] },
    ] as Config[]) {
      await clientParity(reactList(cfg), () => list(cfg))
    }
  })
})
