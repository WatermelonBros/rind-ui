"use client"

import { Collapsible, TextField, ToggleGroup } from "@rind-ui/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { stateWord } from "@/lib/framework-status"
import { useFramework } from "./framework"
import styles from "./sidebar.module.css"

export type NavEntry = { readonly slug: string; readonly label: string }
export type NavGroup = { readonly title: string; readonly entries: readonly NavEntry[] }

/** A framework as the build read it from its package (lib/frameworks.ts). */
export type SidebarFramework = {
  readonly id: string
  readonly name: string
  readonly ready: boolean
  readonly components: readonly string[]
}

export function Sidebar({
  groups,
  frameworks,
}: {
  groups: readonly NavGroup[]
  frameworks: readonly SidebarFramework[]
}) {
  const path = usePathname()
  // the framework the docs are read for: a released one, remembered (framework.ts)
  const [picked, pick] = useFramework("react")
  const current =
    frameworks.find((f) => f.id === picked && f.ready) ?? frameworks.find((f) => f.ready)
  // the component pages the chosen framework has not got yet (React has them all)
  const missing = (slug: string, group: string) =>
    group === "Components" &&
    current !== undefined &&
    current.id !== "react" &&
    !current.components.includes(slug)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  // On a phone the nav is a menu that opens over the page; on wider screens it is always open.
  const [wide, setWide] = useState(true)
  const [menu, setMenu] = useState(false)
  // the HTML renders it open (a wide screen's nav is there before scripts); a phone keeps it
  // shut by CSS until this has run, so a slow load never shows the menu open (sidebar.module.css)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const mq = matchMedia("(min-width: 861px)")
    const sync = () => setWide(mq.matches)
    sync()
    setReady(true)
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: closing on navigation is the point
  useEffect(() => setMenu(false), [path])

  return (
    <aside className={styles.side} aria-label="Documentation" data-ready={ready ? "" : undefined}>
      <Collapsible.Root open={wide || menu} onOpenChange={setMenu} closedContent="hidden">
        {/* "Pages", not "Menu": the bar's own Menu (nav-menu.tsx) is the site's */}
        <Collapsible.Trigger className={styles.menuButton}>
          Pages
          <Collapsible.Indicator className={styles.menuIcon}>+</Collapsible.Indicator>
        </Collapsible.Trigger>
        <Collapsible.Content className={styles.menuContent}>
          <div className={styles.frameworks}>
            <p className={styles.label}>Framework</p>
            <ToggleGroup.Root
              className={styles.fwList}
              aria-label="Framework"
              // the unreleased ones stay reachable by keyboard, so their state is heard
              focusableWhenDisabled
              disallowEmptySelection
              value={current ? [current.id] : []}
              onValueChange={(v) => {
                const next = v[0]
                if (next) pick(next)
              }}
            >
              {frameworks.map((f) => (
                <ToggleGroup.Item key={f.id} className={styles.fw} value={f.id} disabled={!f.ready}>
                  {f.name}
                  {/* how far along an unreleased one is, in its name (no tooltip to find) */}
                  {!f.ready && (
                    <small>
                      {stateWord({ name: f.name, ready: f.ready, count: f.components.length })}
                      <span className={styles.visuallyHidden}>
                        {f.components.length
                          ? `, ${f.components.length} component${f.components.length > 1 ? "s" : ""} so far`
                          : ", planned"}
                      </span>
                    </small>
                  )}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
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
                        <li key={slug} data-missing={missing(slug, g.title) ? "" : undefined}>
                          <Link
                            prefetch={false}
                            href={href}
                            aria-current={path === href ? "page" : undefined}
                          >
                            {label}
                            {missing(slug, g.title) ? (
                              <small className={styles.notYet}>not in {current?.name} yet</small>
                            ) : null}
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
