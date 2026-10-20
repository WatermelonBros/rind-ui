"use client"

import { Button, Kbd, useKeyShortcuts } from "@rind-ui/react"
import type { Variants } from "./types"

/** Inline layout: theme pages do not load the site's helper classes. */
const ROW = { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" } as const
const LIST = {
  display: "grid",
  gridTemplateColumns: "max-content max-content",
  gap: "10px 24px",
  alignItems: "center",
  margin: 0,
} as const

const SHORTCUTS = [
  { action: "Command palette", keys: "mod+k" },
  { action: "Save", keys: "mod+s" },
  { action: "Find in files", keys: "mod+shift+f" },
  { action: "Go to inbox", keys: "g i" },
  { action: "Close", keys: "escape" },
]

export function Shortcuts() {
  return (
    <dl style={LIST}>
      {SHORTCUTS.map((s) => (
        <div key={s.action} style={{ display: "contents" }}>
          <dt>{s.action}</dt>
          <dd style={{ margin: 0 }}>
            <Kbd.Root keys={s.keys} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Platforms() {
  return (
    <div style={ROW}>
      <span>
        Apple: <Kbd.Root keys="mod+shift+p" platform="apple" />
      </span>
      <span>
        Elsewhere: <Kbd.Root keys="mod+shift+p" platform="other" />
      </span>
    </div>
  )
}

export function ButtonHint() {
  // The same keys name the shortcut on the button (aria-keyshortcuts) and show it.
  const shortcut = useKeyShortcuts("mod+k")
  return (
    <Button aria-keyshortcuts={shortcut}>
      Search <Kbd.Root keys="mod+k" />
    </Button>
  )
}

export function AsText() {
  return (
    <p style={{ margin: 0 }}>
      Press <Kbd.Root>Esc</Kbd.Root> to close the dialog.
    </p>
  )
}

export const variants: Variants = {
  Shortcuts: {
    title: "Shortcuts",
    description:
      "`keys` resolved for your platform: ⌘ and glyphs on Apple, Ctrl and + elsewhere; `g i` is a sequence.",
  },
  Platforms: {
    title: "Platforms",
    description:
      '`platform` overrides the detected one. Screen readers hear "Command plus Shift plus P".',
  },
  ButtonHint: {
    title: "On a button",
    description: "`useKeyShortcuts()` gives the button its `aria-keyshortcuts` from the same keys.",
  },
  AsText: { title: "As text", description: "Children render as written, in one cap." },
}
