// The delay group capability: members (tooltips) coordinate through it, so at most one is
// open and the next one opens at once while the group is warm. Machines reach it only
// through the environment, so it is faked in Node.

/** What the group asks of a member: close at once, because another member opened. */
export interface DelayGroupMember {
  replace(): void
}

export interface DelayGroup {
  /** Registers a member (its instance id) while its service runs; returns `leave`. */
  join(id: string, member: DelayGroupMember): (skipDelay: number) => void
  /** A member is open, or the skip window after the last close is running. */
  isWarm(): boolean
  /** `id` opened: any other open member is replaced. */
  opened(id: string): void
  /** `id` closed: the group stays warm for `skipDelay` ms (`<= 0`: cold at once). */
  closed(id: string, skipDelay: number): void
}

export interface DelayGroupEnv {
  readonly delayGroup: DelayGroup
}
