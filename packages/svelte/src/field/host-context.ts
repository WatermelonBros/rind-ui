import { createContext } from "../context"

export const fieldHost = createContext<{
  readonly scope: string
  /** True: this Root is the Field; false: it joined an enclosing Field. */
  readonly standalone: boolean
}>("field-host")
