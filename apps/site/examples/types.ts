/** Titles for a component's live examples, keyed by the exported function's name, in page order. */
export type Variants = Readonly<
  Record<string, { readonly title: string; readonly description?: string }>
>
