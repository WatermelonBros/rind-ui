// add-breadcrumbs 3.2: server markup hydrates with zero warnings, static and data-driven,
// collapsed and not; the data-driven form collapses in the server HTML already (design §6).
import { Breadcrumbs } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const NAMES = ["Home", "Docs", "Guides", "Forms", "Fields", "Page"]

function Trail({ maxItems, data }: { maxItems?: number; data?: boolean }) {
  return (
    <Breadcrumbs.Root
      {...(maxItems === undefined ? {} : { maxItems })}
      {...(data
        ? {
            items: NAMES.map((n, i) => ({
              key: n,
              textValue: n,
              ...(i < 5 ? { href: `/${i}` } : {}),
            })),
          }
        : {})}
    >
      <Breadcrumbs.List>
        {NAMES.map((n, i) => (
          <Breadcrumbs.Item key={n} value={n}>
            <Breadcrumbs.Link {...(i < 5 ? { href: `/${i}` } : {})}>{n}</Breadcrumbs.Link>
            <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}

async function hydrate(tree: ReactNode) {
  const container = document.createElement("div")
  const html = renderToString(tree)
  container.innerHTML = html
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls, ...warn.mock.calls]
  const after = container.innerHTML
  await act(async () => root?.unmount())
  container.remove()
  return { calls, html, after }
}

describe("Breadcrumbs hydration", () => {
  for (const [name, tree] of Object.entries({
    static: <Trail />,
    "static, collapsed": <Trail maxItems={4} />,
    "data-driven": <Trail data />,
    "data-driven, collapsed": <Trail maxItems={4} data />,
  })) {
    it(`${name}: no warning or error`, async () => {
      const { calls } = await hydrate(tree)
      expect(calls).toEqual([])
    })
  }

  it("data-driven: the server HTML is already collapsed and has the current item", async () => {
    const { html } = await hydrate(<Trail maxItems={4} data />)
    expect(html.match(/data-collapsed=""/g)?.length).toBe(5) // Root + 4 Items
    expect(html).toContain('aria-current="page"')
  })

  it("static: collapse applies in the first commit after hydration", async () => {
    const { after } = await hydrate(<Trail maxItems={4} />)
    expect(after.match(/<li[^>]*hidden/g)?.length).toBe(4)
    expect(after).toContain('aria-current="page"')
  })
})
