// Fixture for add-field: the smallest form control implementing field-control on a native
// <input>. Not a public component: Text Field gets its own change and replaces it.
import { focusSafely, mergeFieldProps } from "@rind-ui/core"
import { mergeProps, normalizeProps, useEnvironment, useFieldControl } from "@rind-ui/react"
import { type ComponentPropsWithRef, useEffect, useId, useLayoutEffect, useRef } from "react"

export type FieldInputProps = Omit<ComponentPropsWithRef<"input">, "ref"> & {
  readonly invalid?: boolean
}

export function FieldInput({
  id,
  disabled,
  readOnly,
  required,
  invalid,
  name,
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  onChange,
  onKeyDown,
  value,
  ...rest
}: FieldInputProps) {
  const binding = useFieldControl()
  const env = useEnvironment()
  const generated = useId()
  const own = id ?? binding?.controlId ?? generated
  const el = useRef<HTMLInputElement | null>(null)
  const register = binding?.register
  useLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: own,
        labelable: true,
        focus: (modality) => {
          if (el.current) void focusSafely(el.current, env, "programmatic", modality)
        },
        validityElement: () => el.current,
        value: () => el.current?.value ?? "",
      },
      own,
    )
  }, [register, own, env])
  const field = mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled,
      readOnly,
      required,
      invalid,
      name,
      consumerDescribedBy: describedBy,
      ariaLabel,
      ariaLabelledBy,
    },
    binding,
  )
  const report = binding?.report
  // A controlled value changed by the parent is reported as a non-user change; the value the
  // user just typed (already reported by onChange) is not reported twice.
  const lastValue = useRef<unknown>(value)
  useEffect(() => {
    if (value === undefined || Object.is(value, lastValue.current)) return
    lastValue.current = value
    report?.({ type: "change", value, user: false, composing: false })
  }, [value, report])
  const props = mergeProps(
    normalizeProps({
      ...binding?.data,
      id: own,
      name: field.name,
      disabled: field.disabled || undefined,
      readonly: field.readOnly || undefined,
      required: field.required || undefined,
      "aria-label": ariaLabel,
      "aria-required": field["aria-required"],
      "aria-invalid": field["aria-invalid"],
      "aria-describedby": field["aria-describedby"],
      "aria-labelledby": field["aria-labelledby"],
      "aria-errormessage": field["aria-errormessage"],
    }),
    {
      ref: el,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        lastValue.current = e.currentTarget.value
        report?.({
          type: "change",
          value: e.currentTarget.value,
          user: true,
          composing: (e.nativeEvent as InputEvent).isComposing === true,
        })
        onChange?.(e)
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") report?.({ type: "commit" })
        onKeyDown?.(e)
      },
    },
    rest,
  )
  return <input {...props} {...(value === undefined ? {} : { value })} />
}
