import { domEnvironment } from "@rind-ui/core"
import { afterEach, expect, it } from "vitest"
import { installAnnouncementLog } from "./announcements"
import { liveAnnouncements, spokenLog } from "./virtual-sr"

// Frames, not elapsed time: the announcer writes its regions on the next frame.
const frames = (n: number) =>
  new Promise<void>((resolve) => {
    let left = n
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })

afterEach(() => {
  document.body.innerHTML = ""
})

it("the virtual screen reader hears exactly what the recording log records", async () => {
  const env = domEnvironment()
  env.announcer.prepare()
  const recorded = installAnnouncementLog()
  const start = recorded.length
  const log = await spokenLog(document.body, async () => {
    env.announcer.announce({ message: "Copied" })
    await frames(3)
    env.announcer.announce({ message: "Copied" })
    env.announcer.announce({ message: "Upload failed", priority: "assertive" })
    await frames(3)
  })
  const heard = liveAnnouncements(log)
  expect(heard.map((a) => a.message)).toEqual(["Copied", "Copied", "Upload failed"])
  expect(heard.map((a) => a.message)).toEqual(recorded.slice(start).map((a) => a.message))
  expect(heard.at(-1)?.priority).toBe("assertive")
})
