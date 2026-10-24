/** @jsxImportSource solid-js */
// The Pagination contract model (React's matrix) against the Solid parts, and markup parity.
import { type PaginationMachineProps, paginationArgs, paginationContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { allowRindWarning, type ConsumerInvariant, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { beforeEach, describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Pagination, type PaginationRootProps } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const pager = (p: P): JSX.Element => (
  <Pagination.Root {...(p as PaginationRootProps)}>
    {(state) => (
      <Pagination.List>
        <Pagination.Item type="trigger">
          <Pagination.First />
        </Pagination.Item>
        <Pagination.Item type="trigger">
          <Pagination.Previous />
        </Pagination.Item>
        <For each={state.pages}>
          {(e) =>
            e.type === "page" ? (
              <Pagination.Item>
                <Pagination.Page value={e.value} />
              </Pagination.Item>
            ) : (
              <Pagination.Item type="ellipsis">
                <Pagination.Ellipsis position={e.position} />
              </Pagination.Item>
            )
          }
        </For>
        <Pagination.Item type="trigger">
          <Pagination.Next />
        </Pagination.Item>
        <Pagination.Item type="trigger">
          <Pagination.Last />
        </Pagination.Item>
      </Pagination.List>
    )}
  </Pagination.Root>
)
const reactPager = (p: P) =>
  r(R.Pagination.Root, {
    ...p,
    children: (state: R.PaginationRootState) =>
      r(
        R.Pagination.List,
        null,
        r(R.Pagination.Item, { type: "trigger" }, r(R.Pagination.First)),
        r(R.Pagination.Item, { type: "trigger" }, r(R.Pagination.Previous)),
        state.pages.map((e) =>
          e.type === "page"
            ? r(R.Pagination.Item, { key: e.key }, r(R.Pagination.Page, { value: e.value }))
            : r(
                R.Pagination.Item,
                { key: e.key, type: "ellipsis" },
                r(R.Pagination.Ellipsis, { position: e.position }),
              ),
        ),
        r(R.Pagination.Item, { type: "trigger" }, r(R.Pagination.Next)),
        r(R.Pagination.Item, { type: "trigger" }, r(R.Pagination.Last)),
      ),
  } as never)

/** Focus never lands on <body> because of a page change (spec "Focus"). */
const focusKept = (on: boolean): ConsumerInvariant<typeof paginationContract> => ({
  name: "pagination-focus-not-on-body",
  check: async ({ env, stepModality }) => {
    if (!on || (stepModality !== "keyboard" && stepModality !== "pointer")) return undefined
    return (await env.focused().exists()) ? undefined : "focus moved to <body> after the step"
  },
})
const base: PaginationMachineProps = {
  totalPages: undefined,
  count: undefined,
  page: undefined,
  defaultPage: undefined,
  onPageChange: undefined,
  pageSize: undefined,
  defaultPageSize: undefined,
  onPageSizeChange: undefined,
  siblingCount: undefined,
  boundaryCount: undefined,
  disabled: undefined,
}
beforeEach(() => {
  allowRindWarning(/pagination: "pageSize" changed between controlled and uncontrolled/)
  allowRindWarning(/pagination: pageSize is controlled without onPageSizeChange/)
  allowRindWarning(/pagination: page is controlled without onPageChange/)
})
/** Defined props only: Vue treats a present `undefined` as absent anyway, React too. */
const defined = (p: P) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))

function model(
  name: string,
  totalPages: number,
  start: Partial<PaginationMachineProps>,
  extra: P = {},
) {
  describe(`solid pagination model: ${name}`, () => {
    paginationArgs.current = { totalPages }
    const props = { ...base, totalPages, ...start }
    testMachine(paginationContract, {
      test: it,
      setup: () => {
        paginationArgs.current = { totalPages }
        return mount(pager, defined({ ...props, ...extra }))
      },
      rerender: (next, rendered) => rendered.rerender(defined({ ...(next as P), ...extra })),
      target: () => screen,
      anchor: [{ name: "Pagination" }] as never,
      props,
      modalities: ["pointer", "keyboard", "virtual"],
      invariants: [focusKept(extra["focusableWhenDisabled"] !== false)],
      a11y,
    })
  })
}

model("1 page", 1, {})
model("5 pages, first", 5, {})
model("5 pages, last", 5, { defaultPage: 5 })
model("20 pages, middle", 20, { defaultPage: 10 })
model("20 pages, links", 20, { defaultPage: 10 }, { getPageHref: (p: number) => `#page-${p}` })
model("disabled", 5, { defaultPage: 3, disabled: true })
model("focusableWhenDisabled false", 5, {}, { focusableWhenDisabled: false })
model("count, 95 items", 10, { totalPages: undefined, count: 95, defaultPage: 10 })

describe("Solid Pagination matches React", () => {
  it("buttons, links, disabled, count", async () => {
    // Parity mounts the React and the Solid pager one after the other, but both are landmarks.
    allowRindWarning(/pagination: two pagination landmarks are named/)
    for (const p of [
      { totalPages: 1 },
      { totalPages: 20, defaultPage: 10 },
      { totalPages: 20, defaultPage: 10, getPageHref: (n: number) => `#page-${n}` },
      { totalPages: 5, defaultPage: 3, disabled: true },
      { count: 95, defaultPage: 10, "aria-label": "Results" },
    ]) {
      await clientParity(reactPager(p), () => pager(p))
    }
  })
})
