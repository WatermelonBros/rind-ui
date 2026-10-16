// Near-miss names for the `{ label }` locator: each pair differs only by a suffix, through a
// <label>, aria-label and aria-labelledby. Shared by the DOM adapter test and the pw page.
import { PasswordInput } from "@rind-ui/react"

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
      <PasswordInput.Root defaultValue="confirm">
        <PasswordInput.Label>Password confirmation</PasswordInput.Label>
        <PasswordInput.Input />
      </PasswordInput.Root>
      <PasswordInput.Root defaultValue="master">
        <PasswordInput.Input aria-label="Master password" />
      </PasswordInput.Root>
      <PasswordInput.Root defaultValue="hint">
        <PasswordInput.Input aria-label="Master password hint" />
      </PasswordInput.Root>
      <span id="recovery-label">Recovery password</span>
      <span id="backup-label">Recovery password backup</span>
      <PasswordInput.Root defaultValue="recovery">
        <PasswordInput.Input aria-labelledby="recovery-label" />
      </PasswordInput.Root>
      <PasswordInput.Root defaultValue="backup">
        <PasswordInput.Input aria-labelledby="backup-label" />
      </PasswordInput.Root>
    </div>
  )
}
