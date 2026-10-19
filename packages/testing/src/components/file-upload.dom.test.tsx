// File Upload through its driver (spec file-upload): name and summary, the chooser, drops,
// drags, pastes, removal focus, clear, the form (submit, reset), rejections, disabled and
// read-only, controlled, IDREFs.
import type { DropSink, FileLike } from "@rind-ui/core"
import { FileUpload, type FileUploadRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { getFileUpload, recordingAnnouncer } from "../index"

const spec = (name: string, type = "text/plain", content = "x") => ({ name, type, content })

function Upload(props: Partial<FileUploadRootProps>) {
  return (
    <FileUpload.Root name="docs" {...props}>
      <FileUpload.Label>Documents</FileUpload.Label>
      <FileUpload.Dropzone>
        Drop files here
        <FileUpload.Trigger>Choose file</FileUpload.Trigger>
      </FileUpload.Dropzone>
      <FileUploadList />
      <FileUpload.ClearTrigger>Clear</FileUpload.ClearTrigger>
    </FileUpload.Root>
  )
}

/** The Items, rendered from the Root's render state through the ItemGroup. */
function FileUploadList() {
  return (
    <FileUpload.ItemGroup
      render={(props, state) => (
        <ul {...props}>
          {state.files.map((file) => (
            <FileUpload.Item key={`${file.name}-${file.size}`} file={file}>
              <FileUpload.ItemName />
              <FileUpload.ItemSize />
              <FileUpload.ItemRemove>×</FileUpload.ItemRemove>
            </FileUpload.Item>
          ))}
        </ul>
      )}
    />
  )
}

function setup(node: React.ReactNode) {
  const rec = recordingAnnouncer()
  render(
    <RindProvider announcer={rec.announcer}>
      {node}
      <button type="button">After</button>
    </RindProvider>,
  )
  return { log: rec.log, d: getFileUpload(screen, { name: /Choose file/ }) }
}

const input = () =>
  document.querySelector<HTMLInputElement>('[data-scope="file-upload"][data-part="hidden-input"]')
const trigger = () => screen.getByRole("button", { name: /Choose file/ })

const danglingRefs = () => {
  const out: string[] = []
  for (const el of document.querySelectorAll("[aria-labelledby], [aria-describedby]")) {
    for (const attr of ["aria-labelledby", "aria-describedby"]) {
      for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) out.push(`${attr}=${id}`)
      }
    }
  }
  return out
}

describe("file-upload: anatomy", () => {
  it("one Trigger named by the Label then itself, described by the summary", async () => {
    const { d } = setup(<Upload />)
    expect(trigger().getAttribute("aria-labelledby")?.split(" ")).toHaveLength(2)
    expect(await d.summary()).toBe("No file chosen")
    expect(input()?.getAttribute("aria-hidden")).toBe("true")
    expect(input()?.tabIndex).toBe(-1)
    const zone = document.querySelector('[data-part="dropzone"]')
    expect(zone?.getAttribute("role")).toBeNull()
    expect(zone?.getAttribute("tabindex")).toBeNull()
    expect(danglingRefs()).toEqual([])
  })
})

describe("file-upload: adding", () => {
  it("the chooser: files held, the summary and the announcement follow", async () => {
    const { d, log } = setup(<Upload maxFiles={5} />)
    await d.choose([spec("a.txt"), spec("b.txt")])
    expect(await d.files()).toEqual(["a.txt", "b.txt"])
    expect(await d.summary()).toBe("2 files")
    expect(log.at(-1)?.message).toBe("2 files added")
  })

  it("a drop adds; data-dragging between enter and leave", async () => {
    const { d } = setup(<Upload maxFiles={5} />)
    await d.dragEnter()
    expect(await d.isDragging()).toBe(true)
    await d.dragLeave()
    expect(await d.isDragging()).toBe(false)
    await d.drop([spec("dropped.txt")])
    expect(await d.files()).toEqual(["dropped.txt"])
  })

  it("a paste of files on the Trigger adds them", async () => {
    const { d } = setup(<Upload maxFiles={5} />)
    await d.paste([spec("pasted.png", "image/png")])
    expect(await d.files()).toEqual(["pasted.png"])
  })

  it("single: a new file replaces the held one", async () => {
    const { d } = setup(<Upload />)
    await d.choose([spec("one.txt")])
    await d.choose([spec("two.txt")])
    expect(await d.files()).toEqual(["two.txt"])
    expect(await d.summary()).toBe("two.txt")
  })

  it("rejections: assertive announcement and onReject once per gesture", async () => {
    const onReject = vi.fn()
    const { d, log } = setup(<Upload maxFiles={5} accept="image/*" onReject={onReject} />)
    await d.drop([spec("a.png", "image/png"), spec("b.exe", "application/x-msdownload")])
    expect(await d.files()).toEqual(["a.png"])
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(log.at(-1)).toMatchObject({
      message: "b.exe is not an accepted file type",
      priority: "assertive",
    })
  })
})

