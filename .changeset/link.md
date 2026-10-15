---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Link: the first component. `linkProps` (core/dom) gives every link part the same rules:
a native anchor by default, client routing through a hooks-free `Router` environment
capability that never double-navigates, modifier, middle and cross-origin activations left
to the browser, href resolution that never rewrites external URLs, the disabled-link rule
(TalkBack-reachable), `aria-current`, activation reports with a disposition, and a
`role="link"` fallback built on the exported `activateLink` routine. `<Link>` and
`RouterProvider` in React; `staticContract` for stateless components; `getLink`,
`fakeRouter()` and `env.navigated()` in the DOM and Playwright adapters; `link.css` in the
theme; generated API docs from component meta files.
