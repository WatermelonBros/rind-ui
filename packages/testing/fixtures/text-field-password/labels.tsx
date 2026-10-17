// Near-miss names for the `{ label }` locator: each pair differs only by a suffix, through a
// <label>, aria-label and aria-labelledby. Shared by the DOM adapter test and the pw page.
import { TextField } from "@rind-ui/react"

export const labelledValues = {
  "Password confirmation": "confirm",
  "Master password": "master",
  "Master password hint": "hint",
  "Recovery password": "recovery",
  "Recovery password backup": "backup",
} as const

export function LabelledFields() {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <TextField.Root type="password" defaultValue="confirm">
        <TextField.Label>Password confirmation</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <TextField.Root type="password" defaultValue="master">
        <TextField.Input aria-label="Master password" />
      </TextField.Root>
      <TextField.Root type="password" defaultValue="hint">
        <TextField.Input aria-label="Master password hint" />
      </TextField.Root>
      <span id="recovery-label">Recovery password</span>
      <span id="backup-label">Recovery password backup</span>
      <TextField.Root type="password" defaultValue="recovery">
        <TextField.Input aria-labelledby="recovery-label" />
      </TextField.Root>
      <TextField.Root type="password" defaultValue="backup">
        <TextField.Input aria-labelledby="backup-label" />
      </TextField.Root>
    </div>
  )
}
