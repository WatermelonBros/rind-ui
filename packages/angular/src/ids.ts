import { APP_ID, Injectable, inject } from "@angular/core"

/**
 * Root ids for one application. Angular has no `useId`; a counter per application (not per
 * module, which a server would share across requests) gives the server and the hydrating client
 * the same ids, as both create the instances in the same order.
 */
@Injectable({ providedIn: "root" })
export class RindIds {
  private readonly prefix = inject(APP_ID)
  private count = 0
  next(): string {
    return `${this.prefix}-${this.count++}`
  }
}

/** The instance's root id: the consumer's `id`, or the application's next one. */
export function injectRootId(id: () => string | undefined): () => string {
  const generated = inject(RindIds).next()
  return () => id() ?? generated
}
