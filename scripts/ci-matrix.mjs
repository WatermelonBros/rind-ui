// The test slices CI runs (ci.yml's `test` job). Pull requests run jsdom and Chromium only, split
// fine enough that each slice takes a few minutes on a 2-vCPU runner (the free plan runs 20 jobs
// at once); pushes to main and the nightly run add Firefox and WebKit. Prints `matrix=<json>`.
const shards = (n, slice, projects, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    slice: `${slice}-${i + 1}`,
    projects: `${projects} --shard=${i + 1}/${n}`,
    browsers: "",
    ...extra,
  }))
const jsdom = "--project jsdom --project setup-noglobals --project setup-optout"
const browser = (engine) => `--project 'browser (${engine})'`
// the playwright fixtures need all three engines installed for their few cross-engine tests;
// RIND_BROWSERS (engine) picks the one the rest run in
const playwright = (engine) => ({ browsers: "chromium,firefox,webkit", engine })

const pr = [
  { slice: "node", projects: "--project node", browsers: "" },
  ...shards(5, "jsdom", jsdom),
  ...shards(6, "browser-chromium", browser("chromium"), { browsers: "chromium" }),
  ...shards(4, "playwright-chromium", "--project playwright", playwright("chromium")),
]
const full = [
  ...pr,
  ...["firefox", "webkit"].flatMap((e) => [
    ...shards(7, `browser-${e}`, browser(e), { browsers: e }),
    ...shards(4, `playwright-${e}`, "--project playwright", playwright(e)),
  ]),
]
console.log(`matrix=${JSON.stringify({ include: process.argv[2] === "full" ? full : pr })}`)
