"use client"

import { Button } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import { useSound } from "./sound"
import styles from "./sound.module.css"
import { zoom } from "./zoom"

const SHOW_AFTER_MS = 1600
const LEAVE_AFTER_MS = 5000

/**
 * The landing asks once, as the intro ends: this page has sound. The question hangs under the
 * nav's sound toggle, pointing at it, so the answer and the way back to it are one thing on
 * screen (a bar at the foot of the screen competed with the hero and the screen-reader toggle).
 * Whatever the answer (or none, after a while or once the visitor scrolls on), it folds up into
 * the toggle. Not a dialog: it takes no focus and blocks nothing.
 */
export function SoundInvite() {
  const { setEnabled } = useSound()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLElement>(null)
  const done = useRef(false)

  useEffect(() => {
    // after the intro (html.intro goes once the styled page is revealed)
    let shown = 0
    const wait = window.setInterval(() => {
      if (document.documentElement.classList.contains("intro")) return
      clearInterval(wait)
      shown = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    }, 200)
    return () => {
      clearInterval(wait)
      clearTimeout(shown)
    }
  }, [])

  const leave = (on: boolean | null, quick = false) => {
    if (done.current) return
    done.current = true
    if (on !== null) setEnabled(on)
    const el = box.current
    const to = document.querySelector("[data-sound-toggle]")?.getBoundingClientRect()
    const handOver = () => setOpen(false)
    if (!el || !to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      handOver()
      return
    }
    // scrolled away from: it just goes, at once, rather than fold across the moving page
    if (quick) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: "forwards" }).onfinish =
        handOver
      return
    }
    // into the toggle: shrinking to its size and place, fading as it arrives
    const from = el.getBoundingClientRect()
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const k = to.height / from.height
    el.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${dx * 0.4}px, ${dy * 0.55}px) scale(${0.6 + k * 0.4})`,
          opacity: 1,
          offset: 0.6,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0 },
      ],
      { duration: 650, easing: "cubic-bezier(0.6, 0, 0.3, 1)", fill: "forwards" },
    ).onfinish = () => {
      handOver()
      // the toggle takes the hand-over with a little bounce
      document
        .querySelector("[data-sound-toggle]")
        ?.animate([{ scale: 1 }, { scale: 1.18 }, { scale: 1 }], {
          duration: 360,
          easing: "ease-out",
        })
    }
  }

  // hung under the toggle, its point on the toggle's middle
  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = box.current
      const to = document.querySelector("[data-sound-toggle]")?.getBoundingClientRect()
      if (!el || !to) return
      const z = zoom()
      el.style.setProperty("--invite-top", `${(to.bottom + 14) / z}px`)
      el.style.setProperty("--invite-end", `${Math.max(16, window.innerWidth - to.right) / z}px`)
      el.style.setProperty("--invite-point", `${to.width / 2 / z}px`)
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [open])

  // biome-ignore lint/correctness/useExhaustiveDependencies: leave only reads refs and setters
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => leave(null), LEAVE_AFTER_MS)
    const onScroll = () => {
      // at once, before the wordmark scrolls up under it
      if (window.scrollY > 24) leave(null, true)
    }
    const onMenu = () => leave(null, true)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("rind:menu-open", onMenu)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("rind:menu-open", onMenu)
    }
  }, [open])

  if (!open) return null
  return (
    <aside ref={box} className={styles.invite} aria-label="Sound">
      <p>
        <span className={styles.long}>This page has sound.</span>
        <span className={styles.short}>Sound?</span>
      </p>
      <Button className={styles.inviteOn} onPress={() => leave(true)}>
        Turn it on
      </Button>
      <Button className={styles.inviteOff} onPress={() => leave(false)}>
        Not now
      </Button>
    </aside>
  )
}
