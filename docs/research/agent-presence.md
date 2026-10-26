# Agent Presence — research

Status: done · Wave: AI

Agent Presence is the indicator of a **voice or realtime agent**: what the agent is doing right
now (idle, connecting, listening, thinking, speaking, failed), how loud it or the user is
(an **audio level**), and what assistive technology is told when that changes. It is what
drives the orb in a voice assistant. The visual (a Rive orb, a WebGL aura, a bar visualiser, a
canvas waveform) is fx and out of scope ([0006-fx.md](../decisions/0006-fx.md)); the
behaviour is in scope: the state vocabulary, which transitions are announced and which never
are, a level that updates sixty times a second without turning into state, what happens when the
provider's state stalls or skips, and motion that the user can stop. There is no model, no
audio capture and no transport inside: LiveKit, ElevenLabs, OpenAI Realtime, Pipecat or the
consumer's own socket tell the component the state and give it a level. The headless
libraries have no such component. The voice kits do, and none of the visualisers read in this
research has a role, a name or a status text. This note records how they built it, the bugs on
their trackers, and the decisions for `add-agent-presence`. The naming: this is not the shared
`presence` infrastructure (mount and unmount animation) of the overlay components.

Builds on [prompt-input.md](prompt-input.md) (`status`: `idle | submitting | streaming | error`;
the text modality this sits next to), [streaming-message.md](streaming-message.md) and
[message-thread.md](message-thread.md) (the transcript: where the words of a voice session
live), [tool-call.md](tool-call.md) (status as a bound prop, announcements by transition, focus
rules), [timer.md](timer.md) (an injected Clock, a changing value that is not a live region),
[meter.md](meter.md) (`role="meter"`; reused for clamping only), [reasoning.md](reasoning.md)
(`thinking`), and the cross-cutting notes [accessibility.md](accessibility.md) §7 (the Announcer;
§7.5 already says "Agent Presence announces state, never audio level"), §8 (motion), rules 7, 23,
24, 25, 26, [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes D, H.

Sources read (GitHub API, `gh`, npm tarballs and the W3C and OpenAI pages, 2026-10-26):

| Library | Files |
|---|---|
| LiveKit | `livekit/components-js` `packages/react/src/hooks/{useAgent,useVoiceAssistant}.ts` (the `AgentState` type and its lifecycle comment), `packages/react/src/components/participant/BarVisualizer.tsx` (grepped), `packages/shadcn/components/agents-ui/{agent-audio-visualizer-bar,agent-chat-indicator,agent-track-toggle,agent-control-bar}.tsx` and `hooks/agents-ui/use-agent-audio-visualizer-bar.ts`; the sibling visualisers (aura, grid, radial, wave) were listed, not read |
| ElevenLabs | `elevenlabs/ui` `apps/www/registry/elevenlabs-ui/ui/{orb,bar-visualizer,conversation-bar,voice-button}.tsx` (`live-waveform.tsx` listed), `examples/orb-demo.tsx`; npm `@elevenlabs/client` type declarations (`Mode`, `Status`, `getInputVolume`, `getOutputVolume`) |
| Vercel AI Elements | `packages/elements/src/persona.tsx` (306 lines), `speech-input.tsx` (grepped); the `audio-player`, `voice-selector` components listed, not read |
| Pipecat | `pipecat-ai/voice-ui-kit` `package/src/components/elements/ClientStatus.tsx`, `package/src/visualizers/VoiceVisualizer/index.tsx` (the `<canvas>`); npm `@pipecat-ai/client-js` type declarations (`RTVIEvent`, `TransportState`) |
| OpenAI Realtime | the Realtime conversations and VAD guides (server event names); the `openai-realtime-console` source was not found at the path tried and is not read |
| Trackers | `livekit/components-js`, `livekit/agents`, `vercel/ai-elements`, `elevenlabs/ui`, `pipecat-ai/voice-ui-kit`, `assistant-ui/assistant-ui` |
| Platform | WAI-ARIA 1.2 `status`, `meter`, `img`; WCAG 2.2 1.1.1, 1.2.9, 2.2.2, 2.3.3, 4.1.3; MDN `AnalyserNode` (`fftSize` 2048, `smoothingTimeConstant` 0.8 as the Web Audio defaults, `getByteTimeDomainData`, `getByteFrequencyData`) |

Radix, React Aria, Base UI, Headless UI, Ariakit, Ark/Zag, Reka UI, Bits UI and Kobalte have no
agent or voice indicator in their component lists (their trackers were not searched for it). Browser support for the
parts the component touches is not in question: `requestAnimationFrame`, CSS custom properties
and `prefers-reduced-motion` are Baseline, and the component never touches `AudioContext` (the
consumer owns capture). The LiveKit and ElevenLabs repositories were read at their default
branches; LiveKit's `agents-ui` docs site was not read.

## Pattern

- WAI-ARIA APG: **none**. This is a status display with an animated decoration, not a widget.
  The nearest ARIA is `role="status"` (a polite, atomic live region) for the text, and
  `role="img"` or `aria-hidden` for the picture. The component takes neither route for the
  text: accessibility.md rule 23 says components render no `aria-live` of their own, so the
  text is plain and what must be heard goes through the injected Announcer.
- **The state must exist as text**, not only as an orb: the visual is one of the five
  indicators read (LiveKit bar, Persona, ElevenLabs Orb and bars, Pipecat canvas); none of
  them has `role`, `aria-label`, an `img` alternative or a status string (grep of every file
  listed above; the ElevenLabs `VoiceButton` and LiveKit control bar have buttons with names, the
  indicators do not). WCAG 1.1.1 (non-text content) and 1.3.1.
- The **level is decoration**. ARIA's `meter` role exists, but a value that changes every frame
  is not something to expose through `aria-valuenow`; nobody needs 60 readings a second, and
  the state already says whether the agent is speaking (reasoned; no source states it).
  accessibility.md §7.5: "Agent Presence announces state, never audio level".
- Motion: WCAG 2.2.2 Pause, Stop, Hide applies to "any moving, blinking or scrolling information
  that (1) starts automatically, (2) lasts more than five seconds" and is shown with other
  content: an orb that animates for the whole session qualifies unless it is essential. The state
  text is the essential part; the animation must be stoppable. WCAG 2.3.3 (animation from
  interactions, AAA) and `prefers-reduced-motion` are the user's signal. None of the files read
  mentions reduced motion (a search for `prefers-reduced-motion`, `motion-reduce` and
  `reducedMotion` in every file listed returned nothing); LiveKit's chat indicator pulses
  forever (`repeat: Infinity`).
- Time-based media: a voice session is live audio. WCAG 1.2.9 (Audio-only, Live, level AAA)
  asks for an equivalent text; the transcript is the consumer's Message Thread and Streaming
  Message, which this component sits beside, never replaces.

## How the others built it

| | LiveKit (`agents-ui`) | ElevenLabs UI | AI Elements `Persona` | Pipecat `voice-ui-kit` |
|---|---|---|---|---|
| State type | `AgentState` = `disconnected`, `connecting`, `pre-connect-buffering`, `failed`, `initializing`, `idle`, `listening`, `thinking`, `speaking` | Orb `AgentState` = `null`, `thinking`, `listening`, `talking`; BarVisualizer `connecting`, `initializing`, `listening`, `speaking`, `thinking`; client `Mode` = `speaking`, `listening` and `Status` = `disconnected`, `connecting`, `connected`, `disconnecting` | `PersonaState` = `idle`, `listening`, `thinking`, `speaking`, `asleep` | none: events (`botStartedSpeaking`, `botStoppedSpeaking`, `userStartedSpeaking`, `userStoppedSpeaking`, `botReady`, `llmFunctionCallStarted` …) and a ten-value `TransportState` |
| Who sets it | the agent publishes it as a participant attribute; `useAgent` / `useVoiceAssistant` read it | consumer (`useConversation().status` / `mode`) | consumer prop `state` | the consumer derives it from events |
| Level | `useMultibandTrackVolume(track, {bands, loPass, hiPass})` or `volumeBands` prop; bands drive bar heights in `%` | pull functions `getInputVolume()` / `getOutputVolume()` (0..1), or `volumeMode="manual"` with `manualInput` / `manualOutput` | none (Rive animates itself) | canvas drawn from the audio track |
| Visual | divs with `data-lk-state`, `data-lk-index`, `data-lk-highlighted`; sequences per state at fixed intervals (listening 500 ms, thinking 150 ms, connecting `2000 / n`) | WebGL orb; bars; `LiveWaveform` | Rive state machine with inputs `listening`, `thinking`, `speaking`, `asleep` | `<canvas>` |
| ARIA | none in the visualiser; the control bar has `aria-label="Voice assistant controls"` and buttons `Toggle microphone` | none in `orb`, `bar-visualizer`; `VoiceButton` has a fixed `aria-label="Voice Button"` and goes `disabled` while processing | none | none |
| Motion | animates until unmounted; no reduced-motion handling in the files read | same | same; also delays Rive initialisation one frame so React Strict Mode never creates a second WebGL context | same |

### LiveKit

- `AgentState` is documented in the source with the lifecycle: "connecting ➡️
  pre-connect-buffering ➡️ initializing/listening/thinking/speaking", "if an agent fails to
  connect: connecting ➡️ pre-connect-buffering/initializing ➡️ failed", and the five states the
  agent SDK reports (`initializing`, `idle`, `listening`, `thinking`, `speaking`) are linked to
  `livekit/agents` `voice/events.py`. `useAgent` returns a discriminated union per state with
  `isConnected`, `canListen`, `isFinished`, `isPending` flags, `failureReasons` and a **connect timeout** (20 s default,
  `DEFAULT_AGENT_CONNECT_TIMEOUT_MILLISECONDS`, with a FIXME to make it 10 s).
- `AgentAudioVisualizerBar` takes `state`, `audioTrack` or `volumeBands`, `barCount`, `size`,
  `color`. Bars are `div`s; heights come from the bands **only while `speaking`**
  (`state === 'speaking' ? bands : zeros`); other states highlight bars in a sequence from a
  `requestAnimationFrame` loop in `use-agent-audio-visualizer-bar.ts`. The wrapper sets
  `data-lk-state={state}` and nothing else for assistive technology.
- `AgentChatIndicator`: a dot with a spring that repeats forever, shown by the consumer while
  `thinking`.
- Not read: the sibling visualisers (aura, grid, radial, wave). Aura's licence is the subject of
  issue #1463 (closed; title only).

### ElevenLabs UI

- `Orb` is a three.js component (`@react-three/fiber`, `Canvas`, `useFrame`) with `agentState` (`null | "thinking" | "listening" |
  "talking"`), `volumeMode` (`"auto" | "manual"`), `manualInput`, `manualOutput` and
  `getInputVolume` / `getOutputVolume` callbacks read inside the render loop (refs, not React
  state). `@elevenlabs/client` exposes the same two functions on a conversation
  (`getInputVolume(): number`, `getOutputVolume(): number`, plus byte frequency data) and
  `Mode = "speaking" | "listening"`, `Status = "disconnected" | "connecting" | "connected" |
  "disconnecting"`: **two orthogonal dimensions** that the Orb folds into one.
- `ConversationBar` maps `status` to a `LiveWaveform` (`active={isConnected && !isMuted}`,
  `processing={status === "connecting"}`), hides it when `disconnected` or `error`, and shows
  the static text "Customer Support" there; mute and keyboard toggles use `aria-pressed`. There
  is no text for `connecting`, `listening` or `speaking`.
- `VoiceButton` has states `idle | recording | processing | success | error`, a fixed
  `aria-label` of "Voice Button" (the state is not in the name), and `disabled={disabled ||
  isProcessing}`: a focused button that becomes `disabled` loses focus (accessibility.md rule 22).

### AI Elements `Persona`

- A Rive animation chosen from six hosted `.riv` files (`obsidian` default, `command`, `glint`,
  `halo`, `mana`, `opal`); the prop `state` toggles four boolean inputs on a view model
  (`listening`, `thinking`, `speaking`, `asleep`) in an effect. It reads `prefers-color-scheme`
  and the `dark` class; it does not read `prefers-reduced-motion`. It renders a `RiveComponent`
  with a `size-16` class and no `role`, name or text.
- Issue #471 (open) notes that the six binaries are hot-linked from a Vercel Blob URL, are not in
  the Apache-2.0 repository, and have unclear licensing and no editable sources.
- `SpeechInput` (the dictation button) is a separate component using the browser
  `SpeechRecognition`, falling back to `MediaRecorder`; its button changes icon (mic, square,
  spinner) by state.

### Pipecat `voice-ui-kit` and the OpenAI Realtime API

- Pipecat's client has no agent state. It emits events: `botConnected`, `botReady`,
  `botStartedSpeaking`, `botStoppedSpeaking`, `userStartedSpeaking`, `userStoppedSpeaking`,
  `userMuteStarted`, `botLlmStarted`, `llmFunctionCallStarted`, `error`, and a separate
  `TransportState`: `disconnected`, `initializing`, `initialized`, `authenticating`,
  `authenticated`, `connecting`, `connected`, `ready`, `disconnecting`, `error`. The kit's
  `ClientStatus` prints the transport state as coloured text (the colour carries "error" and
  "connected", the word is there too); `VoiceVisualizer` draws bars on a `<canvas>` with no
  alternative.
- OpenAI Realtime, the same shape: no state, only server events. The guide names
  `input_audio_buffer.speech_started` and `.speech_stopped` (server VAD; `semantic_vad` waits
  longer when the user trails off), `response.created`, `response.output_audio.delta` (audio
  chunks; "the first delta is the practical start signal" is the page's reading, not a named
  event), `response.output_audio.done` and `response.done`. Over WebRTC the model audio is a
  remote media stream. So a UI derives `listening`, `thinking` and `speaking` itself, which is
  where the "missing" or "late" states below come from.

### Not shipped

assistant-ui has speech and dictation adapters; its `ThreadPrimitive.Root` JSDoc misses "Escape
to stop speaking" (issue #6017, closed, title only), so a stop-speaking key exists in that kit;
no presence indicator was found in its element tree.

## Bug history

Search: "agent state", "state", "speaking", "thinking", "accessib", "aria", "screen reader",
"visualizer", "orb" on the trackers above (open and closed). Read in full: the issues marked
"read"; the others by title.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| LiveKit (client) | [#1227](https://github.com/livekit/components-js/issues/1227) (read) | an agent that disconnects mid-conversation does not move the UI to `failed`; `listening` is shown with no agent participant | failure reasons only set at connect time; state derived without checking the participant | closed | `error` is reachable from every state; a state that needs a connected agent is never shown without one (the consumer's mapping), and the component never invents the state |
| LiveKit (client) | [#1294](https://github.com/livekit/components-js/issues/1294) (read) | a user who speaks for longer than the 20 s timeout at the start gets "failed" while the agent is listening | initial attributes not read; the UI only learns the agent is alive when its state changes | closed | a timeout is a consumer's decision based on facts; the component offers a `stale` signal per state and never fails a session |
| LiveKit (agents) | [#3007](https://github.com/livekit/agents/issues/3007) (read) | with an avatar the UI jumps from `listening` to `speaking`, skips `thinking`, and "speaking" appears 1 to 2 s late | the avatar participant publishes state late | closed | any state to any state is legal; `thinking` is optional; no machine path may assume an order |
| LiveKit (agents) | [#6904](https://github.com/livekit/agents/issues/6904) (read) | filler speech during a tool call sets `agent_state` to `listening`; the inactivity timer fires | state flips during a long task | closed | `listening` from `speaking` is a transition the user hears; announcements must not be driven by a flapping state (a dwell before announcing) |
| LiveKit (agents) | [#8027](https://github.com/livekit/agents/issues/8027) (read) | the agent stays `speaking` forever when the avatar leaves mid-reply, until the user interrupts | `lk.playback_finished` never arrives and the wait has no timeout | open | a state can stick: `staleAfter` per state raises `data-stale` and `onStale` so the consumer can recover; the component does not guess |
| LiveKit (client) | [#1000](https://github.com/livekit/components-js/issues/1000), [#1079](https://github.com/livekit/components-js/issues/1079) (titles only) | `BarVisualizer` renders nothing | styles not imported | closed | the visual is a theme; the state and text render without it |
| AI Elements | [#471](https://github.com/vercel/ai-elements/issues/471) | the Persona's assets are hot-linked and their licence is unclear | binaries outside the repository | open | the headless component ships no visual asset and loads no remote file |
| AI Elements | `persona.tsx` (source, no issue) | a WebGL context per Strict Mode mount; no role, name or text; no reduced motion | design | open | no GPU or audio resource is created by the component; the visual is the consumer's |
| ElevenLabs UI | `voice-button.tsx` (source, no issue) | fixed name "Voice Button"; `disabled` while processing | design | open | the state is in the name or the status text; a control that holds focus is `aria-disabled`, not `disabled` (rule 22) |
| Pipecat kit | [#38](https://github.com/pipecat-ai/voice-ui-kit/issues/38) (title only) | "Progress Primitive: This needs aria attributes for accessibility" | primitive without ARIA | closed | the only accessibility-titled issue found on the trackers searched; none of the voice-kit trackers has a report about the indicators |
| Pipecat kit | [#20](https://github.com/pipecat-ai/voice-ui-kit/issues/20) (title only) | media devices UI in the pending and blocked states needs work | the microphone permission is a state | open | a blocked microphone is an `error` the consumer maps; the docs show it, the component does not request permission |
| ElevenLabs UI | `orb.tsx` (source) | level read through callbacks inside the animation loop, no React state | by design | n/a | the right shape: pull a number per frame, write it to the DOM, keep it out of state |

## Accessibility decisions

- **State is text.** `Status` renders the state's words from `messages` ("Listening", "Thinking",
  "Speaking", "Connecting", "Idle", "Connection lost") in the DOM at all times, visible or
  visually hidden. It is **not** a live region (rule 23). The visual (`Visual`) is `aria-hidden`
  (decorative; WCAG 1.1.1 is satisfied by the text). A user who navigates to the indicator with
  the virtual cursor, or looks at it, always finds the current state.
- **Announcements go through the Announcer, by transition, polite, keyed**
  (`agent-presence`, one pending message at a time so a flapping state collapses, as the
  Combobox count does):
  - first entry into `listening` after `connecting`: "Listening" (the moment the user may speak;
    also the only cue that the microphone is open);
  - `thinking`: **not announced** unless it lasts longer than `thinkingDelay` (default 1500 ms,
    through the Scheduler): then "Thinking"; a voice user otherwise hears silence and cannot
    tell a slow agent from a dead one (agents #6904, #3007 show the state flapping);
  - `speaking`: never (the voice is the signal, and the text is the transcript's);
  - back to `listening` after `speaking` or `thinking`: not announced (turn-taking is the
    conversation itself);
  - `connecting`: not announced (the user pressed Start; the button changes);
  - `idle` after a session (`ended`): "Voice session ended", polite;
  - `error`: assertive, with the reason text from the consumer (assertive only for failures,
    rule 25);
  - audio level: **never**.
  `announce: "off" | "polite" | "assertive"` (default `"polite"`) and a per-state override
  `announceStates` (a `ReadonlyArray<AgentPresenceState>`), because every voice product is
  different.
- **Loops of speech.** A screen reader's synthetic voice is audio on the same device as an open
  microphone, and the agent's own voice is audio too. No source was found that describes how
  the three interact (acoustic echo, the agent hearing "Listening" and answering it). This is an
  open question for a tier-1 AT session and the reason `announce` is configurable and the
  default set is small.
- **Controls are not this component's, but its rules are.** The mute, stop-speaking and end
  buttons are the consumer's `Button`s; they stay focusable when their action is unavailable
  (`aria-disabled`, rule 22; ElevenLabs' `VoiceButton` goes `disabled` while processing), their
  names do not change with the state, and a pressed state is `aria-pressed` ("Mute microphone",
  pressed), as `AgentTrackToggle` and `ConversationBar` do.
- **Motion.** `prefers-reduced-motion` (Env `motion`) sets `data-motion="reduced"` and stops the
  level loop: the CSS shows a static glyph for the state. An explicit `motion: "auto" | "off"`
  prop and a `paused` toggle exist for WCAG 2.2.2: the animation can be turned off by the user
  from a control the consumer provides. A hidden page (Page Visibility) stops the level loop.
  Nothing animates forever by default under reduced motion (LiveKit's indicator does).
- **Contrast and forced colours.** The state is never colour only (Pipecat's `ClientStatus` also
  prints the word): `data-state` styles need a shape or text difference; forced-colors keep the
  glyph visible.
- **Focus.** The indicator is not focusable. Nothing in it moves focus on a state change.
- **Locale and direction.** `messages` and `lang` as everywhere; the status text and the hint
  follow the component's locale; the visual is mirrored by the theme only if it is directional.
- **Privacy cue.** "Listening" means the microphone is hot; the visual state and the text must
  agree with the actual mute state (`muted` is a prop and shows "Microphone muted" when
  `listening` is requested while muted), so the indicator never says "Listening" for a muted
  microphone (reasoned from the purpose; browsers add their own indicator).

## Testing notes

- Machine in Node on a virtual Clock and Scheduler: every state to every state (including
  `listening` to `speaking`, skipping `thinking`), mount in each state, announcement matrix (one
  per eligible transition, none for `speaking` or level), `thinkingDelay` (a `thinking` that ends
  before the delay announces nothing; one that lasts announces once), flapping collapses to one
  message by key, `staleAfter` per state sets `data-stale` and calls `onStale` once, a state
  change resets it, `muted` overrides the visible state text, reduced motion and hidden page stop
  the level loop.
- Level: a pure `smooth(prev, next, dtMs, { attack, release })` (clamp 0..1, NaN and Infinity to 0,
  monotone, converges), a frame loop test with a fake `requestAnimationFrame` that writes
  `--level` on the element and stops on unmount; no React state in the loop (a render counter
  asserts zero renders per frame).
- Model-based: invariants "`Status` text matches `data-state`", "announcements never carry a
  level", "at most one pending announcement per key", "no focusable element in `Visual`".
- Browser (three engines): axe in every state in light and dark and forced colours; a screen
  reader pass (VoiceOver, NVDA, TalkBack) for the announcements and the on-demand reading of
  `Status`; reduced-motion emulation shows the static glyph; the level loop uses no more than a
  frame budget (a performance trace with a 60 Hz source); the page hidden stops it.

## Decisions for `add-agent-presence`

- **A status display with a decoration, not a widget.** The component is the state vocabulary,
  the announcements, the staleness and the level plumbing; the picture is a theme (a dot and
  bars in CSS) or the consumer's fx (a canvas, Rive, WebGL) placed in `Visual`.
- **Parts**: `Root` (a `div`; the machine; sets the CSS custom properties), `Visual` (a `div`,
  `aria-hidden`, the consumer's visual goes inside), `Status` (a `span`, the state text),
  `Label` (optional visible name of the agent), `Detail` (optional extra line, e.g. the error
  reason or "still thinking"; not live). Only `Root` is required; `Status` is rendered by default
  and visually hidden when no visible one is composed.
- **Machine** `agent-presence`: **`state` is a bound prop** (as Tool Call's `status`), not a
  state the component reaches by itself: `idle | connecting | listening | thinking | speaking |
  error`. The consumer maps its runtime (LiveKit: `disconnected` and `idle` to `idle`,
  `connecting` and `pre-connect-buffering` and `initializing` to `connecting`, `failed` to `error`;
  ElevenLabs: `status` plus `mode`; Orb `talking` to `speaking`; Persona `asleep` to `idle`;
  Pipecat and OpenAI: derived from events, with a documented reducer recipe). The machine's
  states mirror the prop so the model graph is real, any to any; context: `previous`, `since` (the
  Clock), `stale`, `announced`, `muted`. Machine-owned time: `thinkingDelay`, `staleAfter`.
- **Events**: `STATE.CHANGE { state, reason? }`, `MUTED.CHANGE`, `MOTION.CHANGE`,
  `VISIBILITY.CHANGE`, `THINKING.ELAPSED` and `STALE` (timers). The audio level is **not an
  event**: 60 events a second would flood the model tests, the history and the runtime.
- **Props**: `state`, `muted`, `reason` (a string for `error`), `announce`, `announceStates`,
  `thinkingDelay` (1500), `staleAfter` (`Partial<Record<State, number>>`, none by default),
  `getLevel?: (channel: "input" | "output") => number` (pull, polled each frame while `listening`
  or `speaking`, ElevenLabs' shape), `smoothing: { attack, release }`, `motion: "auto" | "off"`,
  `onStale(state)`, `onStateChange(state, { from })`, `messages`, `lang`.
  Types: the state union is exported and exhaustive in `messages` and `announceStates`.
- **Level**: `getLevel` returns 0..1; the loop (Scheduler `requestAnimationFrame`, stops under
  reduced motion, `motion: "off"` or a hidden page) clamps (shared `resolveRangeValue`), smooths
  with the pure `smooth`, and writes `--level` (the active channel by state: `listening` uses
  `input`, `speaking` uses `output`, other states 0) plus `--input-level` and `--output-level` on
  `Root` with `style.setProperty` through a `core/dom` effect, outside the framework's rendering.
  `data-level` is a coarse band (`0 | 1 | 2 | 3`) updated at most 4 times a second for CSS that
  cannot use custom properties and for the contract. Bands (a frequency array) are the consumer's
  fx and out of v1.
- **`data-*`**: `data-scope="agent-presence"`; Root, Visual, Status `data-state` (the state),
  `data-previous-state`, `data-muted`, `data-stale`, `data-motion` (`full | reduced | off`),
  `data-level` (band), `data-hidden` (page hidden); `Detail` `data-reason`.
- **Contract** (`agentPresenceContract`): located by `data-scope` and, when composed, the
  `Status` text (the root has no role); actions (test environment drivers, as Tool Call's
  `setStatus`): `setState(state, reason?)`, `setMuted`, `setLevel(channel, n)`, `advance(ms)`,
  `setReducedMotion`, `setHidden`; queries `state`, `statusText`, `level` (the band and the raw
  custom property), `isStale`, `isMuted`, `motion`, `announcements`. Traits `announcing`,
  `time-driven`.
- **Reuse**: the Announcer, Clock, Scheduler, Motion preference and Page Visibility from the
  environment (the same capabilities Timer and Toast use), `messages` and `lang`, the shared
  range clamp. Meter is not used (no `role="meter"` on a frame-rate value); Streaming Message
  and Message Thread render the transcript; Prompt Input's `status` is the text counterpart and the
  two are independent. Tool Call's focus and announcement rules (assertive only for failure,
  polite otherwise) are the model for `announce`.
- **Deliberately different**: a status text and announcements where the kits ship none; an
  explicit stale signal where LiveKit and Pipecat leave stuck states to the app (agents #8027);
  any-to-any transitions with an optional `thinking` (agents #3007); a pull level that never
  becomes state (ElevenLabs' idea, LiveKit's React-state bands are the opposite); reduced motion
  and an off switch; the control buttons keep focus when unavailable; no remote assets, no WebGL
  or audio resources.
- **Non-goals**: capturing or analysing audio (no `AudioContext`, no `AnalyserNode`; a recipe
  wraps an analyser into `getLevel`); the transport, session, token or turn detection (LiveKit,
  ElevenLabs, OpenAI, Pipecat own them); the transcript (Message Thread); speech recognition and
  synthesis (AI Elements' `SpeechInput`, a separate component question); the visual (orbs,
  auras, Rive) and its assets: fx; microphone permission UI; echo cancellation and barge-in
  policy; per-band frequency data; sounds and earcons.

## Open questions

- **Screen reader speech and an open microphone.** Whether announcing "Listening" is picked up
  by the agent as user speech, and whether it should be Braille-only or an earcon, was not
  answered by any source; the default announcement set is therefore small and configurable.
  Tier-1 AT and real-device testing with a live agent are needed before the spec fixes the
  default.
- **Which state names.** `idle | connecting | listening | thinking | speaking | error` folds
  LiveKit's nine and ElevenLabs' two dimensions into six. Lost: `pre-connect-buffering` (the
  agent is not ready but audio is already buffered), `disconnecting`, `asleep`, and "the user is
  speaking" distinct from "the agent is listening" (Pipecat's `userStartedSpeaking`, OpenAI's
  `speech_started`). A `userSpeaking` flag next to `listening` would add a cue for deaf-blind and
  low-vision users; not in v1 unless the research with AT shows a need.
- **Interruption.** `speaking` to `listening` because the user barged in is different from the
  agent finishing (OpenAI cancels the response after `speech_started`); the transition carries a
  `reason` only if the consumer supplies one. Whether the visual should differ is a theme
  question.
- **Reduced motion and the level.** With `reduced`, should a coarse level (the 4 Hz band) still
  show, as a non-moving meter, or nothing? Assumed: the band is exposed, the theme decides.
- **Stale thresholds.** No data on how long `thinking` or `speaking` legitimately lasts; no
  defaults are proposed, the consumer sets `staleAfter`.
- **A pause control in the box?** WCAG 2.2.2 needs one for the animation; the component has
  `motion` and `paused` props but no button (a recipe with `aria-pressed`). Whether a bundled
  `Toggle` part is worth it depends on the first examples.
- **Multiple agents or participants** (a meeting with several voices): out of scope; one
  `Root` per agent, the consumer's list.
