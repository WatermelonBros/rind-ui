"use client"

import { ToggleGroup } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import styles from "./sr-view.module.css"

const INTRO =
  "Screen reader view on. Press Tab to move through the page, Space or Enter to use a control."

/** The text an element's ids point at, joined. */
function byIds(el: Element, attr: string): string {
  return (el.getAttribute(attr) ?? "")
    .split(/\s+/)
    .map((id) => (id ? (el.ownerDocument.getElementById(id)?.textContent?.trim() ?? "") : ""))
    .filter(Boolean)
    .join(" ")
}

/** A short accessible name: aria-label, aria-labelledby, a <label>, else the text. */
function nameOf(el: HTMLElement): string {
  const label = el.getAttribute("aria-label")?.trim()
  if (label) return label
  const labelled = byIds(el, "aria-labelledby")
  if (labelled) return labelled
  const labels = (el as HTMLInputElement).labels
  const fromLabel = labels ? [...labels].map((l) => l.textContent?.trim() ?? "").join(" ") : ""
  if (fromLabel.trim()) return fromLabel.trim()
  if (el instanceof HTMLInputElement) return el.placeholder || el.value
  // decorative arrows and symbols are not read
  return (el.textContent ?? "")
    .replace(/[→←↗↘✓×+▾▸]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

/** The role as a screen reader says it: explicit, else the element's implicit one. */
function roleOf(el: HTMLElement): string {
  const explicit = el.getAttribute("role")
  if (explicit) return explicit === "textbox" ? "edit text" : explicit
  const tag = el.tagName.toLowerCase()
  if (tag === "a" && el.hasAttribute("href")) return "link"
  if (tag === "button") return el.hasAttribute("aria-pressed") ? "toggle button" : "button"
  if (/^h[1-6]$/.test(tag)) return `heading level ${tag[1]}`
  if (tag === "input") {
    const type = (el as HTMLInputElement).type
    if (type === "checkbox") return "checkbox"
    if (type === "radio") return "radio button"
    if (type === "range") return "slider"
    return "edit text"
  }
  if (tag === "textarea") return "edit text"
  return ""
}

/** The states worth hearing, in the order a screen reader reads them. */
function statesOf(el: HTMLElement): string[] {
  const out: string[] = []
  const a = (n: string) => el.getAttribute(n)
  const checked =
    a("aria-checked") ??
    (el instanceof HTMLInputElement && el.type === "checkbox" ? String(el.checked) : null)
  if (checked === "true") out.push(roleOf(el) === "switch" ? "on" : "checked")
  else if (checked === "false") out.push(roleOf(el) === "switch" ? "off" : "not checked")
  else if (checked === "mixed") out.push("half checked")
  if (a("aria-pressed") === "true") out.push("pressed")
  else if (a("aria-pressed") === "false") out.push("not pressed")
  if (a("aria-expanded") === "true") out.push("expanded")
  else if (a("aria-expanded") === "false") out.push("collapsed")
  if (a("aria-selected") === "true") out.push("selected")
  const value = a("aria-valuetext") ?? a("aria-valuenow")
  if (value) out.push(value)
  if (a("aria-disabled") === "true" || (el as HTMLButtonElement).disabled) out.push("dimmed")
  return out
}

/** What a screen reader would say on reaching `el`: name, role, states. */
export function utterance(el: HTMLElement): string {
  return [nameOf(el), roleOf(el), ...statesOf(el)].filter(Boolean).join(", ")
}

/**
 * The landing's screen-reader view, opt in: a toggle turns on a voice (the system's speech
 * synthesis) and captions that say what a screen reader would say as focus moves and states
 * change, plus the page's polite and assertive announcements. It is a demonstration, not a
 * screen reader: it reads the same names, roles and states rind puts in the DOM.
 */
export function ScreenReaderView() {
  const [on, setOn] = useState(false)
  const [caption, setCaption] = useState("")
  const [supported, setSupported] = useState(false)
  const voice = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (!("speechSynthesis" in window)) return
    setSupported(true)
    const choose = () => {
      const voices = speechSynthesis.getVoices()
      voice.current =
        voices.find(
          (v) => v.lang === "en-US" && /natural|premium|enhanced|samantha|google/i.test(v.name),
        ) ??
        voices.find((v) => v.lang.startsWith("en")) ??
        null
    }
    choose()
    speechSynthesis.addEventListener("voiceschanged", choose)
    return () => speechSynthesis.removeEventListener("voiceschanged", choose)
  }, [])

  useEffect(() => {
    if (!on) return
    const say = (text: string) => {
      if (!text) return
      setCaption(text)
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "en-US"
      u.rate = 1.05
      if (voice.current) u.voice = voice.current
      speechSynthesis.speak(u)
    }
    say(INTRO)
    let focused: HTMLElement | null = null
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (el.closest("[data-sr-view]")) return
      focused = el
      say(utterance(el))
    }
    // a state change on the focused control is read again (a switch turned on, a section opened)
    const states = new MutationObserver((records) => {
      if (focused && records.some((r) => r.target === focused)) say(statesOf(focused).join(", "))
    })
    states.observe(document.body, {
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
    // the page's live regions (rind's announcer included): what they announce is read
    const live = new MutationObserver((records) => {
      for (const r of records) {
        const region = (r.target instanceof Element ? r.target : r.target.parentElement)?.closest(
          "[aria-live]:not([aria-live='off']), [role='status'], [role='alert']",
        )
        if (region && !region.closest("[data-sr-view]")) say(region.textContent?.trim() ?? "")
      }
    })
    live.observe(document.body, { subtree: true, childList: true, characterData: true })
    document.addEventListener("focusin", onFocus)
    return () => {
      document.removeEventListener("focusin", onFocus)
      states.disconnect()
      live.disconnect()
      speechSynthesis.cancel()
      setCaption("")
    }
  }, [on])

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

  // it also stays aside while the tests are on screen: there it would sit on the PASS bar
  const [overTests, setOverTests] = useState(false)
  useEffect(() => {
    const tests = document.querySelector('section[aria-labelledby="tested-title"]')
    if (!tests || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => setOverTests(entries.some((e) => e.isIntersecting)),
      {
        threshold: 0.3,
      },
    )
    io.observe(tests)
    return () => io.disconnect()
  }, [])

  if (!supported) return null
  return (
    <div
      className={styles.view}
      data-sr-view=""
      data-on={on ? "" : undefined}
      data-scrolling={(scrolling || overTests) && !on ? "" : undefined}
    >
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
        <span className={styles.label}>Screen reader view</span>
      </ToggleGroup.Item>
      {/* the captions repeat what the voice says: sighted readers see it, assistive technology
          already hears the page itself, so they are hidden from it */}
      {on ? (
        <p className={styles.caption} aria-hidden="true">
          <span className={styles.badge}>Screen reader</span>
          <span className={styles.text}>{caption}</span>
        </p>
      ) : null}
    </div>
  )
}
