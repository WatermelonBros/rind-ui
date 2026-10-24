/**
 * One way to say where the frameworks stand, everywhere on the site (the hero, the install, the
 * docs sidebar): released, in progress (its package has components but no release yet) or
 * planned (none yet).
 */
export interface FrameworkState {
  readonly name: string
  readonly ready: boolean
  readonly count: number
}

export const stateWord = (f: FrameworkState) =>
  f.ready ? "available" : f.count > 0 ? "in progress" : "planned"

const list = (names: readonly string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`

/** "Vue and Svelte in progress · Solid and Angular planned" */
export function upcoming(frameworks: readonly FrameworkState[]): string {
  const progress = frameworks.filter((f) => !f.ready && f.count > 0).map((f) => f.name)
  const planned = frameworks.filter((f) => !f.ready && f.count === 0).map((f) => f.name)
  return [
    progress.length ? `${list(progress)} in progress` : "",
    planned.length ? `${list(planned)} planned` : "",
  ]
    .filter(Boolean)
    .join(" · ")
}
