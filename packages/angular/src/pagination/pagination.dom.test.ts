// The Pagination contract model (React's matrix) against the Angular parts, and markup parity.
import { Component, input } from "@angular/core"
import { type PaginationMachineProps, paginationArgs, paginationContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { allowRindWarning, type ConsumerInvariant, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { beforeEach, describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Pagination } from "./pagination"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
type Handler = ((value: number, details: unknown) => void) | undefined

/** The props the next fixture starts with (parity passes no inputs). */
let current: P = {}
const start = <T>(key: string) => current[key] as T | undefined

const ATTRS = `
    rindPaginationRoot
    #p="rindPaginationRoot"
    [totalPages]="totalPages()"
    [count]="count()"
    [page]="page()"
    [defaultPage]="defaultPage()"
    [pageSize]="pageSize()"
    [defaultPageSize]="defaultPageSize()"
    [disabled]="disabled() ?? false"
    [focusableWhenDisabled]="focusableWhenDisabled() ?? true"
    [getPageHref]="getPageHref()"
    (pageChangeDetails)="onPageChange()?.($event.value, $event.details)"
    (pageSizeChangeDetails)="onPageSizeChange()?.($event.value, $event.details)"`
const LIST = `<ul rindPaginationList>
      @if (getPageHref()) {
        <li rindPaginationItem type="trigger"><a rindPaginationFirst></a></li>
        <li rindPaginationItem type="trigger"><a rindPaginationPrevious></a></li>
        @for (e of p.state().pages; track e.key) {
          @if (e.type === "page") {
            <li rindPaginationItem><a rindPaginationPage [value]="e.value"></a></li>
          } @else {
            <li rindPaginationItem type="ellipsis">
              <span rindPaginationEllipsis [position]="e.position"></span>
            </li>
          }
        }
        <li rindPaginationItem type="trigger"><a rindPaginationNext></a></li>
        <li rindPaginationItem type="trigger"><a rindPaginationLast></a></li>
      } @else {
        <li rindPaginationItem type="trigger"><button rindPaginationFirst></button></li>
        <li rindPaginationItem type="trigger"><button rindPaginationPrevious></button></li>
        @for (e of p.state().pages; track e.key) {
          @if (e.type === "page") {
            <li rindPaginationItem><button rindPaginationPage [value]="e.value"></button></li>
          } @else {
            <li rindPaginationItem type="ellipsis">
              <span rindPaginationEllipsis [position]="e.position"></span>
            </li>
          }
        }
        <li rindPaginationItem type="trigger"><button rindPaginationNext></button></li>
        <li rindPaginationItem type="trigger"><button rindPaginationLast></button></li>
      }
    </ul>`

@Component({
  selector: "rind-f",
  imports: [Pagination],
  template: `<nav ${ATTRS}>${LIST}</nav>`,
})
class Tree {
  readonly totalPages = input(start<number>("totalPages"))
  readonly count = input(start<number>("count"))
  readonly page = input(start<number>("page"))
  readonly defaultPage = input(start<number>("defaultPage"))
  readonly pageSize = input(start<number>("pageSize"))
  readonly defaultPageSize = input(start<number>("defaultPageSize"))
  readonly siblingCount = input(start<number>("siblingCount"))
  readonly boundaryCount = input(start<number>("boundaryCount"))
  readonly disabled = input(start<boolean>("disabled"))
  readonly focusableWhenDisabled = input(start<boolean>("focusableWhenDisabled"))
  readonly getPageHref = input(start<(page: number, pageSize: number) => string>("getPageHref"))
  readonly onPageChange = input<Handler>()
  readonly onPageSizeChange = input<Handler>()
}

/** Named by the consumer: `aria-label` is a static attribute. */
@Component({
  selector: "rind-f",
  imports: [Pagination],
  template: `<nav aria-label="Results" ${ATTRS}>${LIST}</nav>`,
})
class Named extends Tree {}

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
})
/** Defined props only, as inputs the fixture has. */
const defined = (p: P) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))

function model(
  name: string,
  totalPages: number,
  start: Partial<PaginationMachineProps>,
  extra: P = {},
) {
  describe(`angular pagination model: ${name}`, () => {
    paginationArgs.current = { totalPages }
    const props = { ...base, totalPages, ...start }
    testMachine(paginationContract, {
      test: it,
      setup: () => {
        paginationArgs.current = { totalPages }
        current = {}
        return mount(Tree, defined({ ...props, ...extra }))
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

describe("Angular Pagination matches React", () => {
  it("buttons, links, disabled, count", async () => {
    // Parity mounts the React and the Angular pager side by side: two landmarks of one name.
    allowRindWarning(/pagination: two pagination landmarks are named/)
    for (const p of [
      { totalPages: 1 },
      { totalPages: 20, defaultPage: 10 },
      { totalPages: 20, defaultPage: 10, getPageHref: (n: number) => `#page-${n}` },
      { totalPages: 5, defaultPage: 3, disabled: true },
      { count: 95, defaultPage: 10, "aria-label": "Results" },
    ] as P[]) {
      current = p
      await both(reactPager(p), p["aria-label"] ? Named : Tree)
    }
  })
})
