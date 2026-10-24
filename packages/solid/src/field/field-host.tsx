/** @jsxImportSource solid-js */
// The Root-as-Field helper (text-field design §3): a control's Root that is not inside a Field
// becomes one (the Field's machine and parts, under the control's scope); inside a Field it
// only joins it, and its own Label / Description / ErrorMessage render nothing. Text Field,
// Number Input, Pin Input, Password Input and Search Field Roots use it.
import { createContext, createMemo, type JSX, splitProps, untrack, useContext } from "solid-js"
import { afterMount } from "../lifecycle"
import { useFieldBindingPeek, useIsInsideField } from "./context"
import type { FieldErrorMessageProps, FieldRootProps } from "./field"
import * as Field from "./field.parts"

declare const process: { env: { NODE_ENV?: string } }

interface HostCtx {
  readonly scope: string
  /** True: this Root is the Field; false: it joined an enclosing Field. */
  readonly standalone: boolean
}
const HostContext = createContext<HostCtx>()

export type FieldHostProps = Omit<FieldRootProps, "children"> & {
  readonly scope: string
  readonly children?: JSX.Element
}

/**
 * Renders the host's root: a Field (standalone) or, inside a Field, a plain `div` with the
 * scope attributes and the Field's state attributes.
 */
export function FieldHost(props: FieldHostProps) {
  const [local, rest] = splitProps(props, ["scope", "rootPart", "attrs", "children"])
  const inside = useIsInsideField()
  const binding = useFieldBindingPeek()
  // The host's own Field props are ignored inside a Field: the enclosing Field decides.
  const plain = createMemo(() =>
    Object.fromEntries(
      Object.entries(rest).filter(
        ([k]) => k.startsWith("data-") || k.startsWith("aria-") || k === "class" || k === "style",
      ),
    ),
  )
  // Built untracked: whether the Root is inside a Field never changes, and reading the spread
  // props while constructing would make the whole subtree depend on them (and rebuild it).
  return (
    <HostContext.Provider value={{ scope: local.scope, standalone: !inside }}>
      {untrack(() =>
        inside ? (
          <div
            data-scope={local.scope}
            data-part={local.rootPart ?? "root"}
            data-instance={rest.id}
            {...binding?.().data}
            {...local.attrs?.()}
            {...(rest.id === undefined ? {} : { id: rest.id })}
            {...plain()}
          >
            {local.children}
          </div>
        ) : (
          <Field.Root {...rest} scope={local.scope} rootPart={local.rootPart} attrs={local.attrs}>
            {local.children}
          </Field.Root>
        ),
      )}
    </HostContext.Provider>
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
  afterMount(() => {
    if (!standalone && process.env.NODE_ENV !== "production") {
      console.warn(
        `[rind-ui] ${scope}: its ${name} is not rendered inside a Field; use the Field's ${name}.`,
      )
    }
  })
  return standalone
}

export function HostLabel(props: Parameters<typeof Field.Label>[0]): JSX.Element {
  return useHostPart("Label") ? <Field.Label {...props} /> : null
}
export function HostDescription(props: Parameters<typeof Field.Description>[0]): JSX.Element {
  return useHostPart("Description") ? <Field.Description {...props} /> : null
}
export function HostErrorMessage(props: FieldErrorMessageProps): JSX.Element {
  return useHostPart("ErrorMessage") ? <Field.ErrorMessage {...props} /> : null
}
