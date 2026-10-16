// Pagination's strings (spec "Messages"): the landmark name and the controls' names when
// they have no text of their own. `page(n)` contains the visible number (WCAG 2.5.3).

export interface PaginationMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly label: string
  readonly page: (page: number) => string
  readonly first: string
  readonly previous: string
  readonly next: string
  readonly last: string
}

export const paginationMessages: PaginationMessages = {
  label: "Pagination",
  page: (page) => `Page ${page}`,
  first: "First page",
  previous: "Previous page",
  next: "Next page",
  last: "Last page",
}
