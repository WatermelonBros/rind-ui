// add-file-upload 1.2: drag presence by the set of entered elements, folder traversal in
// batches, unreadable entries refused without losing the drop.
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  dragPresence,
  dropzoneClickOpens,
  filePath,
  filesFromDataTransfer,
  isDroppedFolder,
} from "./file-intake"

afterEach(() => {
  document.body.innerHTML = ""
})

/** A drag event carrying files (jsdom has no DragEvent/DataTransfer). */
function drag(type: string, target: Element, related: Element | null = null) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, "dataTransfer", {
    value: { types: ["Files"], items: [], files: [], dropEffect: "none" },
  })
  Object.defineProperty(e, "relatedTarget", { value: related })
  target.dispatchEvent(e)
  return e
}

describe("dragPresence", () => {
  it("keeps the drag while a child is entered, whatever relatedTarget says (WebKit 66547)", () => {
    document.body.innerHTML = '<div id="zone"><span id="child">x</span></div>'
    const zone = document.getElementById("zone") as HTMLElement
    const child = document.getElementById("child") as HTMLElement
    const enter = vi.fn()
    const leave = vi.fn()
    const drop = vi.fn()
    const stop = dragPresence(zone, { enter, leave, drop })
    drag("dragenter", zone)
    drag("dragenter", child)
    // WebKit: a dragleave on the zone with relatedTarget null while over the child.
    drag("dragleave", zone, null)
    expect(enter).toHaveBeenCalledTimes(1)
    expect(leave).not.toHaveBeenCalled()
    const over = drag("dragover", child)
    expect(over.defaultPrevented).toBe(true)
    drag("drop", child)
    expect(leave).toHaveBeenCalledTimes(1)
    expect(drop).toHaveBeenCalledTimes(1)
    stop()
  })

  it("leaves when every entered element is left, or the drag ends on the document", () => {
    document.body.innerHTML = '<div id="zone"></div>'
    const zone = document.getElementById("zone") as HTMLElement
    const leave = vi.fn()
    const stop = dragPresence(zone, { enter: () => {}, leave, drop: () => {} })
    drag("dragenter", zone)
    drag("dragleave", zone)
    expect(leave).toHaveBeenCalledTimes(1)
    drag("dragenter", zone)
    document.dispatchEvent(new Event("dragend"))
    expect(leave).toHaveBeenCalledTimes(2)
    stop()
  })

  it("refused: dropEffect none, no enter, no drop", () => {
    document.body.innerHTML = '<div id="zone"></div>'
    const zone = document.getElementById("zone") as HTMLElement
    const enter = vi.fn()
    const drop = vi.fn()
    const stop = dragPresence(zone, { enter, leave: () => {}, drop, refuse: () => true })
    drag("dragenter", zone)
    const over = drag("dragover", zone)
    expect(
      (over as unknown as { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect,
    ).toBe("none")
    drag("drop", zone)
    expect(enter).not.toHaveBeenCalled()
    expect(drop).not.toHaveBeenCalled()
    stop()
  })
})

/** A fake folder entry whose reader returns the given batches, then an empty one. */
function folder(name: string, batches: readonly unknown[][]) {
  let i = 0
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => ({
      readEntries: (ok: (e: unknown[]) => void) => ok(batches[i++] ?? []),
    }),
  }
}
const fileEntry = (name: string, fail = false) => ({
  isFile: true,
  isDirectory: false,
  name,
  file: (ok: (f: File) => void, err: (e: unknown) => void) =>
    fail ? err(new Error("unreadable")) : ok(new File(["x"], name)),
})
const item = (entry: unknown) => ({
  kind: "file",
  getAsFile: () => null,
  webkitGetAsEntry: () => entry,
})

describe("filesFromDataTransfer", () => {
  it("reads every batch of a folder (zag#2252), keeping paths", async () => {
    const a = Array.from({ length: 100 }, (_, n) => fileEntry(`a${n}.txt`))
    const b = Array.from({ length: 30 }, (_, n) => fileEntry(`b${n}.txt`))
    const data = { items: [item(folder("docs", [a, b]))] }
    const { files } = await filesFromDataTransfer(data as never, { directory: true })
    expect(files).toHaveLength(130)
    expect(filePath(files[0] as File)).toBe("docs/a0.txt")
  })

  it("an unreadable entry is refused, the rest kept", async () => {
    const data = { items: [item(folder("d", [[fileEntry("ok.txt"), fileEntry("bad.txt", true)]]))] }
    const { files, refused } = await filesFromDataTransfer(data as never, { directory: true })
    expect(files.map((f) => f.name)).toEqual(["ok.txt"])
    expect(refused.map((f) => f.name)).toEqual(["bad.txt"])
  })

  it("without directory a folder is a DroppedFolder", async () => {
    const data = { items: [item(folder("pics", [[fileEntry("a.png")]]))] }
    const { files } = await filesFromDataTransfer(data as never)
    expect(files).toHaveLength(1)
    expect(isDroppedFolder(files[0])).toBe(true)
  })
})

describe("dropzoneClickOpens", () => {
  it("plain content opens even under a focusable ancestor (a Dialog); controls inside do not", () => {
    document.body.innerHTML = `<div tabindex="-1"><div id="z"><span id="t">Drop files</span><button id="b">Browse</button><label id="l">x</label></div></div>`
    const zone = document.getElementById("z") as Element
    const at = (id: string) => document.getElementById(id) as Element
    expect(dropzoneClickOpens(at("t"), zone)).toBe(true)
    expect(dropzoneClickOpens(zone, zone)).toBe(true)
    expect(dropzoneClickOpens(at("b"), zone)).toBe(false)
    expect(dropzoneClickOpens(at("l"), zone)).toBe(false)
    document.body.innerHTML = ""
  })
})
