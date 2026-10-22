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
// sound is synthesised here, so there is nothing to download. Crisp is a hard tick, juicy a
// soft pop; a component turning on sounds higher than one turning off; a slider sings its
// value as it moves; a change of phase is a sweep, a passing test a small chord. Each voice is
// layered (a transient, a tone, a body), placed left or right where the component is, and
// sent into a short room, so it has depth rather than beeping. Only what the visitor does
// makes a sound (plus the explicit cues): the page's own demos stay quiet.

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

/** Where an element is across the screen, as a stereo position (kept off the hard edges). */
const panOf = (el: Element | null) => {
  if (!el) return 0
  const r = el.getBoundingClientRect()
  return Math.max(-1, Math.min(1, ((r.left + r.width / 2) / innerWidth) * 2 - 1)) * 0.6
}

/** The output: a compressor, and a short room (a decaying noise impulse) on a send. */
function engine(ac: AudioContext) {
  const master = ac.createDynamicsCompressor()
  master.threshold.value = -18
  master.ratio.value = 4
  master.connect(ac.destination)
  const room = ac.createConvolver()
  const length = Math.ceil(ac.sampleRate * 1.1)
  const impulse = ac.createBuffer(2, length, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch)
    for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
  }
  room.buffer = impulse
  const wet = ac.createGain()
  room.connect(wet).connect(master)
  return { master, room, wet }
}
type Engine = ReturnType<typeof engine>

function voice(ac: AudioContext, out: Engine, pan: number) {
  const now = ac.currentTime
  const bus = ac.createGain()
  const panner = ac.createStereoPanner()
  panner.pan.value = pan
  bus.connect(panner)
  panner.connect(out.master)
  panner.connect(out.room)
  out.wet.gain.value = juicy() ? 0.32 : 0.14
  const tone = (
    type: OscillatorType,
    from: number,
    to: number,
    at: number,
    length: number,
    level: number,
    filter?: { type: BiquadFilterType; frequency: number },
  ) => {
    const osc = ac.createOscillator()
    const env = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, now + at)
    osc.frequency.exponentialRampToValueAtTime(to, now + at + length)
    env.gain.setValueAtTime(0.0001, now + at)
    env.gain.exponentialRampToValueAtTime(level, now + at + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + length)
    let node: AudioNode = osc
    if (filter) {
      const f = ac.createBiquadFilter()
      f.type = filter.type
      f.frequency.value = filter.frequency
      node = osc.connect(f)
    }
    node.connect(env).connect(bus)
    osc.start(now + at)
    osc.stop(now + at + length + 0.03)
  }
  const noise = (length: number, level: number, filter: BiquadFilterType, frequency: number) => {
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    const f = ac.createBiquadFilter()
    f.type = filter
    f.frequency.value = frequency
    const env = ac.createGain()
    env.gain.setValueAtTime(level, now)
    env.gain.exponentialRampToValueAtTime(0.0001, now + length)
    src.connect(f).connect(env).connect(bus)
    src.start(now)
    return f
  }
  return { now, tone, noise }
}

function play(ac: AudioContext, out: Engine, name: Cue, pan = 0) {
  const { now, tone, noise } = voice(ac, out, pan)
  const up = name === "on" ? 1.26 : 1
  if (name === "on" || name === "off") {
    if (juicy()) {
      // a pop: a falling sine, its octave for colour, and a soft thump under it
      tone("sine", 560 * up, 190 * up, 0, 0.15, 0.26)
      tone("triangle", 1120 * up, 420 * up, 0, 0.07, 0.06)
      tone("sine", 95, 50, 0, 0.14, 0.2)
    } else {
      // a tick: a click of noise, a filtered square, and a short wooden body
      noise(0.008, 0.25, "highpass", 3800)
      tone("square", 2300 * up, 1500 * up, 0, 0.03, 0.05, { type: "lowpass", frequency: 6000 })
      tone("sine", 210 * up, 160 * up, 0, 0.05, 0.14)
    }
    return
  }
  if (name === "pass") {
    const notes = juicy() ? [660, 880, 1100] : [880, 1320]
    notes.forEach((f, i) => {
      tone(juicy() ? "sine" : "triangle", f, f * 0.995, i * 0.08, 0.6, 0.1)
    })
    return
  }
  // the phase: a band of noise swept up into juicy, down into crisp, with a low tone under it
  const band = noise(0.7, 0.2, "bandpass", 1000)
  band.Q.value = 1.6
  const [a, b] = juicy() ? [300, 2800] : [2800, 300]
  band.frequency.setValueAtTime(a, now)
  band.frequency.exponentialRampToValueAtTime(b, now + 0.7)
  tone("sine", juicy() ? 110 : 160, juicy() ? 220 : 80, 0, 0.5, 0.12)
}

