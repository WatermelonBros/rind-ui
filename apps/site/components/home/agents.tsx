"use client"

import { Button, MessageThread, StreamingMessage } from "@rind-ui/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePhase } from "../phase"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

type Status = "pending" | "streaming" | "complete"

const ASK = "Add a settings dialog with a dark mode switch. Test it."

// A replay of the loop the section describes, with rind's real parts and driver calls.
const REPLY = `Read llms.txt: Dialog and Switch are both ready.

<Dialog.Root>
  <Dialog.Trigger>Settings</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Title>Settings</Dialog.Title>
        <Switch.Root>
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <Switch.Label>Dark mode</Switch.Label>
        </Switch.Root>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Portal>
</Dialog.Root>

Now I check my own work with the drivers:

const settings = getDialog(screen, { name: "Settings" })
await settings.open()
const dark = getSwitch(screen, { name: "Dark mode" })
await dark.toggle()
expect(await dark.isChecked()).toBe(true)

✓ 1 test passed`

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Streams the reply in bursts the first time the thread scrolls into view; Replay plays it again. */
function useReplay() {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<Status>("pending")
  const timer = useRef(0)
  const play = useCallback(() => {
    clearTimeout(timer.current)
    if (reduced()) {
      setText(REPLY)
      setStatus("complete")
      return
    }
    setText("")
    setStatus("pending")
    const words = REPLY.split(/(?<=\s)/)
    let i = 0
    const step = () => {
      i = Math.min(words.length, i + 2 + Math.floor(Math.random() * 4))
      const done = i >= words.length
      setText(words.slice(0, i).join(""))
      setStatus(done ? "complete" : "streaming")
      if (!done) timer.current = window.setTimeout(step, 40 + Math.random() * 70)
    }
    timer.current = window.setTimeout(step, 600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { text, status, play }
}

export function Agents() {
  const { phase } = usePhase()
  const { text, status, play } = useReplay()
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
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [play])

  return (
    <section className={styles.section} aria-labelledby="agents-title">
      <div className={styles.agents}>
        <Reveal>
          <h2 id="agents-title" className={styles.h2}>
            Made for agents.
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
                {ASK}
              </MessageThread.Message>
              <MessageThread.Message index={1} from="assistant">
                <StreamingMessage.Root text={text} status={status} announce="none">
                  <StreamingMessage.Content />
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
