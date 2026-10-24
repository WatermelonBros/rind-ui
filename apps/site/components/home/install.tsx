"use client"

import { Clipboard, ToggleGroup } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { stateWord, upcoming } from "@/lib/framework-status"
import { Letters } from "../letters"
import { cue, panOf } from "../sound"
import { LOGOS } from "./framework-logos"
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
  /** its released version */
  readonly version: string
}

/** A cable from the core to one socket, in the stage's own pixels. */
interface Cable {
  readonly id: string
  readonly d: string
}

/** Where an element sits inside the stage, before any transform (the lean) or page zoom. */
function within(el: HTMLElement, stage: HTMLElement) {
  let x = 0
  let y = 0
  for (let n: HTMLElement | null = el; n && n !== stage; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft
    y += n.offsetTop
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight }
}

/**
 * Copying the command is the page's goal reached, so it is celebrated: the terminal jumps, a
 * burst of colour opens from the button and confetti flies out of it and falls (Web Animations,
 * one layer removed when they land). Motion allowed only; the sound plays either way.
 */
function celebrate(from: Element, terminal: HTMLElement | null) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
  terminal?.animate(
    [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(-28px) scale(1.04)", offset: 0.3 },
      { transform: "translateY(6px) scale(0.99)", offset: 0.6 },
      { transform: "translateY(0) scale(1)" },
    ],
    { duration: 650, easing: "cubic-bezier(.2,.9,.3,1.2)" },
  )
  const r = from.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const css = getComputedStyle(document.documentElement)
  const colors = ["--acc", "--soft", "--ink", "--acc-deep"]
    .map((v) => css.getPropertyValue(v).trim())
    .filter(Boolean)
    .concat(["#ff5d78", "#ffd23f", "#ffffff"])
  const layer = document.createElement("div")
  layer.setAttribute("aria-hidden", "true")
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden"
  // the burst: a disc of the accent, opening from the button and fading as it goes
  const burst = document.createElement("i")
  burst.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:40px;height:40px;margin:-20px;border-radius:50%;background:radial-gradient(circle, ${colors[0]} 0 40%, transparent 70%)`
  layer.append(burst)
  burst.animate(
    [
      { transform: "scale(0)", opacity: 0.9 },
      { transform: "scale(36)", opacity: 0 },
    ],
    { duration: 900, easing: "cubic-bezier(.1,.7,.3,1)", fill: "forwards" },
  )
  // the burst from the button, and two cannons firing in from the screen's bottom corners
  const vw = window.innerWidth
  const vh = window.innerHeight
  const sources = [
    { x, y, aim: -Math.PI / 2, spread: Math.PI * 1.6, count: 140, speed: [220, 640] },
    { x: 0, y: vh, aim: -Math.PI / 3, spread: 0.5, count: 80, speed: [700, 1300] },
    { x: vw, y: vh, aim: (-2 * Math.PI) / 3, spread: 0.5, count: 80, speed: [700, 1300] },
  ] as const
  let k = 0
  for (const src of sources) {
    for (let i = 0; i < src.count; i++, k++) {
      const bit = document.createElement("i")
      const w = 6 + Math.random() * 8
      const round = Math.random() < 0.3
      bit.style.cssText = `position:absolute;left:${src.x}px;top:${src.y}px;width:${w}px;height:${round ? w : w * 0.45}px;border-radius:${round ? "50%" : "2px"};background:${colors[k % colors.length]}`
      layer.append(bit)
      // out along its source's aim, then down under gravity, tumbling
      const a = src.aim + (Math.random() - 0.5) * src.spread
      const v = src.speed[0] + Math.random() * (src.speed[1] - src.speed[0])
      const dx = Math.cos(a) * v
      const dy = Math.sin(a) * v
      const fall = 500 + Math.random() * 500
      const spin = (Math.random() - 0.5) * 1440
      bit.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${dx}px,${dy}px) rotate(${spin / 2}deg)`,
            opacity: 1,
            offset: 0.35,
          },
          { transform: `translate(${dx * 1.3}px,${dy + fall}px) rotate(${spin}deg)`, opacity: 0 },
        ],
        {
          duration: 1600 + Math.random() * 1000,
          easing: "cubic-bezier(.15,.6,.4,1)",
          fill: "forwards",
        },
      )
    }
  }
  document.body.append(layer)
  window.setTimeout(() => layer.remove(), 2800)
}

