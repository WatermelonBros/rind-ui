// The typed values of every named Field in a form, for `validate(value, values)`.

const forms = new WeakMap<HTMLFormElement, Map<string, () => unknown>>()

/** Registers a Field's value reader under its name in its form; returns the cleanup. */
export function registerFormValue(
  form: HTMLFormElement,
  name: string,
  read: () => unknown,
): () => void {
  let fields = forms.get(form)
  if (!fields) {
    fields = new Map()
    forms.set(form, fields)
  }
  fields.set(name, read)
  return () => {
    if (fields.get(name) === read) fields.delete(name)
  }
}

export function formValues(form: HTMLFormElement | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, read] of forms.get(form as HTMLFormElement) ?? []) out[name] = read()
  return out
}
