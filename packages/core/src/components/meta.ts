// The shape of a component's API facts (`<scope>.meta.ts`), rendered into its docs page and
// llms.txt by scripts/docs-gen.ts. Each meta file is checked against the code by a test.

export interface ComponentMeta {
  readonly scope: string
  readonly name: string
  /** No machine: the page has no states table and no `testMachine` section. */
  readonly stateless: boolean
  readonly parts: readonly {
    readonly name: string
    readonly part: string
    readonly element: string
    readonly description: string
  }[]
  readonly props: Readonly<
    Record<
      string,
      { readonly type: string; readonly default?: string; readonly description: string }
    >
  >
  /** Per part: attribute → when it is present (or its value). */
  readonly dataAttributes: Readonly<Record<string, Readonly<Record<`data-${string}`, string>>>>
  readonly keyboard: readonly (readonly [key: string, behaviour: string])[]
  readonly contract: {
    /** Action → the modalities it runs in. */
    readonly actions: Readonly<Record<string, readonly string[]>>
    readonly queries: readonly string[]
    readonly traits: readonly string[]
  }
}
