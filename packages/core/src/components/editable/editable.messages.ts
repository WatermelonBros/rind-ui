// Editable's strings (spec "Editable Messages").

export interface EditableMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The EditTrigger's name, before the Label. */
  readonly edit: string
  readonly submit: string
  readonly cancel: string
}

export const editableMessages: EditableMessages = { edit: "Edit", submit: "Save", cancel: "Cancel" }
