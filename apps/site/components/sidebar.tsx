"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import styles from "./sidebar.module.css"

type Entry = { readonly slug: string; readonly title: string }

export function Sidebar({
  nav,
}: {
  nav: { components: readonly Entry[]; guides: readonly Entry[] }
}) {
  const path = usePathname()
  const group = (label: string, entries: readonly Entry[]) => (
    <div className={styles.group}>
      <p className={styles.label}>{label}</p>
      <ul>
        {entries.map(({ slug, title }) => {
          const href = `/docs/${slug}/`
          return (
            <li key={slug}>
              <Link href={href} aria-current={path === href ? "page" : undefined}>
                {title}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
  return (
    <aside className={styles.side} aria-label="Documentation">
      <Link
        href="/docs/"
        className={styles.overview}
        aria-current={path === "/docs/" ? "page" : undefined}
      >
        Overview
      </Link>
      {group("Components", nav.components)}
      {group("Guides", nav.guides)}
    </aside>
  )
}
