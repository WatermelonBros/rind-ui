"use client"

import { usePathname } from "next/navigation"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { ambient } from "./ambient"

// The site's sound, off until the visitor turns it on (nav.tsx) and never remembered: every
// sound is synthesised here, so there is nothing to download. Crisp is a hard tick, juicy a
// soft pop; a component turning on sounds higher than one turning off; a slider sings its
// value as it moves; a change of phase is a sweep, a passing test a small chord. Each voice is
// layered (a transient, a tone, a body), placed left or right where the component is, and
// sent into a short room, so it has depth rather than beeping. Quiet music plays under it. Only what the visitor does
// makes a sound (plus the explicit cues): the page's own demos stay quiet.

type Cue = "on" | "off" | "phase" | "pass" | "unlock"

interface SoundValue {
  readonly enabled: boolean
  readonly setEnabled: (on: boolean) => void
  /** The sound's level now in `n` bands, low to high, 0 to 1 (all 0 while it is off). */
  readonly levels: (n: number) => number[]
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
  // read by the nav's toggle, whose bars move with what is playing
  const analyser = ac.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.82
  master.connect(analyser)
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
  return { master, room, wet, analyser }
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

// the voices, by what happened: each component kind has its own, in both phases
type Voice =
  | "on"
  | "off"
  | "check"
  | "uncheck"
  | "select"
  | "press"
  | "open"
  | "close"
  | "key"
  | "delete"
  | "note"
  | "appear"

function play(ac: AudioContext, out: Engine, name: Cue | Voice, pan = 0, value = 0.5) {
  const { now, tone, noise } = voice(ac, out, pan)
  const soft = juicy()
  // a little variation every time, so repeated sounds never ring like a machine gun
  const jitter = 1 + (Math.random() - 0.5) * 0.06
  switch (name) {
    case "on":
    case "off": {
      // a switch: crisp ticks, juicy pops; on sounds higher than off
      const up = name === "on" ? 1.26 : 1
      if (soft) {
        tone("sine", 560 * up, 190 * up, 0, 0.15, 0.26)
        tone("triangle", 1120 * up, 420 * up, 0, 0.07, 0.06)
        tone("sine", 95, 50, 0, 0.14, 0.2)
      } else {
        noise(0.008, 0.25, "highpass", 3800)
        tone("square", 2300 * up, 1500 * up, 0, 0.03, 0.05, { type: "lowpass", frequency: 6000 })
        tone("sine", 210 * up, 160 * up, 0, 0.05, 0.14)
      }
      return
    }
    case "check":
    case "uncheck": {
      // a checkbox: a drop of water in juicy (rising when checked), a snappy mark in crisp
      const on = name === "check"
      if (soft) tone("sine", on ? 420 : 1100, on ? 1250 : 380, 0, 0.09, 0.2)
      else {
        noise(0.012, 0.3, "bandpass", on ? 5200 : 3000)
        tone("triangle", on ? 1800 : 1200, on ? 2400 : 900, 0, 0.035, 0.08)
      }
      return
    }
    case "select": {
      // tabs, toggle groups, radios: a detent, two quick clicks of a wheel
      if (soft) {
        tone("sine", 700 * jitter, 900 * jitter, 0, 0.05, 0.14)
        tone("sine", 1050 * jitter, 1250 * jitter, 0.045, 0.06, 0.1)
      } else {
        noise(0.006, 0.22, "highpass", 4500)
        tone("sine", 950 * jitter, 900 * jitter, 0, 0.025, 0.16)
        noise(0.005, 0.14, "highpass", 5500)
        tone("sine", 1400 * jitter, 1300 * jitter, 0.03, 0.02, 0.08)
      }
      return
    }
    case "press": {
      // a button: a dull thock in crisp, a rubbery boing in juicy
      if (soft) {
        tone("sine", 260, 140, 0, 0.18, 0.24)
        tone("sine", 390, 330, 0.02, 0.12, 0.05)
      } else {
        noise(0.01, 0.2, "lowpass", 2400)
        tone("sine", 150 * jitter, 90, 0, 0.09, 0.3)
      }
      return
    }
    case "open":
    case "close": {
      // a disclosure: a short swoosh, up as it opens, down as it closes
      const band = noise(0.22, soft ? 0.14 : 0.1, "bandpass", 1000)
      band.Q.value = 2.2
      const [a, b] = name === "open" ? [500, 2600] : [2600, 500]
      band.frequency.setValueAtTime(a, now)
      band.frequency.exponentialRampToValueAtTime(b, now + 0.22)
      tone(
        soft ? "sine" : "triangle",
        name === "open" ? 330 : 500,
        name === "open" ? 500 : 330,
        0,
        0.12,
        0.06,
      )
      return
    }
    case "key":
    case "delete": {
      // a keyboard: each key its own pitch; a deletion is lower and duller
      const del = name === "delete"
      noise(0.018, soft ? 0.16 : 0.26, "bandpass", (del ? 1600 : 3200) * jitter)
      tone(
        soft ? "sine" : "triangle",
        (del ? 260 : 420) * jitter,
        (del ? 180 : 300) * jitter,
        0,
        0.03,
        soft ? 0.08 : 0.1,
      )
      return
    }
    case "appear": {
      // a tooltip or a hover card comes up: a swish of air swept upwards, with a glassy bubble
      // on it in juicy, a dry tick in crisp
      const swish = noise(0.16, soft ? 0.22 : 0.18, "bandpass", 700)
      swish.Q.value = 1.2
      swish.frequency.setValueAtTime(600 * jitter, now)
      swish.frequency.exponentialRampToValueAtTime(4200 * jitter, now + 0.14)
      if (soft) {
        tone("sine", 900 * jitter, 1500 * jitter, 0.04, 0.12, 0.09)
        tone("sine", 1800 * jitter, 2100 * jitter, 0.07, 0.08, 0.04)
      } else {
        tone("triangle", 2200 * jitter, 2000 * jitter, 0.08, 0.035, 0.06)
      }
      return
    }
    case "note": {
      // a rating: a pentatonic step for each star
      const scale = [0, 2, 4, 7, 9, 12, 14]
      const n = scale[Math.min(scale.length - 1, Math.round(value * (scale.length - 1)))] ?? 0
      const f = (soft ? 523 : 659) * 2 ** (n / 12)
      tone(soft ? "sine" : "triangle", f, f, 0, 0.4, 0.12)
      tone("sine", f * 2, f * 2, 0, 0.15, 0.03)
      return
    }
    case "pass": {
      const notes = soft ? [660, 880, 1100] : [880, 1320]
      notes.forEach((f, k) => {
        tone(soft ? "sine" : "triangle", f, f * 0.995, k * 0.08, 0.6, 0.1)
      })
      return
    }
    case "unlock": {
      // an achievement: a quick rising arpeggio, a held chord over a low thump, then a sparkle
      // of high notes falling into place
      tone("sine", 110, 55, 0, 0.35, 0.18)
      const run = soft ? [523, 659, 784, 1047] : [659, 831, 988, 1319]
      run.forEach((f, k) => {
        tone("triangle", f, f, k * 0.07, 0.35, 0.1)
      })
      for (const f of run.slice(1)) tone("sine", f, f * 1.002, 0.3, 1.1, 0.06)
      ;[2637, 3136, 3520, 4186, 3951].forEach((f, k) => {
        tone("sine", f, f * 0.98, 0.38 + k * 0.06, 0.3, 0.025)
      })
      return
    }
    case "phase": {
      // a band of noise swept up into juicy, down into crisp, with a low tone under it
      const band = noise(0.7, 0.2, "bandpass", 1000)
      band.Q.value = 1.6
      const [a, b] = soft ? [300, 2800] : [2800, 300]
      band.frequency.setValueAtTime(a, now)
      band.frequency.exponentialRampToValueAtTime(b, now + 0.7)
      tone("sine", soft ? 110 : 160, soft ? 220 : 80, 0, 0.5, 0.12)
      return
    }
  }
}

/** Which voice a click on a rind part makes, read after the click from the state it left. */
function voiceFor(part: Element): { name: Voice; value?: number } | null {
  const scope = part.closest("[data-scope]")?.getAttribute("data-scope") ?? ""
  const read = (sel: string, attr: string) => part.closest(sel)?.getAttribute(attr)
  if (scope === "switch")
    return { name: read("[data-state]", "data-state") === "checked" ? "on" : "off" }
  if (scope === "checkbox" || scope === "checkbox-group") {
    const state = read("[aria-checked]", "aria-checked") ?? read("[data-state]", "data-state")
    return {
      name: state === "true" || state === "checked" || state === "mixed" ? "check" : "uncheck",
    }
  }
  if (
    ["tabs", "toggle-group", "segmented-control", "radio-group", "listbox", "select"].includes(
      scope,
    )
  )
    return { name: "select" }
  if (scope === "rating") {
    const now = Number(read("[aria-valuenow]", "aria-valuenow") ?? 0)
    const max = Number(read("[aria-valuemax]", "aria-valuemax") ?? 5)
    return { name: "note", value: max ? now / max : 0.5 }
  }
  const expanded = read("[aria-expanded]", "aria-expanded")
  if (expanded) return { name: expanded === "true" ? "open" : "close" }
  if (scope === "toggle")
    return { name: read("[aria-pressed]", "aria-pressed") === "true" ? "on" : "off" }
  if (scope === "button" || part.closest("button")) return { name: "press" }
  return null
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
  // off until the visitor turns it on, on any page: the docs' live examples answer like the
  // landing's components; the music under it all is the landing's alone (docs are for reading)
  const home = usePathname() === "/"
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
    // the music under it all (ambient.ts), for as long as the sound is on
    const music = home ? ambient(context, out) : null
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
      // sliders sing as they move, text fields as they are typed in (below)
      if (
        !target ||
        target.closest(
          "[data-sound-toggle], [data-sound-own], [role=slider], [data-scope=slider], input, textarea",
        )
      )
        return
      // after the click, so the state it lands in is read
      setTimeout(() => {
        const v = voiceFor(target)
        if (v) play(context, out, v.name, panOf(target), v.value)
      })
    }
    // typing: a key for each character written, a duller one for each taken out
    const onInput = (e: Event) => {
      if (!e.isTrusted || !(e instanceof InputEvent)) return
      play(
        context,
        out,
        e.inputType.startsWith("delete") ? "delete" : "key",
        panOf(e.target as Element),
      )
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
    // a tooltip or a hover card coming up has its own small sound, once per opening
    const POPS =
      '[data-scope="tooltip"][data-part="content"][data-state="open"], [data-scope="hover-card"][data-part="content"][data-state="open"]'
    let shown = new Set<Element>()
    let looking = 0
    const lookForPops = () => {
      looking = 0
      const now = new Set(document.querySelectorAll(POPS))
      for (const el of now) if (!shown.has(el)) play(context, out, "appear", panOf(el))
      shown = now
    }
    const pops = new MutationObserver(() => {
      if (!looking) looking = requestAnimationFrame(lookForPops)
    })
    pops.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
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
    // beforeinput, not input: a field that plans its own insertions (Pin Input) cancels the
    // edit and writes it itself, so no input event follows; beforeinput comes either way
    document.addEventListener("beforeinput", onInput, true)
    window.addEventListener("rind:cue", onCue)
    return () => {
      document.removeEventListener("beforeinput", onInput, true)
      window.removeEventListener("pointerdown", touched, true)
      window.removeEventListener("pointermove", drag, true)
      window.removeEventListener("keydown", touched, true)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("rind:cue", onCue)
      values.disconnect()
      phase.disconnect()
      pops.disconnect()
      cancelAnimationFrame(looking)
      music?.stop()
    }
  }, [enabled, home])

  const levels = useCallback(
    (n: number) => {
      const analyser = ac.current?.out.analyser
      if (!enabled || !analyser) return Array.from({ length: n }, () => 0)
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      // the music lives under 2 kHz (bins of ~190 Hz): four bands across it, the higher ones
      // lifted, since they carry less energy and would otherwise never move
      const edges = [1, 2, 3, 5, 9]
      const lift = [1, 1.3, 1.9, 2.8]
      return Array.from({ length: n }, (_, i) => {
        const from = edges[i % 4] ?? 1
        const to = edges[(i % 4) + 1] ?? from + 1
        let sum = 0
        for (let k = from; k < to; k++) sum += data[k] ?? 0
        return Math.min(1, (sum / (to - from) / 200) * (lift[i % 4] ?? 1))
      })
    },
    [enabled],
  )

  return (
    <SoundContext.Provider value={{ enabled, setEnabled, levels }}>
      {children}
    </SoundContext.Provider>
  )
}
