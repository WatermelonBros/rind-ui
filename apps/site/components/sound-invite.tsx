"use client"

import { Button } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import { useSound } from "./sound"
import styles from "./sound.module.css"
import { SoundBars } from "./sound-bars"

const SHOW_AFTER_MS = 900
const LEAVE_AFTER_MS = 9000

/**
 * The landing asks once, as the intro ends: this page has sound. Whatever the answer (or none,
 * after a while or once the visitor scrolls on), the invite flies up into the nav and becomes
 * the sound toggle there, so the way back to it is seen being made. Not a dialog: it takes no
 * focus and blocks nothing.
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

  const leave = (on: boolean | null) => {
    if (done.current) return
    done.current = true
    if (on !== null) setEnabled(on)
    const el = box.current
    const to = document.querySelector("[data-sound-toggle]")?.getBoundingClientRect()
    if (!el || !to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false)
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
      setOpen(false)
      // the toggle takes the hand-over with a little bounce
      document
        .querySelector("[data-sound-toggle]")
        ?.animate([{ scale: 1 }, { scale: 1.18 }, { scale: 1 }], {
          duration: 360,
          easing: "ease-out",
        })
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: leave only reads refs and setters
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => leave(null), LEAVE_AFTER_MS)
    const onScroll = () => {
      if (window.scrollY > 300) leave(null)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("scroll", onScroll)
    }
  }, [open])

  if (!open) return null
  return (
    <aside ref={box} className={styles.invite} aria-label="Sound">
      <SoundBars idle />
      <p>This page has sound.</p>
      <Button className={styles.inviteOn} onPress={() => leave(true)}>
        Turn it on
      </Button>
      <Button className={styles.inviteOff} onPress={() => leave(false)}>
        Not now
      </Button>
    </aside>
  )
}