/** A slider's step: its pitch is its value, and it slides the way the value went. */
function step(ac: AudioContext, out: Engine, fraction: number, rising: boolean, pan: number) {
  const { tone } = voice(ac, out, pan)
  const base = juicy() ? 300 : 420
  const f = base * 2 ** (fraction * 2)
  const from = rising ? f * 0.94 : f * 1.06
  if (juicy()) tone("sine", from, f, 0, 0.06, 0.14)
  else tone("square", from, f, 0, 0.022, 0.035, { type: "lowpass", frequency: 4000 })
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setOn] = useState(false)
  const ac = useRef<{ context: AudioContext; out: Engine } | null>(null)

  const setEnabled = useCallback((on: boolean) => {
    // created inside the press that turns it on: browsers only let a gesture start audio
    if (on && !ac.current) {
      const context = new AudioContext()
      ac.current = { context, out: engine(context) }
    }
    if (on) void ac.current?.context.resume()
    setOn(on)
    if (on && ac.current) play(ac.current.context, ac.current.out, "on")
  }, [])

  useEffect(() => {
    const audio = ac.current
    if (!enabled || !audio) return
    const { context, out } = audio
    // only what the visitor does: their last press, key or drag, within the moment
    let input = 0
    const touched = () => {
      input = performance.now()
    }
    const byVisitor = () => performance.now() - input < 1200
    const onClick = (e: MouseEvent) => {
      // the tests' own presses are scripted clicks: only the visitor's are heard
      if (!e.isTrusted) return
      const target = e.target instanceof Element ? e.target.closest("[data-scope]") : null
      if (!target || target.closest("[data-sound-toggle], [role=slider], [data-scope=slider]"))
        return
      // after the click, so the state it lands in is read
      setTimeout(() => {
        const stateful = target.closest(
          "[aria-checked], [aria-pressed], [aria-expanded], [data-state]",
        )
        const value =
          stateful?.getAttribute("aria-checked") ??
          stateful?.getAttribute("aria-pressed") ??
          stateful?.getAttribute("aria-expanded") ??
          stateful?.getAttribute("data-state")
        const on = value === "true" || value === "checked" || value === "on" || value === "open"
        play(context, out, on ? "on" : "off", panOf(target))
      })
    }
    // a slider's every step, as it moves (at most one every 30 ms)
    const last = new WeakMap<Element, number>()
    let lastStep = 0
    const values = new MutationObserver((records) => {
      if (!byVisitor()) return
      for (const r of records) {
        const el = r.target as Element
        const now = Number(el.getAttribute("aria-valuenow"))
        const before = last.get(el)
        last.set(el, now)
        if (before === undefined || before === now || performance.now() - lastStep < 30) continue
        lastStep = performance.now()
        const min = Number(el.getAttribute("aria-valuemin") ?? 0)
        const max = Number(el.getAttribute("aria-valuemax") ?? 100)
        const fraction = max > min ? (now - min) / (max - min) : 0.5
        step(context, out, Math.min(1, Math.max(0, fraction)), now > before, panOf(el))
      }
    })
    for (const el of document.querySelectorAll("[aria-valuenow]"))
      last.set(el, Number(el.getAttribute("aria-valuenow")))
    values.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-valuenow"],
    })
    const phase = new MutationObserver(() => play(context, out, "phase"))
    phase.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phase"] })
    const onCue = (e: Event) => {
      const name = (e as CustomEvent<Cue>).detail
      if (name) play(context, out, name)
    }
    const drag = (e: PointerEvent) => {
      if (e.buttons) touched()
    }
    window.addEventListener("pointerdown", touched, true)
    window.addEventListener("pointermove", drag, true)
    window.addEventListener("keydown", touched, true)
    document.addEventListener("click", onClick, true)
    window.addEventListener("rind:cue", onCue)
    return () => {
      window.removeEventListener("pointerdown", touched, true)
      window.removeEventListener("pointermove", drag, true)
      window.removeEventListener("keydown", touched, true)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("rind:cue", onCue)
      values.disconnect()
      phase.disconnect()
    }
  }, [enabled])

  return <SoundContext.Provider value={{ enabled, setEnabled }}>{children}</SoundContext.Provider>
}
