// Table of Contents' strings: the landmark's name when no Title is rendered.

export interface TableOfContentsMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly label: string
}

export const tableOfContentsMessages: TableOfContentsMessages = {
  label: "On this page",
}
