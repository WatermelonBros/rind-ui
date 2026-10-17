// The Color Picker's flush registry (design §8): every Color Field in its content registers its
// `flush`; the picker flushes them all before it closes, so a typed hex survives an outside
// press (React does not blur an unmounting input: react-spectrum#9748).

export interface FlushRegistry {
  register(flush: () => void): () => void
  /** Commits every valid pending draft (and discards the rest), in registration order. */
  flushAll(): void
}

export function createFlushRegistry(): FlushRegistry {
  const all = new Set<() => void>()
  return {
    register(flush) {
      all.add(flush)
      return () => {
        all.delete(flush)
      }
    },
    flushAll() {
      for (const flush of [...all]) flush()
    },
  }
}
