"use client"

import { Collapsible, TextField, Toggle } from "@rind-ui/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import styles from "./sidebar.module.css"

export type NavEntry = { readonly slug: string; readonly label: string }
export type NavGroup = { readonly title: string; readonly entries: readonly NavEntry[] }

const FRAMEWORKS = [
  { name: "React", ready: true },
  { name: "Vue", ready: false },
  { name: "Svelte", ready: false },
  { name: "Solid", ready: false },
  { name: "Angular", ready: false },
] as const

export function Sidebar({ groups }: { groups: readonly NavGroup[] }) {
  const path = usePathname()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  // On a phone the nav is a menu that opens over the page; on wider screens it is always open.
  const [wide, setWide] = useState(true)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const mq = matchMedia("(min-width: 861px)")
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: closing on navigation is the point
  useEffect(() => setMenu(false), [path])

  return (
    <aside className={styles.side} aria-label="Documentation">
      <Collapsible.Root open={wide || menu} onOpenChange={setMenu} closedContent="hidden">
        <Collapsible.Trigger className={styles.menuButton}>
          Menu
          <Collapsible.Indicator className={styles.menuIcon}>+</Collapsible.Indicator>
        </Collapsible.Trigger>
        <Collapsible.Content className={styles.menuContent}>
          <div className={styles.frameworks}>
            <p className={styles.label}>Framework</p>
            <div className={styles.fwList}>
              {FRAMEWORKS.map((f) => (
                <Toggle.Root
                  key={f.name}
                  className={styles.fw}
                  pressed={f.ready}
                  disabled={!f.ready}
                  focusableWhenDisabled
                  title={f.ready ? undefined : `${f.name} is planned`}
                >
                  {f.name}
                  {!f.ready && <small>soon</small>}
                </Toggle.Root>
              ))}
            </div>
          </div>

          <TextField.Root
            className={styles.filter}
            value={query}
            onValueChange={(v) => setQuery(v)}
          >
            <TextField.Label className={styles.visuallyHidden}>Filter pages</TextField.Label>
            <TextField.Input className={styles.filterInput} placeholder="Filter…" />
          </TextField.Root>

          <nav className={styles.groups}>
            {groups.map((g) => {
              const entries = q
                ? g.entries.filter((e) => e.label.toLowerCase().includes(q))
                : g.entries
              if (entries.length === 0) return null
              return (
                <div key={g.title} className={styles.group}>
                  <p className={styles.label}>
                    {g.title}
                    <span>{entries.length}</span>
                  </p>
                  <ul>
                    {entries.map(({ slug, label }) => {
                      const href = `/docs/${slug}/`
                      return (
                        <li key={slug}>
                          <Link href={href} aria-current={path === href ? "page" : undefined}>
                            {label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </nav>
        </Collapsible.Content>
      </Collapsible.Root>
    </aside>
  )
}
