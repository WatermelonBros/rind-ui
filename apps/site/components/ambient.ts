// The landing's background music (sound.tsx starts it with the sound): generated live, so
// there is nothing to download, and quiet enough to sit under the interface sounds. Four
// slow chords go round under two layers that always play together: juicy's, a warm pad with
// soft bells now and then; crisp's, a muted plucked arpeggio on a fixed pattern, a soft bass
// on the strong beats and a light tick between. The phase only sets which layer is heard: a
// change crossfades them in about a second, in step with the page's wave, and the harmony
// never breaks. Scrolling down opens the sound a little; it falls silent while the tab is
// hidden.

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
  // the two layers, crossfaded by the phase
  const soft = ac.createGain()
  const hard = ac.createGain()
  soft.connect(bus)
  hard.connect(bus)
  const balance = (glide: number) => {
    soft.gain.setTargetAtTime(juicy() ? 1 : 0.0001, ac.currentTime, glide)
    hard.gain.setTargetAtTime(juicy() ? 0.0001 : 1, ac.currentTime, glide)
  }
  soft.gain.value = juicy() ? 1 : 0.0001
  hard.gain.value = juicy() ? 0.0001 : 1
  const phase = new MutationObserver(() => balance(0.3))
  phase.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phase"] })

  const note = (
    f: number,
    at: number,
    attack: number,
    hold: number,
    release: number,
    level: number,
    type: OscillatorType,
    layer: AudioNode,
    detune = 0,
    cutoff = 0,
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
    if (cutoff) {
      const lp = ac.createBiquadFilter()
      lp.type = "lowpass"
      lp.frequency.value = cutoff
      osc.connect(lp).connect(env)
    } else osc.connect(env)
    env.connect(layer)
    osc.start(at)
    osc.stop(at + attack + hold + release + 0.05)
  }
  const bell = (f: number, at: number, level: number) => {
    note(f, at, 0.005, 0, 2.6, level, "sine", soft)
    note(f * 2.76, at, 0.005, 0, 0.9, level * 0.25, "sine", soft)
  }
  // muted: a triangle through a low filter, gone in a fifth of a second
  const pluck = (f: number, at: number, level: number) => {
    note(f, at, 0.003, 0, 0.2, level, "triangle", hard, 0, 1800)
    note(f * 2, at, 0.002, 0, 0.06, level * 0.25, "sine", hard)
  }
  const tick = (at: number) => {
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.03), ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 4
    const src = ac.createBufferSource()
    src.buffer = buf
    const hp = ac.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = 7000
    const g = ac.createGain()
    g.gain.value = 0.05
    src.connect(hp).connect(g).connect(hard)
    src.start(at)
  }
  // the arpeggio's shape over the chord's four notes, the same every bar
  const PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]

  // a look-ahead scheduler: every quarter second, schedule what falls in the next second
  let bar = 0
  let nextBar = ac.currentTime + 0.1
  let nextBell = ac.currentTime + 2
  const schedule = () => {
    const horizon = ac.currentTime + 1
    while (nextBar < horizon) {
      const chord = CHORDS[bar % CHORDS.length] ?? []
      // juicy's pad: each note twice, a little apart in pitch, swelling in and out
      for (const f of chord) {
        note(f, nextBar, 2.2, BAR_S - 3, 3.2, 0.022, "triangle", soft, -7)
        note(f, nextBar, 2.2, BAR_S - 3, 3.2, 0.022, "triangle", soft, 7)
      }
      // crisp's: the arpeggio an octave up on eighth notes, accented on the beat; a bass on
      // the bar's strong beats; a tick on every off-beat
      const step = 60 / 90 / 2
      const steps = Math.floor(BAR_S / step)
      for (let k = 0; k < steps; k++) {
        const at = nextBar + k * step
        const f = (chord[PATTERN[k % PATTERN.length] ?? 0] ?? 262) * 2
        pluck(f, at, k % 4 === 0 ? 0.06 : 0.035)
        if (k % 2 === 1) tick(at)
        if (k % 8 === 0) note((chord[0] ?? 130) / 2, at, 0.01, 0.15, 0.9, 0.09, "sine", hard)
      }
      bar++
      nextBar += BAR_S
    }
    while (nextBell < horizon) {
      bell(BELLS[Math.floor(Math.random() * BELLS.length)] ?? 523, nextBell, 0.035)
      nextBell += 1.4 + Math.random() * 2.6
    }
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
      phase.disconnect()
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
