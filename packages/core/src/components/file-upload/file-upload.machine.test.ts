// File Upload's rules in Node: file records, a recording announcer, a recording input sync.
import { describe, expect, it } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import type { FileLike } from "../shared/file-validation"
import {
  type FileUploadEvent,
  type FileUploadProps,
  fileUploadMachine,
} from "./file-upload.machine"
import { fileUploadMessages } from "./file-upload.messages"

const f = (name: string, size = 10, type = "") => ({ name, size, type })

function make(over: Partial<FileUploadProps> = {}) {
  const log: Announcement[] = []
  const changes: { names: string[]; reason: string }[] = []
  const rejected: { name: string; reason: string; code?: string }[][] = []
  const syncs: { names: string[]; dispatch: boolean }[] = []
  let opened = 0
  let props: FileUploadProps = {
    id: "u",
    messages: fileUploadMessages,
    onFilesChange: (files, d) =>
      changes.push({ names: files.map((x) => x.name), reason: d.reason }),
    onReject: (r) =>
      rejected.push(
        r.map((x) => ({
          name: x.file.name,
          reason: x.reason,
          ...(x.code ? { code: x.code } : {}),
        })),
      ),
    ...over,
  }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    openPicker: () => {
      opened++
    },
    syncInput: (files: readonly FileLike[], dispatch: boolean) =>
      syncs.push({ names: files.map((x) => x.name), dispatch }),
  }
  const s = createService(fileUploadMachine, props, env)
  s.start()
  const held = () => s.view(props as never).values.files.map((x) => x.name)
  const setProps = (next: Partial<FileUploadProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const add = (
    files: FileLike[],
    source: "pick" | "drop" | "paste" | "api" = "drop",
    refused?: FileLike[],
  ) =>
    s.send({ type: "FILES.ADD", files, source, ...(refused ? { refused } : {}) } as FileUploadEvent)
  return { s, log, changes, rejected, syncs, held, setProps, add, opened: () => opened }
}

const said = (log: readonly Announcement[]) => log.map((a) => [a.message, a.priority])

describe("file-upload machine: validation", () => {
  it("the empty type falls back to the extension (zag#2571)", () => {
    const m = make({ accept: "video/*" })
    m.add([f("clip.mov")])
    expect(m.held()).toEqual(["clip.mov"])
  })

  it("only the surplus is refused (kobalte#572)", () => {
    const m = make({ maxFiles: 3, defaultFiles: [f("held.txt")] })
    m.add([f("1.txt"), f("2.txt"), f("3.txt"), f("4.txt")])
    expect(m.held()).toEqual(["held.txt", "1.txt", "2.txt"])
    expect(m.rejected[0]).toEqual([
      { name: "3.txt", reason: "MAX_FILES" },
      { name: "4.txt", reason: "MAX_FILES" },
    ])
  })

  it("single: replaced, kept on rejection (zag#1903)", () => {
    const m = make({ accept: ".pdf", defaultFiles: [f("a.pdf")] })
    m.add([f("b.pdf")], "pick")
    expect(m.held()).toEqual(["b.pdf"])
    m.add([f("c.png")], "pick")
    expect(m.held()).toEqual(["b.pdf"])
    expect(m.rejected.at(-1)).toEqual([{ name: "c.png", reason: "ACCEPT" }])
  })

  it("duplicates: against the held files and within the gesture (zag#3048)", () => {
    const m = make({ maxFiles: 5, defaultFiles: [f("a.pdf", 10, "application/pdf")] })
    m.add([f("a.pdf", 10, "application/pdf"), f("b.pdf"), f("b.pdf")])
    expect(m.held()).toEqual(["a.pdf", "b.pdf"])
    expect(m.rejected[0]?.map((r) => r.reason)).toEqual(["DUPLICATE", "DUPLICATE"])
  })

  it("every reason in order: directory, accept, min, max, custom", () => {
    const folder = { name: "pics", type: "", size: 0, directory: true }
    const m = make({
      maxFiles: 9,
      accept: [".txt", ".bin"],
      minFileSize: 2,
      maxFileSize: 100,
      validate: (file) => (file.name.startsWith("bad") ? "nope" : null),
    })
    m.add([folder, f("x.png"), f("small.txt", 1), f("big.txt", 500), f("bad.txt"), f("ok.bin")])
    expect(m.held()).toEqual(["ok.bin"])
    expect(m.rejected[0]).toEqual([
      { name: "pics", reason: "DIRECTORY" },
      { name: "x.png", reason: "ACCEPT" },
      { name: "small.txt", reason: "MIN_SIZE" },
      { name: "big.txt", reason: "MAX_SIZE" },
      { name: "bad.txt", reason: "CUSTOM", code: "nope" },
    ])
  })

  it("unreadable entries of a folder drop are CUSTOM unreadable; the rest is kept", () => {
    const m = make({ maxFiles: 9, directory: true })
    m.add([f("ok.txt")], "drop", [f("broken.txt")])
    expect(m.held()).toEqual(["ok.txt"])
    expect(m.rejected[0]).toEqual([{ name: "broken.txt", reason: "CUSTOM", code: "unreadable" }])
  })
})

