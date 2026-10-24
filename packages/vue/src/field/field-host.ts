// The Root-as-Field helper (text-field design §3): a control's Root that is not inside a Field
// becomes one (the Field's machine and parts, under the control's scope); inside a Field it
// only joins it, and its own Label / Description / ErrorMessage render nothing. Text Field,
// Number Input, Pin Input, Password Input and Search Field Roots use it.
import { defineComponent, h, type InjectionKey, inject, onMounted, provide } from "vue"
import { fieldRootProps, useFieldBindingPeek, useIsInsideField } from "./context"
import * as Field from "./field.parts"

declare const process: { env: { NODE_ENV?: string } }

interface HostCtx {
  readonly scope: string
  /** True: this Root is the Field; false: it joined an enclosing Field. */
  readonly standalone: boolean
}
const HostKey: InjectionKey<HostCtx> = Symbol("rind-ui.field-host")

/**
 * Renders the host's root: a Field (standalone) or, inside a Field, a plain `div` with the
 * scope attributes and the Field's state attributes.
 */
export const FieldHost = defineComponent({
  name: "FieldHost",
  inheritAttrs: false,
  props: {
    ...fieldRootProps,
    scope: { type: String, required: true },
    /** Inside a Field: the root's `data-part` (default `root`). */
    rootPart: String,
  },
  setup(props, { attrs, slots }) {
    const inside = useIsInsideField()
    const binding = useFieldBindingPeek()
    provide(HostKey, { scope: props.scope, standalone: !inside })
    return () => {
      if (!inside) {
        // Only the props that were passed: an absent Boolean is not `false` for the Field.
        const given = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined))
        return h(Field.Root, { ...attrs, ...given }, slots)
      }
      // The host's own Field props are ignored inside a Field: the enclosing Field decides.
      const plain = Object.fromEntries(
        Object.entries(attrs).filter(
          ([k]) => k.startsWith("data-") || k.startsWith("aria-") || k === "class" || k === "style",
        ),
      )
      return h(
        "div",
        {
          "data-scope": props.scope,
          "data-part": props.rootPart ?? "root",
          "data-instance": props.id,
          ...binding?.value.data,
          ...(props.id === undefined ? {} : { id: props.id }),
          ...plain,
        },
        slots["default"]?.(),
      )
    }
  },
})

/** The host's scope and whether it is the Field itself. */
export function useFieldHost(): HostCtx {
  const ctx = inject(HostKey, null)
  if (!ctx) throw new Error("a Field host part must be inside its Root")
  return ctx
}

/** A host's Label / Description / ErrorMessage: the Field's when standalone, else nothing. */
function hostPart(
  name: "Label" | "Description" | "ErrorMessage",
  part: (typeof Field)[typeof name],
) {
  return defineComponent({
    name: `FieldHost${name}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const { standalone, scope } = useFieldHost()
      onMounted(() => {
        if (!standalone && process.env.NODE_ENV !== "production") {
          console.warn(
            `[rind-ui] ${scope}: its ${name} is not rendered inside a Field; use the Field's ${name}.`,
          )
        }
      })
      return () => (standalone ? h(part, attrs, slots) : null)
    },
  })
}
export const HostLabel = hostPart("Label", Field.Label)
export const HostDescription = hostPart("Description", Field.Description)
export const HostErrorMessage = hostPart("ErrorMessage", Field.ErrorMessage)
