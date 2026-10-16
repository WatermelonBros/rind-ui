// Breadcrumbs' strings: the landmark's name and the ellipsis trigger's name.

import { plural } from "../../i18n/messages"

export interface BreadcrumbsMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The `navigation` landmark's name, unless the Root is labelled. */
  readonly label: string
  /** The ellipsis trigger's name for `count` collapsed items. */
  readonly showCollapsed: (count: number) => string
}

export const breadcrumbsMessages: BreadcrumbsMessages = {
  label: "Breadcrumbs",
  // English plural rules: a translation supplies its own forms.
  showCollapsed: (count) =>
    plural("en", count, { one: "Show # more breadcrumb", other: "Show # more breadcrumbs" }),
}
