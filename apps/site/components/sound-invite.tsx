"use client"

import { useEffect, useRef } from "react"
import { useSound } from "./sound"

/** Asked once the visitor has done something (a press, a key), or after a while on the hero:
 *  never before the page has been seen. */
const SHOW_AFTER_ACT_MS = 900
const SHOW_IDLE_MS = 9000
/** How long the toggle asks before it settles back to itself. */
const ASK_MS = 7000

/**
 * The landing says once that it has sound, with the sound toggle itself: for a few seconds it
 * pulses, its bars ripple and its word asks "sound on?" (nav.module.css: html[data-sound-ask]).
 * Nothing opens over the bar or the page; pressing the toggle is the answer. Not when the sound
 * is on already, and gone as soon as the page scrolls on or the menu opens.
 */
export function SoundInvite() {
  const { enabled } = useSound()
  // turned on already (the nav's toggle): nothing to ask
  const on = useRef(enabled)
  on.current = enabled

  useEffect(() => {
    const root = document.documentElement
    let shown = 0
    let done = 0
    const stop = () => {
      root.removeAttribute("data-sound-ask")
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("rind:menu-open", stop)
    }
    const onScroll = () => {
      if (window.scrollY > 24) stop()
    }
    const ask = (ms: number) => {
      clearTimeout(shown)
      shown = window.setTimeout(() => {
        if (on.current || window.scrollY > 24) return
        root.setAttribute("data-sound-ask", "")
        window.addEventListener("scroll", onScroll, { passive: true })
        window.addEventListener("rind:menu-open", stop)
        done = window.setTimeout(stop, ASK_MS)
      }, ms)
    }
    const acted = (e: Event) => {
      // the sound's own toggle answers the question itself
      if (e.target instanceof Element && e.target.closest("[data-sound-toggle]")) return
      off()
      ask(SHOW_AFTER_ACT_MS)
    }
    const off = () => {
      window.removeEventListener("pointerdown", acted, true)
      window.removeEventListener("keydown", acted, true)
    }
    // after the intro (html.intro goes once the styled page is revealed)
    const wait = window.setInterval(() => {
      if (root.classList.contains("intro")) return
      clearInterval(wait)
      window.addEventListener("pointerdown", acted, true)
      window.addEventListener("keydown", acted, true)
      ask(SHOW_IDLE_MS)
    }, 200)
    return () => {
      clearInterval(wait)
      clearTimeout(shown)
      clearTimeout(done)
      off()
      stop()
    }
  }, [])

  // the answer: turned on, the question is over
  useEffect(() => {
    if (enabled) document.documentElement.removeAttribute("data-sound-ask")
  }, [enabled])

  return null
}
