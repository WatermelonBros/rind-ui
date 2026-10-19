// The page file-upload.pw.test.ts drives: a themed File Upload holding up to five files, in a form.
import { FileUpload, RindProvider } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function App() {
  return (
    <RindProvider>
      <form style={{ display: "grid", gap: 16, padding: 24, maxInlineSize: 420 }}>
        <FileUpload.Root name="docs" maxFiles={5}>
          <FileUpload.Label>Documents</FileUpload.Label>
          <FileUpload.Dropzone>
            Drop files here
            <FileUpload.Trigger>Choose file</FileUpload.Trigger>
          </FileUpload.Dropzone>
          <FileUpload.ItemGroup
            render={(props, { files }) => (
              <ul {...props}>
                {files.map((file) => (
                  <FileUpload.Item key={file.name} file={file}>
                    <FileUpload.ItemName />
                    <FileUpload.ItemSize />
                    <FileUpload.ItemRemove />
                  </FileUpload.Item>
                ))}
              </ul>
            )}
          />
        </FileUpload.Root>
        <button type="reset">Reset</button>
      </form>
    </RindProvider>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
