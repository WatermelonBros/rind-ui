"use client"

import { Clipboard } from "@rind-ui/react"
import { useEffect, useState } from "react"
import styles from "./copy-markdown.module.css"

/**
 * A docs page as markdown, for pasting into an assistant: rind's own Clipboard copies the page's
 * markdown twin (scripts/content.ts), fetched once the page is up; a link opens it.
 */
export function CopyMarkdown({ slug }: { slug: string }) {
  const [markdown, setMarkdown] = useState("")
  useEffect(() => {
    let live = true
    fetch(`/docs/${slug}.md`)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        if (live) setMarkdown(text)
      })
      // no twin (offline, a failed fetch): the button stays disabled, the link still works
      .catch(() => {})
    return () => {
      live = false
    }
  }, [slug])
  return (
    <div className={styles.row}>
      <Clipboard.Root value={markdown} disabled={!markdown}>
        {/* the Trigger is named "Copy" + this label: "Copy as markdown", as it reads */}
        <Clipboard.Label className={styles.hidden}>as markdown</Clipboard.Label>
        <Clipboard.Trigger className={styles.button}>
          <Clipboard.Indicator copied="Copied" failed="Copy failed">
            Copy as markdown
          </Clipboard.Indicator>
        </Clipboard.Trigger>
      </Clipboard.Root>
      <a className={styles.link} href={`/docs/${slug}.md`}>
        View .md
      </a>
    </div>
  )
}
