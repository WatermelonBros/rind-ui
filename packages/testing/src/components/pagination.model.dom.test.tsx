// Model-based tests (add-pagination 5.1, spec "Model-Based Coverage"): the pagination
// contract over its argument classes (1, 5, 20 pages; first, middle, last; buttons and
// links; disabled; focusableWhenDisabled false) in pointer, keyboard and virtual, with
// focus never left on <body> after a step, and axe per state.
import { type PaginationMachineProps, paginationArgs, paginationContract } from "@rind-ui/core"
import { Pagination, type PaginationRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { beforeEach, describe, expect, it } from "vitest"
import { allowRindWarning, type ConsumerInvariant, domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Extra = Pick<PaginationRootProps, "getPageHref" | "focusableWhenDisabled">

function Pager(props: PaginationMachineProps & Extra) {
  // The model passes the machine's flat props; the union is the consumer's type.
  const root = props as PaginationRootProps
  return (
    <Pagination.Root {...root}>
      {(state) => (
        <Pagination.List>
          <Pagination.Item type="trigger">
            <Pagination.First />
          </Pagination.Item>
          <Pagination.Item type="trigger">
            <Pagination.Previous />
          </Pagination.Item>
          {state.pages.map((e) =>
            e.type === "page" ? (
              <Pagination.Item key={e.key}>
                <Pagination.Page value={e.value} />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={e.key} type="ellipsis">
                <Pagination.Ellipsis position={e.position} />
              </Pagination.Item>
            ),
          )}
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
}

/**
 * Focus never lands on <body> because of a page change (spec "Focus"). Keyboard and pointer
 * steps leave focus on the control; virtual steps are bare clicks that never move focus. Off
 * with `focusableWhenDisabled={false}`: the documented opt-out, where a trigger that becomes
 * natively disabled at the end drops focus (design "Risks").
 */
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

// The model's $props steps switch pageSize between controlled and uncontrolled on purpose.
beforeEach(() => {
  allowRindWarning(/pagination: "pageSize" changed between controlled and uncontrolled/)
  allowRindWarning(/pagination: pageSize is controlled without onPageSizeChange/)
})

function model(name: string, totalPages: number, start: PaginationMachineProps, extra: Extra = {}) {
  describe(`pagination model: ${name}`, () => {
    // Read while the paths are planned (now) and while they run (setup).
    paginationArgs.current = { totalPages }
    const props = { ...base, totalPages, ...start }
    testMachine(paginationContract, {
      test: it,
      setup: () => {
        paginationArgs.current = { totalPages }
        return render(<Pager {...props} {...extra} />)
      },
      rerender: (next, rendered) => rendered.rerender(<Pager {...next} {...extra} />),
      target: () => screen,
      anchor: [{ name: "Pagination" }] as never,
      props,
      modalities: ["pointer", "keyboard", "virtual"],
      invariants: [focusKept(extra.focusableWhenDisabled !== false)],
      a11y,
    })
  })
}

model("1 page", 1, {})
model("5 pages, first", 5, {})
model("5 pages, last", 5, { defaultPage: 5 })
model("20 pages, middle", 20, { defaultPage: 10 })
model("20 pages, links", 20, { defaultPage: 10 }, { getPageHref: (p) => `#page-${p}` })
model("disabled", 5, { defaultPage: 3, disabled: true })
model("focusableWhenDisabled false", 5, {}, { focusableWhenDisabled: false })
// Count-based: no totalPages, so the $props:count step (count 11 → 2 pages) clamps page 10.
model("count, 95 items", 10, { totalPages: undefined, count: 95, defaultPage: 10 })

describe("a broken wrapper fails readably", () => {
  it("dropping aria-current from page buttons fails the current-page invariant", {
    timeout: 60_000,
  }, async () => {
    const tests: { fn: () => Promise<void> }[] = []
    paginationArgs.current = { totalPages: 5 }
    testMachine(paginationContract, {
      test: (_, fn) => tests.push({ fn }),
      setup: () =>
        render(
          <Pagination.Root totalPages={5}>
            {(state) => (
              <Pagination.List>
                {state.pages.map((e) =>
                  e.type === "page" ? (
                    <Pagination.Item key={e.key}>
                      {/* Broken: the wrapper drops aria-current. */}
                      <Pagination.Page
                        value={e.value}
                        render={({ "aria-current": _dropped, ...p }) => <button {...p} />}
                      />
                    </Pagination.Item>
                  ) : null,
                )}
              </Pagination.List>
            )}
          </Pagination.Root>,
        ),
      target: () => domEnv({ timeout: 200 }),
      anchor: [{ name: "Pagination" }] as never,
      props: { ...base, totalPages: 5 },
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.find((m) => /pagination-one-current-page/.test(m))).toMatch(/page part/)
  })
})
