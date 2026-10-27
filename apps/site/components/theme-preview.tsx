"use client"

import { SegmentedControl } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import styles from "./example-frame.module.css"

const ACCENTS = {
  preset: "",
  green: "#0a7d55",
  violet: "oklch(0.55 0.2 290)",
  pink: "oklch(0.62 0.21 355)",
} as const
type Accent = keyof typeof ACCENTS

/**
 * The theme page's preview: /theme/preview/ (rind components styled by @rind-ui/theme alone) in
 * a frame of its own, so neither stylesheet reaches the other. The controls re-skin the
 * frame's document in place, as an app would: no reload, no flash.
 */
export function ThemePreview() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [preset, setPreset] = useState<"calm" | "crisp">("calm")
  const [scheme, setScheme] = useState<"light" | "dark">("light")
  const [accent, setAccent] = useState<Accent>("preset")
  const [height, setHeight] = useState(560)
  // the frame's loaded document (not its first about:blank); it can finish loading before this
  // page hydrates, and then its load event is gone
  const [doc, setDoc] = useState<Document | null>(null)
  const loaded = () => {
    const d = frame.current?.contentDocument
    if (d && d.readyState === "complete" && d.location.href !== "about:blank") setDoc(d)
  }
  useEffect(loaded, [])

  useEffect(() => {
    if (!doc) return
    doc.documentElement.dataset["rindTheme"] = preset
    doc.documentElement.dataset["theme"] = scheme
    // a live scope: no built stylesheet, so its tokens derive from the brand input it sets (in a
    // rule, not inline, so the portalled popups that copy the attribute take it too)
    const root = doc.querySelector<HTMLElement>("[data-preview-root]")
    let rule = doc.getElementById("preview-accent")
    if (!rule) {
      rule = doc.createElement("style")
      rule.id = "preview-accent"
      doc.head.append(rule)
    }
    rule.textContent = `[data-rind-theme="live"]{--rind-brand-accent:${ACCENTS[accent]}}`
    if (accent === "preset") delete root?.dataset["rindTheme"]
    else if (root) root.dataset["rindTheme"] = "live"
  }, [doc, preset, scheme, accent])

  // the frame is as tall as the screen inside it, so the page scrolls, not the frame
  useEffect(() => {
    const body = doc?.body
    if (!body) return
    const sizes = new ResizeObserver(() => setHeight(Math.ceil(body.scrollHeight)))
    sizes.observe(body)
    return () => sizes.disconnect()
  }, [doc])

  const control = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    set: (v: T) => void,
  ) => (
    <SegmentedControl.Root
      className={styles.views}
      aria-label={label}
      value={value}
      onValueChange={(v) => {
        const picked = options.find((o) => o === v)
        if (picked) set(picked)
      }}
    >
      {options.map((o) => (
        <SegmentedControl.Item key={o} className={styles.view} value={o}>
          {o}
        </SegmentedControl.Item>
      ))}
      <SegmentedControl.Indicator className={styles.viewIndicator} />
    </SegmentedControl.Root>
  )

  return (
    <section className={styles.frame} aria-label="Theme preview">
      <div className={styles.bar}>
        {control("Preset", preset, ["calm", "crisp"] as const, setPreset)}
        {control("Scheme", scheme, ["light", "dark"] as const, setScheme)}
        {control("Accent", accent, ["preset", "green", "violet", "pink"] as const, setAccent)}
      </div>
      <iframe
        ref={frame}
        src="/theme/preview/"
        title="Settings screen styled by @rind-ui/theme"
        onLoad={loaded}
        style={{ display: "block", inlineSize: "100%", blockSize: height, border: 0 }}
      />
    </section>
  )
}
