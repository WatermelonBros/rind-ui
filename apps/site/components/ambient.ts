// The landing's background music (sound.tsx starts it with the sound): generated live, so
// there is nothing to download, and quiet enough to sit under the interface sounds. Four
// slow chords go round; juicy lays a warm pad under them with soft bells now and then, crisp
// plucks their notes like a marimba, sparse, on a slow pulse. A change of phase is heard from
// the next note on, the old notes ringing out. Scrolling down opens the sound a little; it
// falls silent while the tab is hidden.

const BAR_S = 8
const PEAK = 0.075
// Cmaj7, Am7, Fmaj7, G6 (frequencies of each chord's notes, low to high)
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)
const CHORDS = [
  [48, 52, 55, 59],
  [45, 48, 52, 55],
  [41, 45, 48, 52],
  [43, 47, 50, 52],
].map((c) => c.map(midi))
const BELLS = [72, 74, 76, 79, 81, 84].map(midi)

interface Out {
  readonly master: AudioNode
  readonly room: AudioNode
}

export function ambient(ac: AudioContext, out: Out) {
  const bus = ac.createGain()
  bus.gain.value = 0
  const tone = ac.createBiquadFilter()
  tone.type = "lowpass"
  tone.frequency.value = 900
  bus.connect(tone)
  tone.connect(out.master)
  // mostly room: it should feel like air, not a track
  const send = ac.createGain()
  send.gain.value = 1.6
  tone.connect(send).connect(out.room)
  bus.gain.setTargetAtTime(PEAK, ac.currentTime, 1.2)

  const juicy = () => document.documentElement.dataset["phase"] === "juicy"

  const note = (
    f: number,
    at: number,
    attack: number,
    hold: number,
    release: number,
    level: number,
    type: OscillatorType,
    detune = 0,
  ) => {
    const osc = ac.createOscillator()
    const env = ac.createGain()
    osc.type = type
    osc.frequency.value = f
    osc.detune.value = detune
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(level, at + attack)
    env.gain.setValueAtTime(level, at + attack + hold)
    env.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release)
    osc.connect(env).connect(bus)
    osc.start(at)
    osc.stop(at + attack + hold + release + 0.05)
  }
  const bell = (f: number, at: number, level: number) => {
    note(f, at, 0.005, 0, 2.6, level, "sine")
    note(f * 2.76, at, 0.005, 0, 0.9, level * 0.25, "sine")
  }
  const pluck = (f: number, at: number, level: number) => {
    note(f, at, 0.004, 0, 0.45, level, "sine")
    note(f * 3.9, at, 0.002, 0, 0.12, level * 0.3, "sine")
  }

  // a look-ahead scheduler: every quarter second, schedule what falls in the next second
  let bar = 0
  let nextBar = ac.currentTime + 0.1
  let nextBell = ac.currentTime + 2
  const schedule = () => {
    const horizon = ac.currentTime + 1
    while (nextBar < horizon) {
      const chord = CHORDS[bar % CHORDS.length] ?? []
      if (juicy()) {
        // the pad: each note twice, a little apart in pitch, swelling in and out
        for (const f of chord) {
          note(f, nextBar, 2.2, BAR_S - 3, 3.2, 0.022, "triangle", -7)
          note(f, nextBar, 2.2, BAR_S - 3, 3.2, 0.022, "triangle", 7)
        }
      } else {
        // the marimba: the chord's notes an octave up on a slow eighth-note grid, sparse
        const step = 60 / 84 / 2
        for (let i = 0; i < BAR_S / step; i++) {
          if (Math.random() > 0.42) continue
          const f = (chord[Math.floor(Math.random() * chord.length)] ?? 262) * 2
          pluck(f, nextBar + i * step, 0.05)
        }
        note(chord[0] ?? 130, nextBar, 0.01, 0.2, 1.2, 0.05, "sine")
      }
      bar++
      nextBar += BAR_S
    }
    while (juicy() && nextBell < horizon) {
      bell(BELLS[Math.floor(Math.random() * BELLS.length)] ?? 523, nextBell, 0.035)
      nextBell += 1.4 + Math.random() * 2.6
    }
    if (!juicy()) nextBell = Math.max(nextBell, horizon)
  }
  schedule()
  let timer = window.setInterval(schedule, 250)

  // further down the page, a little brighter
  const onScroll = () => {
    const depth = window.scrollY / Math.max(1, document.body.scrollHeight - innerHeight)
    tone.frequency.setTargetAtTime(900 + depth * 2200, ac.currentTime, 0.4)
  }
  onScroll()
  window.addEventListener("scroll", onScroll, { passive: true })

  const onVisibility = () => {
    if (document.hidden) {
      bus.gain.setTargetAtTime(0, ac.currentTime, 0.2)
      clearInterval(timer)
    } else {
      nextBar = Math.max(nextBar, ac.currentTime + 0.1)
      nextBell = Math.max(nextBell, ac.currentTime + 1)
      bus.gain.setTargetAtTime(PEAK, ac.currentTime, 1)
      clearInterval(timer)
      timer = window.setInterval(schedule, 250)
    }
  }
  document.addEventListener("visibilitychange", onVisibility)

  return {
    stop: () => {
      clearInterval(timer)
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("visibilitychange", onVisibility)
      bus.gain.setTargetAtTime(0, ac.currentTime, 0.3)
      window.setTimeout(() => {
        tone.disconnect()
        send.disconnect()
      }, 2000)
    },
  }
}
