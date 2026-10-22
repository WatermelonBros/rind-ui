"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

// The site's sound, off until the visitor turns it on (nav.tsx) and never remembered: every
// sound is synthesised here, so there is nothing to download. Crisp ticks, juicy pops; a
// component turning on sounds higher than one turning off; a change of phase is a sweep, a
// passing test two notes.

type Cue = "on" | "off" | "phase" | "pass"

interface SoundValue {
  readonly enabled: boolean
  readonly setEnabled: (on: boolean) => void
}

const SoundContext = createContext<SoundValue | null>(null)

export function useSound(): SoundValue {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error("useSound must be used inside <SoundProvider>")
  return ctx
}

/** Ask for a cue from anywhere (a passing test, say) without importing the provider. */
export const cue = (name: Cue) =>
  window.dispatchEvent(new CustomEvent("rind:cue", { detail: name }))

const juicy = () => document.documentElement.dataset["phase"] === "juicy"

function play(ac: AudioContext, name: Cue) {
  const now = ac.currentTime
  const out = ac.createGain()
  out.connect(ac.destination)
  const tone = (
    type: OscillatorType,
    from: number,
    to: number,
    at: number,
    length: number,
    level: number,
  ) => {
    const osc = ac.createOscillator()
    const env = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, now + at)
    osc.frequency.exponentialRampToValueAtTime(to, now + at + length)
    env.gain.setValueAtTime(0.0001, now + at)
    env.gain.exponentialRampToValueAtTime(level, now + at + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + length)
    osc.connect(env).connect(out)
    osc.start(now + at)
    osc.stop(now + at + length + 0.02)
  }
  const up = name === "on" ? 1.25 : 1
  if (name === "on" || name === "off") {
    if (juicy()) tone("sine", 560 * up, 190 * up, 0, 0.13, 0.22)
    else tone("square", 2300 * up, 1500 * up, 0, 0.028, 0.05)
    return
  }
  if (name === "pass") {
    const type = juicy() ? "sine" : "triangle"
    tone(type, 880, 870, 0, 0.35, 0.12)
    tone(type, 1320, 1310, 0.09, 0.45, 0.1)
    return
  }
  // the phase: a band of noise swept up into juicy, down into crisp
  const length = 0.6
  const noise = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = noise
  const band = ac.createBiquadFilter()
  band.type = "bandpass"
  band.Q.value = 1.4
  const [a, b] = juicy() ? [320, 2600] : [2600, 320]
  band.frequency.setValueAtTime(a, now)
  band.frequency.exponentialRampToValueAtTime(b, now + length)
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, now)
  env.gain.exponentialRampToValueAtTime(0.16, now + 0.12)
  env.gain.exponentialRampToValueAtTime(0.0001, now + length)
  src.connect(band).connect(env).connect(out)
  src.start(now)
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setOn] = useState(false)
  const ac = useRef<AudioContext | null>(null)

  const setEnabled = useCallback((on: boolean) => {
    // created inside the press that turns it on: browsers only let a gesture start audio
    if (on && !ac.current) ac.current = new AudioContext()
    if (on) void ac.current?.resume()
    setOn(on)
    if (on && ac.current) play(ac.current, "on")
  }, [])

  useEffect(() => {
    const context = ac.current
    if (!enabled || !context) return
    const say = (name: Cue) => play(context, name)
    // every rind component the visitor works: after the click, so the state it lands in is read
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest("[data-scope]") : null
      if (!target || target.closest("[data-sound-toggle]")) return
      setTimeout(() => {
        const stateful = target.closest(
          "[aria-checked], [aria-pressed], [aria-expanded], [data-state]",
        )
        const value =
          stateful?.getAttribute("aria-checked") ??
          stateful?.getAttribute("aria-pressed") ??
          stateful?.getAttribute("aria-expanded") ??
          stateful?.getAttribute("data-state")
        say(
          value === "true" || value === "checked" || value === "on" || value === "open"
            ? "on"
            : "off",
        )
      })
    }
    const phase = new MutationObserver(() => say("phase"))
    phase.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phase"] })
    const onCue = (e: Event) => {
      const name = (e as CustomEvent<Cue>).detail
      if (name) say(name)
    }
    document.addEventListener("click", onClick, true)
    window.addEventListener("rind:cue", onCue)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("rind:cue", onCue)
      phase.disconnect()
    }
  }, [enabled])

  return <SoundContext.Provider value={{ enabled, setEnabled }}>{children}</SoundContext.Provider>
}
