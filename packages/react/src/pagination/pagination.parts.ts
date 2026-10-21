// The Pagination namespace: a module namespace (not an object), so bundlers drop the parts a
// consumer never references.
// biome-ignore assist/source/organizeImports: the order of the parts is the order of their docs
export {
  Root,
  List,
  Item,
  Page,
  Ellipsis,
  First,
  Previous,
  Next,
  Last,
} from "./pagination"
