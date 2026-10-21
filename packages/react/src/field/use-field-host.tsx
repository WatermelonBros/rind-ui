"use client"

// The Root-as-Field helper (text-field design §3): a control's Root that is not inside a
// Field becomes one (the Field's machine and parts, under the control's scope); inside a
// Field it only joins it, and its own Label / Description / ErrorMessage render nothing.
// Text Field, Number Input, Pin Input, Password Input and Search Field Roots use it.
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
} from "react"
import {
  type FieldErrorMessageProps,
  type FieldRootProps,
  useFieldBindingPeek,
  useFieldControl,
  useIsInsideField,
} from "./field"
import * as Field from "./field.parts"

declare const process: { env: { NODE_ENV?: string } }

interface HostCtx {
  readonly scope: string
  /** True: this Root is the Field; false: it joined an enclosing Field. */
  readonly standalone: boolean
}
const HostContext = createContext<HostCtx | null>(null)

export type FieldHostProps = FieldRootProps & {
  readonly scope: string
  /** Inside a Field: the root's `data-part` (default `root`; a host's part names its own). */
  readonly rootPart?: string
  /** The host's parts. */
  readonly children?: ReactNode
}

/**
 * Renders the host's root: a Field (standalone) or, inside a Field, a plain `div` with the
 * scope attributes and the Field's state attributes.
 */
export function FieldHost({ scope, rootPart, children, ...fieldProps }: FieldHostProps) {
  const inside = useIsInsideField()
  if (!inside) {
    return (
      <HostContext value={{ scope, standalone: true }}>
        <Field.Root {...fieldProps} scope={scope} {...(rootPart ? { rootPart } : {})}>
          {children}
        </Field.Root>
      </HostContext>
    )
  }
  return (
    <JoinedRoot scope={scope} rootPart={rootPart ?? "root"} fieldProps={fieldProps}>
      {children}
    </JoinedRoot>
  )
}

function JoinedRoot({
  scope,
  rootPart,
  fieldProps,
  children,
}: {
  readonly scope: string
  readonly rootPart: string
  readonly fieldProps: FieldRootProps
  readonly children?: ReactNode
}) {
  // The host's own Field props are ignored inside a Field: the enclosing Field decides.
  const binding = useFieldBindingPeek()
  const { id, ...rest } = fieldProps as FieldRootProps & Record<string, unknown>
  const plain = Object.fromEntries(
    Object.entries(rest).filter(
      ([k]) => k.startsWith("data-") || k.startsWith("aria-") || k === "className" || k === "style",
    ),
  )
  return (
    <HostContext value={{ scope, standalone: false }}>
      <div
        data-scope={scope}
        data-part={rootPart}
        data-instance={typeof id === "string" ? id : undefined}
        {...binding?.data}
        {...(id === undefined ? {} : { id })}
        {...plain}
      >
        {children}
      </div>
    </HostContext>
  )
}

/** The host's scope and whether it is the Field itself. */
export function useFieldHost(): HostCtx {
  const ctx = useContext(HostContext)
  if (!ctx) throw new Error("a Field host part must be inside its Root")
  return ctx
}

/** A host's Label / Description / ErrorMessage: the Field's when standalone, else nothing. */
function useHostPart(name: string): boolean {
  const { standalone, scope } = useFieldHost()
  useEffect(() => {
    if (!standalone && process.env.NODE_ENV !== "production") {
      console.warn(
        `[rind-ui] ${scope}: its ${name} is not rendered inside a Field; use the Field's ${name}.`,
      )
    }
  }, [standalone, scope, name])
  return standalone
}

export function HostLabel(props: ComponentPropsWithRef<typeof Field.Label>) {
  return useHostPart("Label") ? <Field.Label {...props} /> : null
}
export function HostDescription(props: ComponentPropsWithRef<typeof Field.Description>) {
  return useHostPart("Description") ? <Field.Description {...props} /> : null
}
export function HostErrorMessage(props: FieldErrorMessageProps) {
  return useHostPart("ErrorMessage") ? <Field.ErrorMessage {...props} /> : null
}

export { useFieldControl }
