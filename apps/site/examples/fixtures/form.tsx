"use client"

// Ported from apps/storybook/stories/Form.stories.tsx
// ServerErrorsStory: renamed, the docs module already exports ServerErrors.
import { Button, Field, Form, type FormActions, Portal } from "@rind-ui/react"
import { type ComponentProps, type ReactNode, useActionState, useRef, useState } from "react"
import { FieldInput } from "../../../../packages/testing/fixtures/field/field-input"
import type { States, Variants } from "../types"

export const states: States = {
  form: { idle: "SignUp" },
}

const layout = { maxWidth: "24rem" } as const
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The buttons and the counter every story shares; nothing here submits natively. */
function Actions({ count, validate }: { count: number; validate?: () => void }) {
  return (
    <>
      <div style={{ display: "flex", gap: "var(--rind-space-2)" }}>
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
        {validate && (
          <Button type="button" onClick={validate}>
            Validate
          </Button>
        )}
      </div>
      <p>Submissions: {count}</p>
    </>
  )
}

/** A Form that counts what it submits, so no story ever navigates. */
function Counted({
  children,
  label = "Sign up",
  validate = false,
  onValues,
  ...props
}: Omit<ComponentProps<typeof Form.Root>, "onFormSubmit" | "aria-label"> & {
  label?: string
  validate?: boolean
  onValues?: (values: Readonly<Record<string, unknown>>) => void
}) {
  const [count, setCount] = useState(0)
  const actions = useRef<FormActions>(null)
  return (
    <Form.Root
      aria-label={label}
      style={layout}
      actionsRef={actions}
      onFormSubmit={(values) => {
        setCount((n) => n + 1)
        onValues?.(values)
      }}
      {...props}
    >
      {children}
      <Actions
        count={count}
        {...(validate ? { validate: () => actions.current?.validate() } : {})}
      />
    </Form.Root>
  )
}

const field = (name: string, label: string, control: ReactNode) => (
  <Field.Root name={name}>
    <Field.Label>{label}</Field.Label>
    {control}
    <Field.ErrorMessage />
  </Field.Root>
)

/** Client validation: the confirmation compares against `values.password`. */
export function SignUp() {
  return (
    <Counted validate>
      {field("email", "Email", <FieldInput type="email" required />)}
      {field("password", "Password", <FieldInput type="password" required minLength={8} />)}
      <Field.Root
        name="confirm"
        validate={(value, values) => (value === values["password"] ? null : "Passwords differ.")}
      >
        <Field.Label>Confirm password</Field.Label>
        <FieldInput type="password" required />
        <Field.ErrorMessage />
      </Field.Root>
    </Counted>
  )
}

/** The check takes 500 ms; the submission is held until it settles. */
export function AsyncUsername() {
  return (
    <Counted>
      <Field.Root
        name="username"
        validate={async (value) => {
          await wait(500)
          return value === "taken" ? "That username is taken." : null
        }}
      >
        <Field.Label>Username</Field.Label>
        <FieldInput required />
        <Field.Description>Try "taken".</Field.Description>
        <Field.ErrorMessage />
      </Field.Root>
    </Counted>
  )
}

/** The server answers after a submission: "Simulate server" delivers its errors. */
export function ServerErrorsStory() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  return (
    <>
      <Counted errors={errors}>{field("email", "Email", <FieldInput type="email" />)}</Counted>
      <Button type="button" onClick={() => setErrors({ email: "Already registered" })}>
        Simulate server
      </Button>
    </>
  )
}

/** React 19 `useActionState`: the action's errors go straight to the Form. */
export function ActionState() {
  const [state, action] = useActionState(
    async (prev: { count: number; errors: Record<string, string> }, data: FormData) => {
      await wait(100)
      const taken = data.get("email") === "taken@example.com"
      return {
        count: prev.count + 1,
        errors: taken ? { email: "Already registered" } : {},
      }
    },
    { count: 0, errors: {} },
  )
  return (
    <Form.Root aria-label="Sign up" style={layout} action={action} errors={state.errors}>
      {field("email", "Email", <FieldInput type="email" />)}
      <Actions count={state.count} />
    </Form.Root>
  )
}

/** The typed values of every named Field. */
export function Values() {
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>({})
  return (
    <Counted onValues={setValues}>
      {field("name", "Name", <FieldInput />)}
      {field("email", "Email", <FieldInput type="email" />)}
      <pre>{JSON.stringify(values)}</pre>
    </Counted>
  )
}

/** `aria` behaviour: no native bubble; the Fields display their errors. */
export function AriaBehavior() {
  return (
    <Counted validationBehavior="aria">
      {field("email", "Email", <FieldInput type="email" required />)}
    </Counted>
  )
}

/** Reset clears the values and the errors. */
export function ResetForm() {
  return <Counted>{field("email", "Email", <FieldInput type="email" required />)}</Counted>
}

/** HTML forbids a form inside a form: the inner one is portalled out. */
export function NestedForm() {
  return (
    <Counted label="Outer" validationMode="blur">
      {field("name", "Name", <FieldInput required />)}
      <Portal>
        <Counted label="Inner">{field("code", "Code", <FieldInput required />)}</Counted>
      </Portal>
    </Counted>
  )
}

export const variants: Variants = {
  SignUp: { title: "Sign up", hidden: true },
  AsyncUsername: { title: "Async username", hidden: true },
  ServerErrorsStory: { title: "Server errors", hidden: true },
  ActionState: { title: "Action state", hidden: true },
  Values: { title: "Values", hidden: true },
  AriaBehavior: { title: "Aria behavior", hidden: true },
  ResetForm: { title: "Reset form", hidden: true },
  NestedForm: { title: "Nested form", hidden: true },
}
