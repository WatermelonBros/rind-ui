import { type MessageOverrides, scopeAttrs, streamAnnouncement } from "@rind-ui/core"
import { useEnvironment, useMessages } from "@rind-ui/react"
import { useEffect, useId, useState } from "react"

/** The fixture's AT strings, English by default. */
export const streamMessages = { label: "Stream" }

declare module "@rind-ui/react" {
  interface RindMessageScopes {
    stream: typeof streamMessages
  }
}

/** Streams "Hel", "lo", " there" into the environment's announcer when pressed. */
export function StreamFixture({
  messages,
}: {
  readonly messages?: MessageOverrides<typeof streamMessages>
}) {
  const env = useEnvironment()
  const m = useMessages("stream", streamMessages, messages)
  const id = useId()
  const [done, setDone] = useState(false)
  useEffect(() => env.announcer.prepare(), [env])
  const run = () => {
    const stream = streamAnnouncement(env.announcer, {
      key: id,
      locale: env.locale.locale(),
      scheduler: env.scheduler,
    })
    const chunks = ["Hel", "lo", " there"]
    for (const [i, chunk] of chunks.entries()) {
      env.scheduler.setTimeout(() => stream.push(chunk), i * 10)
    }
    env.scheduler.setTimeout(() => {
      stream.complete()
      setDone(true)
    }, chunks.length * 10)
  }
  return (
    <button
      type="button"
      {...scopeAttrs("stream", "root", id)}
      data-done={String(done)}
      onClick={run}
    >
      {m.label}
    </button>
  )
}
