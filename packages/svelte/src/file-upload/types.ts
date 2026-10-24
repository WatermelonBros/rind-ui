import type {
  ChangeDetails,
  DropSource,
  FileLike,
  FileRejection,
  FileUploadEvent,
  FileUploadMessages,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLImgAttributes,
  HTMLLiAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "file-upload": FileUploadMessages
  }
}

/** What every part's snippets receive. */
export interface FileUploadRenderState<F extends FileLike = File> {
  readonly files: readonly F[]
  readonly rejections: readonly FileRejection<F>[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}
type State = FileUploadRenderState<FileLike>
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<State>]> | undefined
  readonly children?: Snippet<[State]> | undefined
}
export type FileUploadRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The held files; `bind:files` controls them. */
  files?: readonly FileLike[] | undefined
  /** Uncontrolled initial files; a later change only changes what a form reset restores. */
  readonly defaultFiles?: readonly FileLike[] | undefined
  /** The whole new list; `details.reason`: "add", "remove", "clear", "reset" or "api". */
  readonly onFilesChange?:
    | ((files: readonly FileLike[], details: ChangeDetails<FileUploadEvent>) => void)
    | undefined
  /** MIME types, `type/*` and `.ext`; an empty type falls back to the extension. */
  readonly accept?: string | readonly string[] | undefined
  /** The most files held (default 1: a new file replaces the held one). */
  readonly maxFiles?: number | undefined
  /** The largest file, in bytes. */
  readonly maxFileSize?: number | undefined
  /** The smallest file, in bytes. */
  readonly minFileSize?: number | undefined
  /** Take folders: `webkitdirectory` on the chooser, traversal on drop. */
  readonly directory?: boolean | undefined
  /** A code rejects the file (`CUSTOM`). */
  readonly validate?:
    | ((file: FileLike, context: { readonly files: readonly FileLike[] }) => string | null)
    | undefined
  /** Once per gesture with any rejection. */
  readonly onReject?: ((rejections: readonly FileRejection<FileLike>[]) => void) | undefined
  /** Where drops come from (default: the DOM). A Tauri window's drag-drop events, for example. */
  readonly dropSource?: DropSource<FileLike> | undefined
  /** A file dropped outside the Dropzone does not navigate the page. Default true. */
  readonly preventDocumentDrop?: boolean | undefined
  /** The native `capture` hint (camera on mobile). */
  readonly capture?: "user" | "environment" | undefined
  /** The form field name. */
  readonly name?: string | undefined
  /** The form id, when the File Upload is outside it. */
  readonly form?: string | undefined
  readonly disabled?: boolean | undefined
  /** Focusable and submitted, but nothing is added or removed. */
  readonly readonly?: boolean | undefined
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly messages?: MessageOverrides<FileUploadMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type FileUploadSpanProps = Part<HTMLAttributes<HTMLSpanElement>>
export type FileUploadDivProps = Part<HTMLAttributes<HTMLDivElement>>
export type FileUploadButtonProps = Part<HTMLButtonAttributes>
export type FileUploadItemGroupProps = Part<HTMLAttributes<HTMLUListElement>>
export type FileUploadItemProps = Part<HTMLLiAttributes> & {
  /** The held file this Item shows. */
  readonly file: FileLike
}
export type FileUploadItemPreviewProps = Omit<HTMLImgAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<State>]> | undefined
}
