// Model-based tests: the Grid List contract over the props classes of the spec (task 6.2):
// no selection with actions, single and multiple (toggle and replace), checkboxes, controls in
// arrow and tab mode, disabled rows and links, in every modality and under rtl.
import {
  createListCollection,
  type GridListProps,
  gridListContract,
  gridListIds,
  gridListTraits,
  platforms,
} from "@rind-ui/core"
import { GridList, type GridListRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

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

function config(name: string, cfg: Config) {
  const events = gridListContract.events as Record<string, unknown>
  const contract = {
    ...gridListContract,
    traits: gridListTraits(cfg),
    events: {
      ...events,
      // Without onAction, Enter selects: the ACTION event is never sent in this class.
      ...(cfg.actions ? {} : { ACTION: { skip: "no onAction in this class (Enter selects)" } }),
      // Arrow mode with controls: ArrowRight enters the row's two controls (Edit, Delete).
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
  const root = {
    selectionMode: cfg.selectionMode ?? "none",
    ...(cfg.selectionBehavior ? { selectionBehavior: cfg.selectionBehavior } : {}),
    ...(cfg.actions ? { onAction: () => {} } : {}),
    ...(cfg.childNavigation ? { childNavigation: cfg.childNavigation } : {}),
  } as GridListRootProps
  const ui = (value?: unknown) => (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
    >
      <button type="button">Before</button>
      <GridList.Root
        // Sound: the controlled value matches the class's selection mode (multiple).
        {...({
          ...root,
          ...(value === undefined ? {} : { value, onValueChange: () => {} }),
        } as GridListRootProps)}
      >
        <GridList.Label>People</GridList.Label>
        <GridList.List>
          {rows.map((r) => (
            <GridList.Item key={r.key} value={r.key} disabled={r.disabled} href={r.href}>
              {cfg.checkboxes ? <GridList.ItemCheckbox /> : null}
              <GridList.ItemText>{r.key}</GridList.ItemText>
              {cfg.controls ? (
                <>
                  <GridList.ItemControl>Edit</GridList.ItemControl>
                  <GridList.ItemControl>Delete</GridList.ItemControl>
                </>
              ) : null}
            </GridList.Item>
          ))}
          <GridList.Empty>No people</GridList.Empty>
        </GridList.List>
      </GridList.Root>
      <button type="button">After</button>
    </RindProvider>
  )
  describe(`grid list model: ${name}`, () => {
    testMachine(contract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => render(ui(cfg.controlled ? [] : undefined)),
      ...(cfg.controlled
        ? {
            rerender: (next: { value?: unknown }, rendered: ReturnType<typeof render>) =>
              rendered.rerender(ui(next.value ?? [])),
          }
        : {}),
      target: () => screen,
      anchor: [{ name: "People" }],
      props: {
        collection: createListCollection({
          items: rows,
          getKey: (r) => r.key,
          getText: (r) => r.key,
          isDisabled: (r) => r.disabled === true,
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
        checkboxes: cfg.checkboxes ? new Set(rows.map((r) => r.key)) : undefined,
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
