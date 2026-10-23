import type { ValidationBehavior, ValidationMode } from "../components/field"
import type { FormField } from "../components/form/form.machine"

/** What a Form gives the Fields inside it (each adapter provides it through its context). */
export interface FormBinding {
  readonly validationMode?: ValidationMode | undefined
  readonly validationBehavior?: ValidationBehavior | undefined
  /** The server errors for a name, the same array while `errors` is the same object. */
  errorsFor(name: string | undefined): readonly string[] | undefined
  register(field: FormField): () => void
  /** A Field's async check settled (a held submission may go on). */
  settled(): void
  /** Who asked for the reset in progress: a user, or the framework after an action. */
  resetOrigin(): "user" | "framework"
}
