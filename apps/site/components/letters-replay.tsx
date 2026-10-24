"use client"

import { useEffect } from "react"

/**
 * Plays the living titles (letters.tsx): when the phase changes, once its wave has passed
 * (phase.tsx sets html[data-letters]: inside the wave the letters would be hidden behind its
 * front), once as each comes into view, and again every five to ten seconds for the titles on
 * screen while the page is still, so a visitor who never touches the switch sees them come alive.
 * Never under reduced motion, never in a hidden tab.
 */
export function LettersReplay() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const root = document.documentElement
    // never while the page is moving: a title swelling under a scroll reads as a glitch
    let scrolledAt = 0
    const onScroll = () => {
      scrolledAt = performance.now()
    }
    const flip = (el: HTMLElement) => {
      // two names for one animation: each flip restarts it
      el.dataset["play"] = el.dataset["play"] === "a" ? "b" : "a"
    }
    const visible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
    }
    const play = () => {
      // not under the landing's intro, where nobody sees the page yet
      if (document.hidden || root.classList.contains("intro")) return
      for (const el of document.querySelectorAll<HTMLElement>("[data-letters-title]"))
        if (visible(el)) flip(el)
    }
    // a title plays once as it comes into view (and again when a new one replaces it)
    const seen = new WeakSet<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || seen.has(e.target)) continue
          seen.add(e.target)
          if (e.target instanceof HTMLElement) flip(e.target)
        }
      },
      { threshold: 0.6 },
    )
    // new titles (a route change, the machine's next act): looked for once a frame at most, the
    // landing's streams and tests change the DOM constantly
    let looking = 0
    const watch = () => {
      looking = 0
      for (const el of document.querySelectorAll("[data-letters-title]")) io.observe(el)
    }
    watch()
    const added = new MutationObserver(() => {
      if (!looking) looking = requestAnimationFrame(watch)
    })
    added.observe(document.body, { childList: true, subtree: true })
    const phase = new MutationObserver(play)
    phase.observe(root, { attributes: true, attributeFilter: ["data-letters"] })
    let timer = 0
    const next = () => {
      timer = window.setTimeout(
        () => {
          if (performance.now() - scrolledAt > 1500) play()
          next()
        },
        5000 + Math.random() * 5000,
      )
    }
    next()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      io.disconnect()
      added.disconnect()
      cancelAnimationFrame(looking)
      phase.disconnect()
      clearTimeout(timer)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])
  return null
}
