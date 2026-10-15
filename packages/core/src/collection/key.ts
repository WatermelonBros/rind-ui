// Collection keys: plain strings at run time, branded at compile time so an element id or
// a label cannot be passed where a key is expected inside @rind-ui/core. Component props
// take plain strings and brand them at that boundary with `toKey`.

declare const keyBrand: unique symbol

/** A collection key. Brand plain strings with `toKey` at a component boundary. */
export type CollectionKey = string & { readonly [keyBrand]: true }

/** Brands a string as a key. Sound: keys are plain strings at run time. */
export const toKey = (value: string): CollectionKey => value as CollectionKey
