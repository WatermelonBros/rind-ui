/** @jsxImportSource solid-js */
import { Breadcrumbs } from "@rind-ui/solid"
import { For } from "solid-js"

const crumbs: readonly { label: string; href?: string }[] = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs/" },
  { label: "Breadcrumbs" },
]

export function Basic() {
  return (
    <Breadcrumbs.Root>
      <Breadcrumbs.List>
        <For each={crumbs}>
          {(c) => (
            <Breadcrumbs.Item value={c.label}>
              <Breadcrumbs.Link href={c.href}>{c.label}</Breadcrumbs.Link>
              <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
            </Breadcrumbs.Item>
          )}
        </For>
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}
