"use client"

import { Button, MessageThread, StreamingMessage } from "@rind-ui/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Letters } from "../letters"
import { usePhase } from "../phase"
import { type HeroKind, heroKind } from "./hero-state"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

type Status = "pending" | "streaming" | "complete"

// A replay of the loop the section describes, with rind's real parts and driver calls, about the
// visit's own component (the one the hero showed, hero-state.ts)
const DIALOG = (title: string, body: string) => `<Dialog.Root>
  <Dialog.Trigger>${title}</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Title>${title}</Dialog.Title>
${body}
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Portal>
</Dialog.Root>`

const SESSIONS: Record<HeroKind, { ask: string; reply: string }> = {
  switch: {
    ask: "Add a settings dialog with a dark mode switch. Test it.",
    reply: `Read llms.txt: Dialog and Switch are both ready.

${DIALOG(
  "Settings",
  `        <Switch.Root>
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <Switch.Label>Dark mode</Switch.Label>
        </Switch.Root>`,
)}

Now I check my own work with the drivers:

const settings = getDialog(screen, { name: "Settings" })
await settings.open()
const dark = getSwitch(screen, { name: "Dark mode" })
await dark.toggle()
expect(await dark.isChecked()).toBe(true)

✓ 1 test passed`,
  },
  checkbox: {
    ask: 'Add a terms dialog with an "I agree" checkbox. Test it.',
    reply: `Read llms.txt: Dialog and Checkbox are both ready.

${DIALOG(
  "Terms",
  `        <CheckboxGroup.Item>
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemLabel>I agree</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>`,
)}

Now I check my own work with the drivers:

const terms = getDialog(screen, { name: "Terms" })
await terms.open()
const agree = getCheckbox(screen, { name: "I agree" })
await agree.toggle()
expect(await agree.isChecked()).toBe(true)

✓ 1 test passed`,
  },
  button: {
    ask: "Add a confirm dialog with a Delete button. Test it.",
    reply: `Read llms.txt: Dialog and Button are both ready.

${DIALOG("Delete project", `        <Button onPress={remove}>Delete</Button>`)}

Now I check my own work with the drivers:

const confirm = getDialog(screen, { name: "Delete project" })
await confirm.open()
await getButton(screen, { name: "Delete" }).press()
expect(remove).toHaveBeenCalledOnce()

✓ 1 test passed`,
  },
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Streams the reply in bursts the first time the thread scrolls into view; Replay plays it again. */
function useReplay(kind: HeroKind) {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("pending")
  const timer = useRef(0)
  const play = useCallback(() => {
    clearTimeout(timer.current)
    if (reduced()) {
      setText(SESSIONS[kind].reply)
      setStatus("complete")
      return
    }
    setText("")
    setStatus("pending")
    const words = SESSIONS[kind].reply.split(/(?<=\s)/)
    let i = 0
    const step = () => {
      i = Math.min(words.length, i + 2 + Math.floor(Math.random() * 4))
      const done = i >= words.length
      setText(words.slice(0, i).join(""))
      setStatus(done ? "complete" : "streaming")
      if (!done) timer.current = window.setTimeout(step, 40 + Math.random() * 70)
    }
    timer.current = window.setTimeout(step, 250)
  }, [kind])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { text, status, play }
}

export function Agents() {
  const { phase } = usePhase()
  const [kind, setKind] = useState<HeroKind>("switch")
  useEffect(() => setKind(heroKind()), [])
  const { text, status, play } = useReplay(kind)
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()
        play()
      },
      // the reply starts as the thread comes up the screen, so it is already writing when the
      // thread is in full view (at 40% in view, an empty box sat waiting)
      { rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [play])

  return (
    <section className={styles.section} aria-labelledby="agents-title">
      <div className={styles.agents}>
        <Reveal>
          <h2 id="agents-title" className={styles.h2}>
            <Letters>Made for agents.</Letters>
          </h2>
          <p className={styles.lead}>
            The whole API is generated into <code>llms.txt</code>, never written by hand, so it
            cannot drift. And every component ships a driver, so an assistant can check its own work
            the way you would.
          </p>
          <div className={styles.agentsActs}>
            <a href="/llms.txt" className={styles.agentsLink}>
              Read llms.txt ↗
            </a>
            <Button
              className={styles.agentsReplay}
              onPress={play}
              disabled={status === "streaming"}
            >
              Replay
            </Button>
          </div>
          <p className={styles.agentsNote}>A replay of a session, not a live model.</p>
        </Reveal>
        <div ref={stage} className={styles.agentsStage} data-skinned="" data-skin={phase}>
          <MessageThread.Root className={styles.agentsThread} count={2} lastFromUser={false}>
            <MessageThread.Viewport>
              <MessageThread.Message index={0} from="user">
                {SESSIONS[kind].ask}
              </MessageThread.Message>
              <MessageThread.Message index={1} from="assistant">
                <StreamingMessage.Root text={text} status={status} announce="none">
                  {/* a long line scrolls inside the bubble: reachable by keyboard to scroll it */}
                  <StreamingMessage.Content tabIndex={0} />
                  <StreamingMessage.Caret />
                </StreamingMessage.Root>
              </MessageThread.Message>
            </MessageThread.Viewport>
          </MessageThread.Root>
        </div>
      </div>
    </section>
  )
}
