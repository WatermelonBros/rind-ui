import { describe, expect, it } from "vitest"
import { createService } from "../machine/service"
import { presenceMachine } from "./presence.machine"

// A waitForExit whose resolution the test controls, recording each call's signal.
function make() {
  const calls: { signal: AbortSignal; resolve: () => void }[] = []
  const service = createService(
    presenceMachine,
    {},
    {
      presence: {
        waitForExit: (signal) =>
          new Promise<void>((resolve) => {
            calls.push({ signal, resolve })
          }),
      },
    },
  )
  service.start()
  const state = () => service.getSnapshot().state as string
  return { service, calls, state }
}

// Drain microtasks: the machine settles through promise callbacks only.
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe("presence machine", () => {
  it("starts absent and OPEN makes it present", () => {
    const { service, state } = make()
    expect(state()).toBe("absent")
    service.send({ type: "OPEN" })
    expect(state()).toBe("present")
  })

  it("ignores CLOSE and EXIT_DONE when absent, and OPEN/EXIT_DONE when present", () => {
    const { service, state } = make()
    service.send({ type: "CLOSE" })
    service.send({ type: "EXIT_DONE" })
    expect(state()).toBe("absent")
    service.send({ type: "OPEN" })
    service.send({ type: "EXIT_DONE" })
    expect(state()).toBe("present")
  })

  it("CLOSE enters exiting and calls waitForExit; resolving it reaches absent", async () => {
    const { service, calls, state } = make()
    service.send({ type: "OPEN" })
    service.send({ type: "CLOSE" })
    expect(state()).toBe("exiting")
    expect(calls).toHaveLength(1)
    calls[0]?.resolve()
    await flush()
    expect(state()).toBe("absent")
  })

  it("OPEN during exiting returns to present, aborts the signal and ignores a late resolve", async () => {
    const { service, calls, state } = make()
    service.send({ type: "OPEN" })
    service.send({ type: "CLOSE" })
    const call = calls[0]
    expect(call?.signal.aborted).toBe(false)
    service.send({ type: "OPEN" })
    expect(state()).toBe("present")
    expect(call?.signal.aborted).toBe(true)
    call?.resolve()
    await flush()
    expect(state()).toBe("present")
  })

  it("stop() during exiting aborts the signal", () => {
    const { service, calls } = make()
    service.send({ type: "OPEN" })
    service.send({ type: "CLOSE" })
    service.stop()
    expect(calls[0]?.signal.aborted).toBe(true)
  })

  it("a second close after reopening waits again with a fresh signal", async () => {
    const { service, calls, state } = make()
    service.send({ type: "OPEN" })
    service.send({ type: "CLOSE" })
    service.send({ type: "OPEN" })
    service.send({ type: "CLOSE" })
    expect(calls).toHaveLength(2)
    expect(calls[1]?.signal.aborted).toBe(false)
    calls[1]?.resolve()
    await flush()
    expect(state()).toBe("absent")
  })
})
