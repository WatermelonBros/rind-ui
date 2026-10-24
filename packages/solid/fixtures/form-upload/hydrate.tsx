/** @jsxImportSource solid-js */
import { Clipboard } from "../../src/clipboard"
import { FileUpload } from "../../src/file-upload"
import { Form } from "../../src/form"
import { TextField } from "../../src/text-field"

export function App() {
  return (
    <Form.Root aria-label="Profile">
      <TextField.Root name="handle" required>
        <TextField.Label>Handle</TextField.Label>
        <TextField.Input />
        <TextField.ErrorMessage />
      </TextField.Root>
      <FileUpload.Root name="docs">
        <FileUpload.Label>Documents</FileUpload.Label>
        <FileUpload.Dropzone>
          Drop files here
          <FileUpload.Trigger>Choose file</FileUpload.Trigger>
        </FileUpload.Dropzone>
      </FileUpload.Root>
      <Clipboard.Root value="sk-123">
        <Clipboard.Label>API key</Clipboard.Label>
        <Clipboard.Control>
          <Clipboard.Input />
          <Clipboard.Trigger>
            <Clipboard.Indicator>⧉</Clipboard.Indicator>
          </Clipboard.Trigger>
        </Clipboard.Control>
      </Clipboard.Root>
      <button type="submit">Save</button>
    </Form.Root>
  )
}
