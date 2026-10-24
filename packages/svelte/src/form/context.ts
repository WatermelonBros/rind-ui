import type { FormBinding } from "@rind-ui/core/internal"
import { createContext } from "../context"

export type { FormBinding }
export const formContext = createContext<FormBinding | null>("form")

/** The enclosing Form, or null (a Field works in a plain `<form>` too). */
export const useFormBinding = (): FormBinding | null => formContext.maybe() ?? null
