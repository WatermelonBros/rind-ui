// The shape of a component's API facts (`<scope>.meta.ts`), rendered into its docs page and
// llms.txt by scripts/docs-gen.ts. Each meta file is checked against the code by a test.

export interface PropMeta {
  readonly type: string
  readonly default?: string
  readonly description: string
}

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
  /**
   * Overrides what the docs say about a prop: every prop a part declares is listed from the
   * types (its JSDoc is the description), so an entry here is only for better wording, a default,
   * a DOM attribute with behaviour of its own, or a part-scoped key (`Item.value`).
   */
  readonly props: Readonly<Record<string, PropMeta>>
  /** Options of functions the component ships (`createToaster`), not props of a part. */
  readonly options?: Readonly<Record<string, PropMeta>>
  /** Per part: attribute → when it is present (or its value). */
  readonly dataAttributes: Readonly<Record<string, Readonly<Record<`data-${string}`, string>>>>
  readonly keyboard: readonly (readonly [key: string, behaviour: string])[]
  /** Machine states (`data-state` values) and what each means; components with a machine. */
  readonly states?: Readonly<Record<string, string>>
  readonly contract: {
    /** Action → the modalities it runs in. */
    readonly actions: Readonly<Record<string, readonly string[]>>
    readonly queries: readonly string[]
    readonly traits: readonly string[]
  }
}
