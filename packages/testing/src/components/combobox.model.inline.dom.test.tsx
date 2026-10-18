// The Combobox model over the inline props classes (a command palette; combobox-model.tsx):
// the inline machine's graph has the single state `open`.
import { config } from "./combobox-model"

config("inline", { inline: true })
config("inline, closable by a host", { inline: true, closable: true })
