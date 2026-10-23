"use client"

import { TableOfContents } from "@rind-ui/react"
import styles from "./toc.module.css"

type Entry = { readonly id: string; readonly text: string; readonly code?: string }

/** "On this page": rind-ui's Table of Contents, styled by the site. */
export function Toc({ entries }: { entries: readonly Entry[] }) {
  const items = entries.map((e) => ({ id: e.id, label: e.text, depth: 0 }))
  return (
    <TableOfContents.Root items={items} className={styles.toc}>
      <TableOfContents.Title render={<p />}>On this page</TableOfContents.Title>
      <div className={styles.rail}>
        <TableOfContents.List>
          {items.map((item, i) => {
            // a heading led by a prop or part name keeps it as code, so its lower-case start
            // reads as a name and not as a missing capital
            const code = entries[i]?.code
            return (
              <TableOfContents.Item key={item.id} item={item}>
                <TableOfContents.Link>
                  {code === undefined ? undefined : (
                    <>
                      <code>{code}</code>
                      {item.label.slice(code.length)}
                    </>
                  )}
                </TableOfContents.Link>
              </TableOfContents.Item>
            )
          })}
          <TableOfContents.Indicator className={styles.marker} />
        </TableOfContents.List>
      </div>
    </TableOfContents.Root>
  )
}
