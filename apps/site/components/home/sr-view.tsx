"use client"

import { ToggleGroup } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import { useSound } from "../sound"
import { zoom } from "../zoom"
import { buildBuffer, type Item, itemFor, itemIndexOf } from "./sr/buffer"
import { type Move, type Reader, speakItem, speakMove, states } from "./sr/speech"
import styles from "./sr-view.module.css"

/** One element's announcement as NVDA makes it on focus: name, role, states. */
export function utterance(el: HTMLElement): string {
  return speakItem(itemFor(el), "nvda", "focus").join(", ")
}

type Line = { readonly key: string; readonly chunks: readonly string[] }

// the system's speech synthesis, with an English voice (a natural one where the system has it)
let chosen: SpeechSynthesisVoice | null = null
function pickVoice() {
  const voices = speechSynthesis.getVoices()
  chosen =
    voices.find(
      (v) => v.lang === "en-US" && /natural|premium|enhanced|samantha|google/i.test(v.name),
    ) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
}
// kept referenced: Chrome may garbage-collect an utterance mid-queue and then say nothing
let current: SpeechSynthesisUtterance | null = null
/** Told when the system's speech engine never starts (Chrome on macOS can hang until restarted). */
let onStuck: (() => void) | null = null
function speak(text: string) {
  if (!("speechSynthesis" in window)) return
  if (!chosen) pickVoice()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = "en-US"
  u.rate = 1.1
  if (chosen) u.voice = chosen
  u.onerror = (e) => {
    if (e.error !== "interrupted" && e.error !== "canceled")
      console.warn("[rind screen reader simulation] speech failed:", e.error)
  }
  current = u
  let started = false
  u.onstart = () => {
    started = true
  }
  window.setTimeout(() => {
    if (!started && current === u) onStuck?.()
  }, 3000)
  // a new utterance interrupts the last, as a screen reader does. Chrome drops a speak() that
  // follows cancel() in the same task, so it waits a beat after cancelling
  const busy = speechSynthesis.speaking || speechSynthesis.pending
  if (busy) speechSynthesis.cancel()
  const go = () => {
    speechSynthesis.resume()
    if (current === u) speechSynthesis.speak(u)
  }
  if (busy) window.setTimeout(go, 60)
  else go()
}

// browse-mode quick-navigation keys (NVDA's single letter navigation) and what they find
const QUICK: Record<string, { readonly what: string; readonly match: (i: Item) => boolean }> = {
  h: { what: "heading", match: (i) => i.role === "heading" },
  k: { what: "link", match: (i) => i.role === "link" },
  b: { what: "button", match: (i) => i.role === "button" },
  f: {
    what: "form field",
    match: (i) =>
      ["textbox", "searchbox", "combobox", "checkbox", "radio", "switch", "slider"].includes(
        i.role,
      ),
  },
  e: { what: "edit field", match: (i) => i.role === "textbox" || i.role === "searchbox" },
  x: { what: "check box", match: (i) => i.role === "checkbox" },
  r: { what: "radio button", match: (i) => i.role === "radio" },
  g: { what: "graphic", match: (i) => i.role === "img" },
}
const KEY_LABEL: Record<string, string> = {
  ArrowDown: "↓",
  ArrowUp: "↑",
  Tab: "Tab",
  Enter: "Enter",
}

/** Controls that put a screen reader in focus mode: keys go to the control, not to browsing. */
function focusMode(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true
  if (el instanceof HTMLInputElement)
    return !["checkbox", "radio", "button", "submit", "reset"].includes(el.type)
  const role = el.getAttribute("role")
  return role === "slider" || role === "combobox" || role === "listbox" || role === "spinbutton"
}

/**
 * The landing's screen reader simulation, opt in. It does what NVDA does in browse mode, from
 * the page's real accessibility semantics: Down/Up read line by line, H, K, B, F, E, X, R, G (and
 * D for landmarks) jump, Tab moves focus, Enter or Space activates. Its output follows NVDA's
 * recorded speech in W3C ARIA-AT (with a VoiceOver variant) and shows as a transcript, the way
 * NVDA's Speech Viewer does; a voice is optional. It is a simulation for sighted visitors, not a
 * screen reader: it never starts on its own and does not try to detect one.
 */
