"use client"

import { Clipboard } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { Letters } from "../letters"
import { cue } from "../sound"
import { handoff } from "./handoff"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

/** A framework as the build found it (lib/frameworks.ts), without its component list. */
export interface InstallFramework {
  readonly id: string
  readonly name: string
  readonly pkg: string
  readonly ready: boolean
  /** components its package has so far (an unreleased one may be under way) */
  readonly count: number
}

// a mark per framework, drawn in type: the site never borrows their logos
const GLYPH: Record<string, string> = {
  react: "⚛",
  vue: "V",
  svelte: "S",
  solid: "◆",
  angular: "A",
}

const list = (names: readonly string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`

/**
 * The install: one core, a socket per framework around it. The frameworks rind has released are
 * lit, wired to the core and pickable; the others wait, dim, for their package to land (read
 * from the packages at build time, so the page lights a socket the day it ships). The command
 * types itself in a terminal and copies with rind's own Clipboard.
 */
export function Install({ frameworks }: { readonly frameworks: readonly InstallFramework[] }) {
  const ready = frameworks.filter((f) => f.ready)
  const soon = frameworks.filter((f) => !f.ready)
  const [pick, setPick] = useState(ready[0]?.id ?? "react")
  const chosen = frameworks.find((f) => f.id === pick) ?? ready[0]
  const command = `npm i ${chosen?.pkg ?? "@rind-ui/react"}`
  // a socket still waiting answers a press: it shakes its head and says how far along it is
  const [asked, setAsked] = useState<{ id: string; n: number } | null>(null)
  const status = (f: InstallFramework) =>
    f.count > 0
      ? `${f.name} is under way: ${f.count} component${f.count > 1 ? "s" : ""} so far, not released yet.`
      : `${f.name} is planned, on the same core.`

  // the tests above end on PASS: as their band lets go, the pass splits into ticks that fall
  // down the margin onto the lit sockets, what was tested is what installs (desktop only)
  useEffect(
    () =>
      handoff({
        scene: () => document.getElementById("tested-title")?.closest("[data-band]") ?? null,
        from: () => {
          const pass = document.querySelector("[data-pass-mark]")
          const lit = document.querySelectorAll("[data-proved]").length
          return pass ? Array.from({ length: Math.max(1, lit) }, () => pass) : []
        },
        to: () => [...document.querySelectorAll("[data-proved]")],
        make: () => {
          const t = document.createElement("span")
          t.className = styles.tickTraveller ?? ""
          t.textContent = "✓"
          return t
        },
        landed: (mark, on) => mark.toggleAttribute("data-landed", on),
        lane: () => {
          const r = document.querySelector("[data-proved]")?.getBoundingClientRect()
          return r ? r.left + r.width / 2 : 80
        },
      }),
    [],
  )

  // the sockets lean towards the pointer, a little: the rig has depth (desktop, motion allowed)
  const rig = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rig.current
    if (
      !el ||
      !matchMedia("(min-width: 761px) and (prefers-reduced-motion: no-preference)").matches
    )
      return
    const move = (e: PointerEvent) => {
      // still while over a socket: leaning would turn it out from under the pointer mid-press
      if (e.target instanceof Element && e.target.closest("button")) return
      const r = el.getBoundingClientRect()
      el.style.setProperty("--lean-x", String((e.clientX - r.left) / r.width - 0.5))
      el.style.setProperty("--lean-y", String((e.clientY - r.top) / r.height - 0.5))
    }
    const rest = () => {
      el.style.setProperty("--lean-x", "0")
      el.style.setProperty("--lean-y", "0")
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerleave", rest)
    return () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerleave", rest)
    }
  }, [])

  return (
    <div className={styles.band} data-band="paper">
      <section className={styles.section} aria-labelledby="install-title">
        <Reveal>
          <h2 id="install-title" className={styles.h2}>
            <Letters>One install. Your stack.</Letters>
          </h2>
          <p className={styles.lead}>
            {list(ready.map((f) => f.name))} today.{" "}
            {soon.length > 0
              ? `${list(soon.map((f) => f.name))} on the same core, as they land.`
              : ""}
          </p>
        </Reveal>
        <div ref={rig} className={styles.rig}>
          <div className={styles.core} aria-hidden="true">
            <b>rind</b>
            <small>core</small>
          </div>
          <ul
            className={styles.sockets}
            aria-label="Frameworks"
            data-lit-left={frameworks.slice(0, 3).some((f) => f.ready) ? "" : undefined}
          >
            {frameworks.map((f, i) => (
              <li
                key={f.id}
                className={styles.socketSlot}
                style={{ "--i": i, "--n": frameworks.length } as CSSProperties}
                data-ready={f.ready ? "" : undefined}
              >
                {f.ready ? (
                  <button
                    type="button"
                    className={styles.socket}
                    aria-pressed={pick === f.id}
                    onClick={() => setPick(f.id)}
                  >
                    <span className={styles.glyph} aria-hidden="true">
                      {GLYPH[f.id] ?? f.name[0]}
                    </span>
                    {f.name}
                    {/* where a passed test's tick lands (the tests' hand-off above) */}
                    <span className={styles.socketMark} data-proved="" aria-hidden="true">
                      ✓
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.socket}
                    data-soon=""
                    // restarts the shake on every press
                    data-asked={asked?.id === f.id ? asked.n % 2 : undefined}
                    onClick={() => {
                      setAsked((a) => ({ id: f.id, n: (a?.n ?? 0) + 1 }))
                      cue("off")
                    }}
                  >
                    <span className={styles.glyph} aria-hidden="true">
                      {GLYPH[f.id] ?? f.name[0]}
                    </span>
                    {f.name}
                    <small>{f.count > 0 ? "in progress" : "soon"}</small>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className={styles.socketSays} role="status">
            {(() => {
              const f = frameworks.find((x) => x.id === asked?.id)
              return f ? status(f) : ""
            })()}
          </p>
        </div>
        <Clipboard.Root
          className={styles.terminal}
          value={command}
          messages={{ copy: "Copy the install command" }}
          onCopy={() => cue("pass")}
        >
          <div className={styles.terminalBar} aria-hidden="true">
            <i />
            <i />
            <i />
            <span>terminal</span>
          </div>
          <div className={styles.terminalLine}>
            <code key={command} className={styles.command}>
              <span className={styles.prompt} aria-hidden="true">
                ${" "}
              </span>
              {command}
            </code>
            <Clipboard.Trigger className={styles.copy}>
              <Clipboard.Indicator copied="Copied">Copy</Clipboard.Indicator>
            </Clipboard.Trigger>
          </div>
        </Clipboard.Root>
      </section>
    </div>
  )
}
