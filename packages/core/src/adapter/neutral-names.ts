// Connect's output is neutral (HTML attribute names, `onInput`, `onFocusIn`), but some parts
// still spell a prop the React way (`htmlFor`, `tabIndex`, `defaultValue`, `onChange`): React
// reads both. The other adapters fold those spellings back to the neutral names first.

const ATTRIBUTES: Readonly<Record<string, string>> = {
  className: "class",
  htmlFor: "for",
  tabIndex: "tabindex",
  readOnly: "readonly",
  autoComplete: "autocomplete",
  autoCapitalize: "autocapitalize",
  autoCorrect: "autocorrect",
  autoFocus: "autofocus",
  spellCheck: "spellcheck",
  maxLength: "maxlength",
  minLength: "minlength",
  inputMode: "inputmode",
  enterKeyHint: "enterkeyhint",
  contentEditable: "contenteditable",
  colSpan: "colspan",
  rowSpan: "rowspan",
  dateTime: "datetime",
  crossOrigin: "crossorigin",
  accessKey: "accesskey",
  referrerPolicy: "referrerpolicy",
  hrefLang: "hreflang",
  noValidate: "novalidate",
  srcSet: "srcset",
  // `defaultValue` / `defaultChecked` (an uncontrolled field's initial value) stay: each
  // adapter writes them so the DOM keeps the user's edits.
}

const HANDLERS: Readonly<Record<string, string>> = {
  // React's onChange on form controls fires on every input; its onFocus/onBlur bubble.
  onChange: "onInput",
  onFocus: "onFocusIn",
  onBlur: "onFocusOut",
  onDoubleClick: "onDblClick",
}

/** The neutral name of a connect prop key (unchanged when it already is one). */
export const neutralName = (key: string): string => ATTRIBUTES[key] ?? HANDLERS[key] ?? key
