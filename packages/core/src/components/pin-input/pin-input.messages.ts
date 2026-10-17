/**
 * The Pin Input's messages. It sets no accessible string of its own: its name is the Field's
 * Label, and the validity messages (`valueMissing`, `patternMismatch`) are the Field's.
 */
export type PinInputMessages = Readonly<Record<never, never>>

export const pinInputMessages: PinInputMessages = {}