export function ScreenReaderView() {
  const [on, setOn] = useState(false)
  const [reader, setReader] = useState<Reader>("nvda")
  // the voice is the site's sound (sound.tsx): one setting, here or in the nav
  const { enabled: voice, setEnabled: setVoice } = useSound()
  const [lines, setLines] = useState<readonly Line[]>([])
  const [box, setBox] = useState<DOMRect | null>(null)
  const readerRef = useRef(reader)
  readerRef.current = reader
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  // touch screens have no keys: Previous / Next stand in for a screen reader's swipe
  const step = useRef<(dir: 1 | -1) => void>(() => {})

  useEffect(() => {
    if (!on) return
    let items: Item[] = []
    let built = 0
    let cursor = -1
    let lastStates: string[] = []
    let quiet = false
    const fresh = () => {
      // the page changes as it is used: rebuild the buffer at most every half second
      if (performance.now() - built > 500) {
        items = buildBuffer(document.body, (el) => el.closest("[data-sr-view]") !== null)
        built = performance.now()
      }
      return items
    }
    const say = (key: string, chunks: readonly string[]) => {
      const clean = chunks.filter(Boolean)
      if (!clean.length) return
      setLines((all) => [...all.slice(-11), { key, chunks: clean }])
      if (voiceRef.current) speak(clean.join(", "))
    }
    // the highlight tracks its element for a moment after a move (smooth scrolling, layout)
    let tracking = 0
    const mark = (item: Item | undefined) => {
      cancelAnimationFrame(tracking)
      if (!item) return setBox(null)
      const until = performance.now() + 900
      const step = () => {
        setBox(item.el.getBoundingClientRect())
        if (performance.now() < until) tracking = requestAnimationFrame(step)
      }
      step()
    }
    // brought into the clear part of the screen, above the transcript panel
    const clearOf = (el: Element) => {
      const r = el.getBoundingClientRect()
      const clear = window.innerHeight * (window.matchMedia("(hover: none)").matches ? 0.3 : 0.38)
      if (r.top < 80 || r.bottom > window.innerHeight * 0.6)
        window.scrollTo({ top: window.scrollY + r.top - clear, behavior: "smooth" })
    }
    const go = (to: number, key: string, move: Move) => {
      const all = fresh()
      const prev = all[cursor] ?? null
      const next = all[to]
      if (!next) return
      cursor = to
      lastStates = states(next, readerRef.current)
      say(key, speakMove(prev, next, readerRef.current, move))
      clearOf(next.el)
      // as in NVDA, focus follows the browse cursor onto focusable elements, so Tab goes on
      // from here (and that focus is not announced a second time)
      if (next.el.tabIndex >= 0 && next.role !== "text" && next.role !== "heading") {
        quiet = true
        next.el.focus({ preventScroll: true })
        quiet = false
      }
      mark(next)
    }
    // start where the visitor is: the first item in view
    const start = () => {
      const all = fresh()
      const i = all.findIndex((it) => it.el.getBoundingClientRect().bottom > 80)
      cursor = Math.max(0, i) - 1
      const touch = window.matchMedia("(hover: none)").matches
      setLines([
        {
          key: "",
          chunks: [
            touch
              ? "Simulation on. Next reads on, Previous goes back."
              : "Simulation on. Down arrow reads on, H jumps by heading, Tab moves focus.",
          ],
        },
      ])
    }
    start()

    step.current = (dir) => {
      const all = fresh()
      const to = cursor + dir
      if (to < 0 || to >= all.length)
        return say(dir > 0 ? "Next" : "Prev", [to < 0 ? "top" : "bottom"])
      go(to, dir > 0 ? "Next" : "Prev", "arrow")
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof Element && target.closest("[data-sr-view]")) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (focusMode(document.activeElement)) {
        if (e.key === "Escape") {
          ;(document.activeElement as HTMLElement).blur()
          say("Esc", ["browse mode"])
        }
        return
      }
      const all = fresh()
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const to = cursor + (e.key === "ArrowDown" ? 1 : -1)
        if (to < 0 || to >= all.length)
          return say(KEY_LABEL[e.key] ?? e.key, [to < 0 ? "top" : "bottom"])
        return go(to, KEY_LABEL[e.key] ?? e.key, "arrow")
      }
      if ((e.key === "Enter" || e.key === " ") && all[cursor]) {
        const item = all[cursor]
        if (
          item &&
          item.role !== "text" &&
          item.role !== "heading" &&
          document.activeElement !== item.el
        ) {
          e.preventDefault()
          item.el.focus({ preventScroll: true })
          item.el.click()
        }
        return
      }
      const k = e.key.toLowerCase()
      const label = e.shiftKey ? `Shift+${e.key.toUpperCase()}` : e.key.toUpperCase()
      const back = e.shiftKey
      const find = (match: (i: Item) => boolean) => {
        if (back) {
          for (let i = cursor - 1; i >= 0; i--) if (all[i] && match(all[i] as Item)) return i
        } else
          for (let i = cursor + 1; i < all.length; i++)
            if (all[i] && match(all[i] as Item)) return i
        return -1
      }
      const quick = QUICK[k]
      if (quick || /^[1-6]$/.test(k) || k === "d") {
        e.preventDefault()
        let match: (i: Item) => boolean
        let what: string
        if (quick) {
          match = quick.match
          what = quick.what
        } else if (k === "d") {
          what = "landmark"
          const here =
            all[cursor]?.path.filter(
              (c) => !["list", "group", "radiogroup", "tablist"].includes(c.kind),
            ) ?? []
          match = (i) => {
            const marks = i.path.filter(
              (c) => !["list", "group", "radiogroup", "tablist"].includes(c.kind),
            )
            return marks.length > 0 && marks.at(-1)?.el !== here.at(-1)?.el
          }
        } else {
          what = `heading at level ${k}`
          match = (i) =>
            i.role === "heading" &&
            (i.el.getAttribute("aria-level") ?? /^h([1-6])$/i.exec(i.el.tagName)?.[1]) === k
        }
        const i = find(match)
        if (i < 0) return say(label, [`no ${back ? "previous" : "next"} ${what}`])
        return go(i, label, "jump")
      }
    }
    // Tab (or a click) moves focus: the focused element is announced, the cursor follows it
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (quiet || el.closest("[data-sr-view]")) return
      built = 0
      const all = fresh()
      const i = itemIndexOf(all, el)
      const item = i >= 0 ? all[i] : itemFor(el)
      const prev = all[cursor] ?? null
      if (i >= 0) cursor = i
      if (!item) return
      lastStates = states(item, readerRef.current)
      const chunks = speakMove(prev, item, readerRef.current, "focus")
      if (focusMode(el)) chunks.push("focus mode")
      say("Tab", chunks)
      mark(item)
      // Tab's own scroll stops at the screen's edge, under the transcript panel
      clearOf(el)
    }
    // a control's state changes (a switch turned on, a section opened): only the new state is said
    const watch = new MutationObserver((records) => {
      const subject = items[cursor]
      if (!subject) return
      // only the element being read: other parts of the page change state on their own
      if (!records.some((r) => r.target === subject.el || subject.el.contains(r.target))) return
      const now = states(subject, readerRef.current)
      const changed = now.filter((s) => !lastStates.includes(s))
      lastStates = now
      if (changed.length) say("", changed)
    })
    watch.observe(document.body, {
      subtree: true,
      attributeFilter: [
        "aria-checked",
        "aria-pressed",
        "aria-expanded",
        "aria-selected",
        "aria-valuetext",
        "aria-valuenow",
      ],
    })
    // live regions (rind's announcer included): what they announce is said; alerts say so first
    // once per region per change, and only what is new in it: one update arrives as several
    // records (the PASS was said seven times)
    const heard = new WeakMap<Element, string>()
    const live = new MutationObserver((records) => {
      const regions = new Set<Element>()
      for (const r of records) {
        const region = (r.target instanceof Element ? r.target : r.target.parentElement)?.closest(
          "[aria-live]:not([aria-live='off']), [role='status'], [role='alert']",
        )
        if (region && !region.closest("[data-sr-view]")) regions.add(region)
      }
      for (const region of regions) {
        const text = region.textContent?.trim() ?? ""
        // emptied, it may say the same again later (a second run's PASS)
        if (!text) heard.delete(region)
        if (!text || heard.get(region) === text) continue
        heard.set(region, text)
        const alert = region.getAttribute("role") === "alert"
        say("", alert && readerRef.current === "nvda" ? ["alert", text] : [text])
      }
    })
    live.observe(document.body, { subtree: true, childList: true, characterData: true })
    // the highlight follows the cursor's element as the page scrolls
    let frame = 0
    const follow = () => {
      frame = 0
      const item = items[cursor]
      if (item) setBox(item.el.getBoundingClientRect())
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(follow)
    }
    document.addEventListener("keydown", onKey, true)
    document.addEventListener("focusin", onFocus)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("focusin", onFocus)
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(tracking)
      watch.disconnect()
      live.disconnect()
      if ("speechSynthesis" in window) speechSynthesis.cancel()
      setBox(null)
      setLines([])
    }
  }, [on])

  useEffect(() => {
    if (!voice && "speechSynthesis" in window) speechSynthesis.cancel()
    if (!voice) return
    onStuck = () =>
      setLines((all) => [
        ...all.slice(-11),
        {
          key: "",
          chunks: [
            "(no sound: the browser's speech engine is not responding; restarting the browser usually fixes it)",
          ],
        },
      ])
    return () => {
      onStuck = null
    }
  }, [voice])

  // while the page scrolls, the toggle steps aside so it never sits on what is being read; it
  // comes back once scrolling stops (and whenever it has focus: see the CSS)
  const [scrolling, setScrolling] = useState(false)
  useEffect(() => {
    let rest = 0
    const onScroll = () => {
      setScrolling(true)
      clearTimeout(rest)
      rest = window.setTimeout(() => setScrolling(false), 700)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      clearTimeout(rest)
    }
  }, [])

  // it waits out the hero, where the sound question and the object already ask for attention;
  // on a phone it then lives only in the footer: anywhere between, the narrow column puts it on
  // top of body copy
  const [away, setAway] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)")
    const hero = document.querySelector("main section, main > div")
    const foot = document.querySelector("footer")
    if (!hero || typeof IntersectionObserver === "undefined") return
    const seen = new Map<Element, boolean>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting)
      setAway(Boolean(seen.get(hero)) || (mq.matches && !(foot && seen.get(foot))))
    })
    io.observe(hero)
    if (foot) io.observe(foot)
    return () => io.disconnect()
  }, [])
  // it also stays aside while the tests are on screen: there it would sit on the PASS bar
  const [overTests, setOverTests] = useState(false)
  useEffect(() => {
    const tests = document.querySelector('section[aria-labelledby="tested-title"]')
    if (!tests || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => setOverTests(entries.some((e) => e.isIntersecting)),
      { threshold: 0.3 },
    )
    io.observe(tests)
    return () => io.disconnect()
  }, [])

  return (
    <div
      className={styles.view}
      data-sr-view=""
      data-on={on ? "" : undefined}
      data-scrolling={(scrolling || overTests || away) && !on ? "" : undefined}
    >
      {box ? (
        <span
          className={styles.cursor}
          aria-hidden="true"
          // the read element's rect, in the zoomed page's pixels (zoom.ts)
          style={{
            top: (box.top - 4) / zoom(),
            left: (box.left - 4) / zoom(),
            width: (box.width + 8) / zoom(),
            height: (box.height + 8) / zoom(),
          }}
        />
      ) : null}
      {on ? (
        <section className={styles.panel} aria-label="Screen reader simulation">
          <header className={styles.panelBar}>
            <span className={styles.badge}>Simulated</span>
            <ToggleGroup.Root
              className={styles.readers}
              aria-label="Screen reader"
              value={[reader]}
              onValueChange={(v) => {
                const next = v[0]
                if (next === "nvda" || next === "voiceover") setReader(next)
              }}
            >
              <ToggleGroup.Item value="nvda">NVDA + Chrome</ToggleGroup.Item>
              <ToggleGroup.Item value="voiceover">VoiceOver + Safari</ToggleGroup.Item>
            </ToggleGroup.Root>
            <ToggleGroup.Item
              className={styles.voice}
              pressed={voice}
              onPressedChange={(next) => {
                setVoice(next)
                // said inside the click: Safari only lets a page speak from a user gesture first
                if (next) speak("Voice on")
              }}
            >
              {voice ? "Voice on" : "Voice off"}
            </ToggleGroup.Item>
          </header>
          {/* the transcript repeats speech for sighted visitors; a real screen reader reads the
              page itself, so it is hidden from assistive technology */}
          <ol className={styles.lines} aria-hidden="true">
            {lines.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
              <li key={i} data-last={i === lines.length - 1 ? "" : undefined}>
                {l.key ? <kbd>{l.key}</kbd> : <span className={styles.nokey} />}
                <span className={styles.chunks}>
                  {l.chunks.map((c, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: chunks of one utterance
                    <span key={j}>{c}</span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <div className={styles.swipe}>
            <button type="button" onClick={() => step.current(-1)}>
              ← Previous
            </button>
            <button type="button" onClick={() => step.current(1)}>
              Next →
            </button>
          </div>
          <p className={styles.keys}>
            <kbd>↓</kbd> <kbd>↑</kbd> read · <kbd>H</kbd> heading · <kbd>D</kbd> landmark ·{" "}
            <kbd>K</kbd> link · <kbd>B</kbd> button · <kbd>F</kbd> field · <kbd>Tab</kbd> focus ·{" "}
            <kbd>Enter</kbd> use. Based on recorded output in{" "}
            <a href="https://aria-at.w3.org" target="_blank" rel="noreferrer">
              W3C ARIA-AT
            </a>
            ; real screen readers vary with settings.
          </p>
        </section>
      ) : null}
      <ToggleGroup.Item className={styles.toggle} pressed={on} onPressedChange={setOn}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <path
            d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span className={styles.label}>Simulate a screen reader</span>
      </ToggleGroup.Item>
    </div>
  )
}