/**
 * The frameworks arrive: a convoy flies in from the left of the screen, React at its head and
 * the others in its wake, swings up over the stage and drops, one after another, each into its
 * own socket with a slam (a squash, a puff of dust, the stage shaken, a "bam"). `landed` hears
 * each one as it hits, `done` the last. Returns the timers to clear if the page leaves first.
 */
function assemble(
  stage: HTMLElement,
  landed: (id: string) => void,
  done: () => void,
): readonly number[] {
  const slots = [...stage.querySelectorAll<HTMLElement>("[data-socket]")]
  const FLY = 1250
  const GAP = 190
  const HIT = 0.78
  cue("whoosh")
  stage.removeAttribute("data-await")
  return slots.flatMap((socket, i) => {
    const slot = socket.parentElement
    if (!slot) return []
    const r = slot.getBoundingClientRect()
    // all from one point off the screen's left edge, so the convoy is a line: React first and in
    // front, each after it a little smaller and behind (they peel off to their sockets from there)
    const fromX = -260 - r.left
    const fromY = -180 - (r.top - stage.getBoundingClientRect().top)
    const size = 1.25 - i * 0.07
    slot.style.zIndex = String(slots.length - i)
    slot.style.transformOrigin = "50% 100%"
    slot.animate(
      [
        {
          transform: `translate(${fromX}px, ${fromY}px) rotate(-26deg) scale(${size})`,
          easing: "cubic-bezier(.12,.62,.32,1)",
        },
        // hanging over its socket for a breath, then dropping like a weight
        {
          transform: `translate(${-24 + i * 6}px, -250px) rotate(9deg) scale(1.08)`,
          offset: 0.56,
          easing: "cubic-bezier(.55,0,.95,.45)",
        },
        { transform: "translate(0, 0) scale(1.24, 0.72)", offset: HIT, easing: "ease-out" },
        { transform: "translate(0, -20px) scale(0.93, 1.09)", offset: 0.9, easing: "ease-in-out" },
        { transform: "none" },
      ],
      { duration: FLY, delay: i * GAP, fill: "backwards" },
    )
    const last = i === slots.length - 1
    return [
      window.setTimeout(
        () => {
          cue("slam", { pan: panOf(slot), value: i / Math.max(1, slots.length - 1) })
          landed(socket.dataset["socket"] ?? "")
          // each hit harder than the last
          const d = 4 + i * 2
          stage.animate(
            [
              { translate: "0 0" },
              { translate: `${i % 2 ? -d / 2 : d / 2}px ${d}px` },
              { translate: `0 ${-d / 2}px` },
              { translate: "0 0" },
            ],
            { duration: 260, easing: "ease-out" },
          )
          puff(slot)
          if (last) done()
        },
        i * GAP + FLY * HIT,
      ),
    ]
  })
}