describe("file-upload: removing", () => {
  it("Remove moves focus to the next Remove, then the previous, then the Trigger", async () => {
    const { d } = setup(<Upload maxFiles={5} />)
    await d.choose([spec("a.txt"), spec("b.txt")])
    await d.remove("a.txt")
    expect(await d.files()).toEqual(["b.txt"])
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove b.txt" }))
    await d.remove("b.txt")
    expect(await d.files()).toEqual([])
    expect(document.activeElement).toBe(trigger())
  })

  it("clear: every file, focus on the Trigger, the ClearTrigger gone", async () => {
    const { d, log } = setup(<Upload maxFiles={5} />)
    await d.choose([spec("a.txt"), spec("b.txt")])
    await d.clear()
    expect(await d.files()).toEqual([])
    expect(document.activeElement).toBe(trigger())
    expect(screen.queryByRole("button", { name: "Remove all files" })).toBeNull()
    expect(log.at(-1)?.message).toBe("All files removed")
  })
})

describe("file-upload: forms and states", () => {
  it("form reset restores the default", async () => {
    const { d } = setup(
      <form>
        <Upload maxFiles={5} />
        <button type="reset">Reset</button>
      </form>,
    )
    await d.choose([spec("a.txt")])
    await d.resetForm()
    expect(await d.files()).toEqual([])
  })

  it("disabled: the Trigger is disabled, a drop adds nothing", async () => {
    const { d } = setup(<Upload maxFiles={5} disabled />)
    expect(trigger()).toHaveProperty("disabled", true)
    expect(await d.isDisabled()).toBe(true)
    await act(async () => {
      document
        .querySelector('[data-part="dropzone"]')
        ?.dispatchEvent(Object.assign(new Event("drop", { bubbles: true, cancelable: true })))
    })
    expect(await d.files()).toEqual([])
  })

  it("read-only: focusable, aria-disabled, the chooser stays shut", async () => {
    setup(<Upload readOnly />)
    const click = vi.spyOn(HTMLInputElement.prototype, "click")
    await userEvent.click(trigger())
    expect(trigger().getAttribute("aria-disabled")).toBe("true")
    expect(click).not.toHaveBeenCalled()
  })

  it("the Trigger opens the chooser through the input, once", async () => {
    setup(<Upload />)
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {})
    await userEvent.click(trigger())
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("controlled: the parent's list is held; a refused proposal changes nothing", async () => {
    function Controlled({ accept }: { readonly accept: boolean }) {
      const [files, setFiles] = useState<readonly File[]>([])
      return (
        <Upload maxFiles={5} files={files} onFilesChange={(next) => accept && setFiles(next)} />
      )
    }
    const first = setup(<Controlled accept />)
    await first.d.choose([spec("a.txt")])
    expect(await first.d.files()).toEqual(["a.txt"])
    document.body.innerHTML = ""
    const second = setup(<Controlled accept={false} />)
    await second.d.choose([spec("b.txt")])
    expect(await second.d.files()).toEqual([])
  })
})

describe("file-upload: intake edges", () => {
  it("a custom drop source feeds the same validation (path records never reach the input)", async () => {
    let sink: DropSink<FileLike> | null = null
    const source = (_zone: HTMLElement, s: DropSink<FileLike>) => {
      sink = s
      return () => {}
    }
    const { d } = setup(<Upload maxFiles={5} accept=".txt" dropSource={source as never} />)
    await act(async () => {
      sink?.enter()
    })
    expect(await d.isDragging()).toBe(true)
    await act(async () => {
      sink?.drop([
        { name: "a.txt", type: "", size: 3 },
        { name: "b.png", type: "", size: 3 },
      ])
    })
    expect(await d.files()).toEqual(["a.txt"])
    expect(await d.isDragging()).toBe(false)
  })

  it("a cancelled chooser (an empty change) keeps the files", async () => {
    const { d } = setup(<Upload maxFiles={5} />)
    await d.choose([spec("a.txt")])
    await d.choose([])
    expect(await d.files()).toEqual(["a.txt"])
  })

  it("a file dropped outside the Dropzone does not navigate", () => {
    setup(<Upload />)
    const drop = new Event("drop", { bubbles: true, cancelable: true })
    Object.defineProperty(drop, "dataTransfer", { value: { types: ["Files"], files: [] } })
    document.body.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
  })

  it.runIf(typeof DataTransfer === "function")(
    "a form submits exactly the held files",
    async () => {
      let names: string[] = []
      const { d } = setup(
        <form
          onSubmit={(e) => {
            e.preventDefault()
            names = (new FormData(e.currentTarget).getAll("docs") as File[]).map((f) => f.name)
          }}
        >
          <Upload maxFiles={5} />
          <button type="submit">Send</button>
        </form>,
      )
      await d.choose([spec("a.txt"), spec("b.txt")])
      await d.remove("a.txt")
      await userEvent.click(screen.getByRole("button", { name: "Send" }))
      expect(names).toEqual(["b.txt"])
    },
  )

  it("server HTML: the Trigger, the hidden input and the summary", () => {
    const html = renderToString(
      <RindProvider>
        <Upload />
      </RindProvider>,
    )
    expect(html).toContain('type="file"')
    expect(html).toContain("No file chosen")
    expect(html).toContain('data-part="trigger"')
  })
})
