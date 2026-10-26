// JSON Tree View's strings (spec "JSON Tree View Messages"); copy uses Clipboard's.

import type { JsonType } from "./json-tree"

export interface JsonTreeViewMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** A container's spoken summary ("object, 4 entries"). */
  readonly summary: (type: JsonType, count: number) => string
  /** A cycle's text. */
  readonly circular: string
  /** A range group's label ("0 … 99"). */
  readonly range: (first: number, last: number) => string
}

const NOUN: Partial<Record<JsonType, string>> = {
  object: "object",
  array: "array",
  map: "map",
  set: "set",
  error: "error",
}

export const jsonTreeViewMessages: JsonTreeViewMessages = {
  summary: (type, count) => `${NOUN[type] ?? type}, ${count} ${count === 1 ? "entry" : "entries"}`,
  circular: "circular reference",
  range: (first, last) => `${first} … ${last}`,
}
