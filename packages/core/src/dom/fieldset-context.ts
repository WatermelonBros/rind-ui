// The disabled scope rind-ui Fieldsets give their descendants (fieldset design §2). Each
// adapter passes it down through its context mechanism, so portalled parts follow it too;
// the native DOM rule is fieldset-disabled.ts. Both apply HTML's first-legend exemption.

export interface FieldsetScope {
  /** This Fieldset's own `disabled` prop. */
  readonly disabled: boolean
  readonly parent: FieldsetScope | null
}

/** Disabled by this Fieldset or any enclosing one. */
export function scopeDisabled(scope: FieldsetScope | null): boolean {
  for (let s = scope; s; s = s.parent) if (s.disabled) return true
  return false
}

/**
 * The scope a Fieldset's first Legend gives its content: exempt from that Fieldset (as in
 * HTML), still disabled by the enclosing ones.
 */
export function legendScope(scope: FieldsetScope | null): FieldsetScope | null {
  return scope?.parent ?? null
}
