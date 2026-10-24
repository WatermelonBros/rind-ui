/** What a `child` snippet receives: the props to spread on its element, and the state. */
export interface ChildArgs<S> {
  readonly props: Record<string, unknown>
  readonly state: S
}
