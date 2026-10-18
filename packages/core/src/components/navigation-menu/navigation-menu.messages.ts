/** Navigation Menu's messages (English defaults), overridable per instance and through the provider. */
export const navigationMenuMessages = {
  /** The landmark's name when no `aria-label` or `aria-labelledby` is given. */
  label: "Main",
} as const satisfies Record<string, string>

export type NavigationMenuMessages = { readonly label: string }
