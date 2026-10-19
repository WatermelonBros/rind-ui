// Model-based tests (add-file-upload 6.2): the drag and reset edges over single, multiple and
// disabled configurations, in a form; every modality, the generic invariants, axe and the File
// Upload invariants. The files themselves are the DOM tests' (events skipped in the contract).
import { fileUploadContract, fileUploadMessages } from "@rind-ui/core"
import { FileUpload, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, recordingAnnouncer, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

interface Config {
  readonly maxFiles: number
  readonly disabled?: boolean
}

function variant(name: string, cfg: Config) {
  const rec = recordingAnnouncer()
  describe(`file-upload model: ${name}`, () => {
    testMachine(fileUploadContract, {
      test: it,
      setup: () =>
        render(
          <RindProvider announcer={rec.announcer}>
            <form>
              <FileUpload.Root name="docs" maxFiles={cfg.maxFiles} disabled={cfg.disabled === true}>
                <FileUpload.Label>Documents</FileUpload.Label>
                <FileUpload.Dropzone>
                  Drop files here
                  <FileUpload.Trigger>Choose file</FileUpload.Trigger>
                </FileUpload.Dropzone>
              </FileUpload.Root>
              <button type="reset">Reset</button>
            </form>
          </RindProvider>,
        ),
      target: () => domEnv(),
      anchor: [{ name: /Choose file/ }],
      props: {
        id: "oracle",
        messages: fileUploadMessages,
        maxFiles: cfg.maxFiles,
        disabled: cfg.disabled === true,
        readOnly: false,
      },
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    } as never)
  })
}

variant("single", { maxFiles: 1 })
variant("multiple", { maxFiles: 5 })
variant("disabled", { maxFiles: 5, disabled: true })
