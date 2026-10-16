// The page breadcrumbs.pw.test.ts drives: a themed trail and a collapsed one, bundled by the
// test itself (no Storybook, no site build).
import { Breadcrumbs, Link, Popover } from "@rind-ui/react"
import { Fragment } from "react"
import { createRoot } from "react-dom/client"

const NAMES = ["Home", "Docs", "Guides", "Forms", "Fields", "Page"]

function Trail({ label, names, maxItems }: { label: string; names: string[]; maxItems?: number }) {
  return (
    <Breadcrumbs.Root aria-label={label} {...(maxItems === undefined ? {} : { maxItems })}>
      <Breadcrumbs.List>
        {names.map((n, i) => (
          <Fragment key={n}>
            <Breadcrumbs.Item value={n}>
              <Breadcrumbs.Link {...(i < names.length - 1 ? { href: `#${n}` } : {})}>
                {n}
              </Breadcrumbs.Link>
              <Breadcrumbs.Separator>›</Breadcrumbs.Separator>
            </Breadcrumbs.Item>
            {i === 0 && (
              <Breadcrumbs.Ellipsis>
                {({ items, label: more }) => (
                  <Popover.Root>
                    <Popover.Trigger aria-label={more}>…</Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner>
                        <Popover.Content aria-label="More breadcrumbs">
                          {items.map((it) => (
                            <Link key={it.key} {...(it.href ? { href: it.href } : {})}>
                              {it.textValue}
                            </Link>
                          ))}
                        </Popover.Content>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                )}
              </Breadcrumbs.Ellipsis>
            )}
          </Fragment>
        ))}
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}

function App() {
  return (
    <div style={{ display: "grid", gap: 24, padding: 24 }}>
      <Trail label="Breadcrumbs" names={["Home", "Docs", "Link"]} />
      <Trail label="Long trail" names={NAMES} maxItems={4} />
      <div dir="rtl">
        <Trail label="Right to left" names={["Home", "Docs", "Link"]} />
      </div>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