describe("file-upload machine: writes and announcements", () => {
  it("the whole list on every change, with the reason (kobalte#571)", () => {
    const m = make({ maxFiles: 5, defaultFiles: [f("b.pdf")] })
    m.add([f("a.pdf")], "pick")
    const held = m.s.view().values.files
    m.s.send({ type: "FILE.REMOVE", file: held[0] as FileLike })
    expect(m.changes).toEqual([
      { names: ["b.pdf", "a.pdf"], reason: "add" },
      { names: ["a.pdf"], reason: "remove" },
    ])
  })

  it("a user change syncs the input with input and change; an api one silently", () => {
    const m = make({ maxFiles: 5 })
    m.add([f("a.txt")], "drop")
    m.add([f("b.txt")], "api")
    expect(m.syncs).toEqual([
      { names: ["a.txt"], dispatch: true },
      { names: ["a.txt", "b.txt"], dispatch: false },
    ])
    expect(m.changes.at(-1)?.reason).toBe("api")
  })

  it("one announcement per gesture: added polite, rejected assertive", () => {
    const m = make({ maxFiles: 5, accept: "image/*" })
    m.add([f("a.png"), f("b.exe")])
    expect(said(m.log)).toEqual([
      ["a.png added", "polite"],
      ["b.exe is not an accepted file type", "assertive"],
    ])
    m.add([f("c.png"), f("d.png"), f("e.png")])
    expect(said(m.log).at(-1)).toEqual(["3 files added", "polite"])
  })

  it("removed twice: the second does nothing", () => {
    const m = make({ maxFiles: 5 })
    m.add([f("a.txt")])
    const file = m.s.view().values.files[0] as FileLike
    m.s.send({ type: "FILE.REMOVE", file })
    m.s.send({ type: "FILE.REMOVE", file })
    expect(m.changes.filter((c) => c.reason === "remove")).toHaveLength(1)
  })

  it("clear removes everything, announced once", () => {
    const m = make({ maxFiles: 5 })
    m.add([f("a.txt"), f("b.txt")])
    m.s.send({ type: "FILES.CLEAR" })
    expect(m.held()).toEqual([])
    expect(said(m.log).at(-1)).toEqual(["All files removed", "polite"])
  })

  it("reset restores the current default, clears rejections, no change dispatched", () => {
    const m = make({ maxFiles: 5, accept: ".txt" })
    m.add([f("a.txt"), f("x.png")])
    m.setProps({ defaultFiles: [f("d.txt")] })
    m.s.send({ type: "RESET" })
    expect(m.held()).toEqual(["d.txt"])
    expect(m.s.getSnapshot().context.rejections).toEqual([])
    expect(m.syncs.at(-1)).toEqual({ names: ["d.txt"], dispatch: false })
    expect(m.changes.at(-1)?.reason).toBe("reset")
  })
})

describe("file-upload machine: controlled, disabled, read-only, drag", () => {
  it("controlled refusal: the value stays, the input is re-synced", () => {
    const m = make({ files: [] })
    m.add([f("a.txt")], "pick")
    // The parent renders again without applying the list.
    m.setProps({ files: [] })
    expect(m.held()).toEqual([])
    expect(m.syncs.at(-1)).toEqual({ names: [], dispatch: false })
  })

  it("controlled arrival: mirrored with input and change", () => {
    const m = make({ files: [] })
    m.add([f("a.txt")], "pick")
    const proposed = m.changes.at(-1)
    expect(proposed?.names).toEqual(["a.txt"])
    // The parent applies the very list it was given.
    const list = (m.s.getSnapshot().context.pending?.files ?? []) as FileLike[]
    m.setProps({ files: list })
    expect(m.held()).toEqual(["a.txt"])
    expect(m.syncs.at(-1)).toEqual({ names: ["a.txt"], dispatch: true })
  })

  it("disabled and read-only ignore adds, removes, the picker and drags", () => {
    for (const over of [{ disabled: true }, { readOnly: true }]) {
      const m = make({ maxFiles: 5, defaultFiles: [f("keep.txt")], ...over })
      m.add([f("a.txt")])
      m.s.send({ type: "FILES.CLEAR" })
      m.s.send({ type: "PICKER.OPEN" })
      m.s.send({ type: "DRAG.ENTER" })
      expect(m.held()).toEqual(["keep.txt"])
      expect(m.opened()).toBe(0)
      expect(m.s.getSnapshot().state).toBe("idle")
      expect(m.log).toEqual([])
    }
  })

  it("drag enter and leave; a drop ends the drag", () => {
    const m = make({ maxFiles: 5 })
    m.s.send({ type: "DRAG.ENTER" })
    expect(m.s.getSnapshot().state).toBe("dragging")
    m.add([f("a.txt")])
    expect(m.s.getSnapshot().state).toBe("idle")
    m.s.send({ type: "DRAG.ENTER" })
    m.s.send({ type: "DRAG.LEAVE" })
    expect(m.s.getSnapshot().state).toBe("idle")
  })

  it("the picker opens through the injected effect", () => {
    const m = make()
    m.s.send({ type: "PICKER.OPEN" })
    expect(m.opened()).toBe(1)
  })
})