/** A ring of dust and a few crumbs, kicked up where a socket lands. */
function puff(slot: HTMLElement) {
  const ring = document.createElement("i")
  ring.className = styles.dust ?? ""
  ring.setAttribute("aria-hidden", "true")
  slot.append(ring)
  ring
    .animate(
      [
        { transform: "translateX(-50%) scale(0.3, 0.3)", opacity: 0.85 },
        { transform: "translateX(-50%) scale(2.4, 1)", opacity: 0 },
      ],
      { duration: 620, easing: "cubic-bezier(.1,.7,.3,1)" },
    )
    .finished.then(
      () => ring.remove(),
      () => ring.remove(),
    )
  for (let k = 0; k < 8; k++) {
    const bit = document.createElement("i")
    bit.className = styles.crumb ?? ""
    bit.setAttribute("aria-hidden", "true")
    slot.append(bit)
    const side = k % 2 ? 1 : -1
    const dx = side * (40 + Math.random() * 90)
    const up = 30 + Math.random() * 70
    bit
      .animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.6}px, ${-up}px) scale(0.9)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${dx}px, 6px) scale(0.4)`, opacity: 0 },
        ],
        { duration: 560 + Math.random() * 200, easing: "cubic-bezier(.2,.6,.4,1)" },
      )
      .finished.then(
        () => bit.remove(),
        () => bit.remove(),
      )
  }
}

/** Each package manager's own way of adding a package. */
const ADD = { npm: "npm i", pnpm: "pnpm add", yarn: "yarn add", bun: "bun add" } as const
type PackageManager = keyof typeof ADD

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
  // the visitor's package manager, remembered (per viewer: browser storage, when it is allowed)
  const [pm, setPm] = useState<PackageManager>("npm")
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rind-pm")
      if (saved && saved in ADD) setPm(saved as PackageManager) // checked against ADD's keys
    } catch {}
  }, [])
  const pickPm = (next: PackageManager) => {
    setPm(next)
    try {
      localStorage.setItem("rind-pm", next)
    } catch {}
  }
  const command = `${ADD[pm]} ${chosen?.pkg ?? "@rind-ui/react"}`
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
        curve: true,
        // the PASS stays readable: the ticks leave it as copies
        keep: true,
        // not before the PASS has been read: the tests' band is mostly gone when they set off
        startAt: 0.55,
      }),
    [],
  )

  // the sockets lean towards the pointer, a little: the rig has depth (desktop, motion allowed)
  const rig = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const terminal = useRef<HTMLDivElement>(null)
  const copyButton = useRef<HTMLButtonElement>(null)
  const [cheer, setCheer] = useState(0)
  // the cables follow the layout (an arc on a desktop, two rows on a phone): measured, redrawn
  // whenever the stage changes size
  const [cables, setCables] = useState<readonly Cable[]>([])
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const draw = () => {
      const core = el.querySelector<HTMLElement>("[data-core]")
      if (!core) return
      const c = within(core, el)
      const cx = c.x + c.w / 2
      const cy = c.y + c.h / 2
      setCables(
        [...el.querySelectorAll<HTMLElement>("[data-socket]")].map((s) => {
          const r = within(s, el)
          const tx = r.x + r.w / 2
          // into the socket's top edge, or its bottom when it sits above the core
          const ty = r.y > cy ? r.y : r.y + r.h
          const my = (cy + ty) / 2
          return {
            id: s.dataset["socket"] ?? "",
            d: `M${cx} ${cy} C${cx} ${my} ${tx} ${my} ${tx} ${ty}`,
          }
        }),
      )
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(el)
    document.fonts?.ready.then(draw)
    return () => ro.disconnect()
  }, [])
  // the sockets the frameworks have landed in, while they arrive (null: all of them, as the page
  // is drawn: no motion, no observer, or the stage already on screen)
  const [plugged, setPlugged] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    const el = stage.current
    if (!el || typeof IntersectionObserver === "undefined") return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // reloaded with the stage already in view or passed: it stays as it is
    if (el.getBoundingClientRect().top < window.innerHeight) return
    el.toggleAttribute("data-await", true)
    setPlugged(new Set())
    let timers: readonly number[] = []
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        timers = assemble(
          el,
          (id) => setPlugged((p) => new Set(p).add(id)),
          () => {
            setPlugged(null)
            setCheer((n) => n + 1)
          },
        )
      },
      // the whole row of sockets on screen, so every landing is seen, not under the fold
      { threshold: 1 },
    )
    io.observe(el.querySelector("ul") ?? el)
    return () => {
      io.disconnect()
      for (const t of timers) clearTimeout(t)
      el.removeAttribute("data-await")
    }
  }, [])
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
            {soon.length > 0 ? `${upcoming(soon)}, all on the same core.` : ""}
          </p>
        </Reveal>
        <div
          ref={rig}
          className={styles.rig}
          style={{ "--brand": LOGOS[pick]?.color ?? "var(--acc)" } as CSSProperties}
        >
          <div ref={stage} className={styles.stage}>
            {/* live cables carry a pulse in their framework's colour; the waiting ones are dashed */}
            <svg className={styles.cables} aria-hidden="true">
              {cables.map((c) => {
                const f = frameworks.find((x) => x.id === c.id)
                return (
                  <g
                    key={c.id}
                    data-ready={f?.ready ? "" : undefined}
                    data-picked={pick === c.id ? "" : undefined}
                    data-plugged={!plugged || plugged.has(c.id) ? "" : undefined}
                    style={{ "--brand": LOGOS[c.id]?.color } as CSSProperties}
                  >
                    <path className={styles.cable} d={c.d} pathLength={100} />
                    {f?.ready && <path className={styles.gloss} d={c.d} pathLength={100} />}
                    {f?.ready && <path className={styles.pulse} d={c.d} pathLength={100} />}
                  </g>
                )
              })}
            </svg>
            {/* flashes with every copy (data-cheer flips, restarting its animation) */}
            <div
              className={styles.core}
              data-core=""
              aria-hidden="true"
              data-cheer={cheer ? cheer % 2 : undefined}
            >
              <b>rind</b>
              <small>core</small>
            </div>
            <ul className={styles.sockets} aria-label="Frameworks">
              {frameworks.map((f, i) => {
                const logo = LOGOS[f.id]
                const mark = (
                  <span className={styles.logo} aria-hidden="true">
                    {logo ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d={logo.path} />
                      </svg>
                    ) : (
                      f.name[0]
                    )}
                  </span>
                )
                return (
                  <li
                    key={f.id}
                    className={styles.socketSlot}
                    style={
                      {
                        "--i": i,
                        "--n": frameworks.length,
                        "--brand": logo?.color ?? "var(--acc)",
                      } as CSSProperties
                    }
                    data-ready={f.ready ? "" : undefined}
                  >
                    {f.ready ? (
                      <button
                        type="button"
                        className={styles.socket}
                        data-socket={f.id}
                        aria-pressed={pick === f.id}
                        onClick={() => setPick(f.id)}
                      >
                        {mark}
                        {f.name}
                        <small>v{f.version}</small>
                        {/* where a passed test's tick lands (the tests' hand-off above) */}
                        <span className={styles.socketMark} data-proved="" aria-hidden="true">
                          ✓
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.socket}
                        data-socket={f.id}
                        data-soon=""
                        // restarts the shake on every press
                        data-asked={asked?.id === f.id ? asked.n % 2 : undefined}
                        onClick={() => {
                          setAsked((a) => ({ id: f.id, n: (a?.n ?? 0) + 1 }))
                          cue("off")
                        }}
                      >
                        {mark}
                        {f.name}
                        <small>{stateWord(f)}</small>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
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
          ref={terminal}
          onCopy={() => {
            cue("unlock")
            setCheer((n) => n + 1)
            if (copyButton.current) celebrate(copyButton.current, terminal.current)
          }}
        >
          <div className={styles.terminalBar}>
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <ToggleGroup.Root
              className={styles.pms}
              aria-label="Package manager"
              disallowEmptySelection
              value={[pm]}
              onValueChange={(v) => {
                const next = v[0]
                if (next && next in ADD) pickPm(next as PackageManager) // one of ADD's keys
              }}
            >
              {Object.keys(ADD).map((id) => (
                <ToggleGroup.Item key={id} value={id} className={styles.pm}>
                  {id}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>
          <div className={styles.terminalLine}>
            <code key={command} className={styles.command}>
              <span className={styles.prompt} aria-hidden="true">
                ${" "}
              </span>
              {command}
            </code>
            {/* its own sound (the unlock cue above), not every button's press */}
            <Clipboard.Trigger ref={copyButton} className={styles.copy} data-sound-own="">
              <Clipboard.Indicator copied="Copied">Copy</Clipboard.Indicator>
            </Clipboard.Trigger>
          </div>
        </Clipboard.Root>
      </section>
    </div>
  )
}
