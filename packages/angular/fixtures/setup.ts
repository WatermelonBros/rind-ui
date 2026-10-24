// Angular's own packages ship partially compiled; the runtime compiler links them on load (an
// application build links them ahead of time). @rind-ui/angular's code is compiled AOT by the
// Vitest plugin.
import "@angular/compiler"
