# Releasing

Packages: `@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing`, `@rind-ui/theme`.
The site is private and never published.

Versions and changelogs come from [Changesets](https://github.com/changesets/changesets):
every change a consumer would notice adds a file in `.changeset/` (`pnpm changeset`).

## How a release happens

`.github/workflows/release.yml` runs on every push to `main`:

1. If there are pending changesets, it opens (or updates) a **"release: version packages"**
   pull request that bumps the versions, writes each package's `CHANGELOG.md` and deletes
   the consumed changesets.
2. Merging that pull request runs the workflow again with no changesets left: it builds the
   four packages and runs `changeset publish`, which publishes every package whose version
   is not on npm yet (with `pnpm publish`, so `workspace:*` becomes a real version), then
   tags the release and creates GitHub releases.

## Manual checks before a release

Some behaviour only a person with a device can confirm. Before releasing a version that
changed the QR encoder or the QR Code component (add-qr-code 6.4):

- Scan ten generated codes with the iOS Camera app and with Google Lens on Android: digits,
  a URL, a Wi-Fi string (`WIFI:T:WPA;S:Home;P:secret;;`), non-ASCII text (`Grüße, 世界`), and
  a code with a logo at levels L, M and H (expected: L with a large logo may fail; M and H
  read). Record any failure in the PR.
- With NVDA (Firefox) and VoiceOver (Safari), read a QR code with a `ValueText`: the image's
  name ("QR code" or the translated label) and its description (the value) are spoken.
  Record the pass in `docs/accessibility/tested-with.json`.

## One-time setup

1. **The npm scope.** `@rind-ui` is an npm organisation: create it (free for public
   packages) at npmjs.com → your avatar → *Add Organization*, name `rind-ui`.
2. **A token.** npmjs.com → *Access Tokens* → *Generate New Token* → *Granular Access
   Token*: permissions *Read and write*, packages and scopes: the `@rind-ui` organisation.
   Enable "Bypass 2FA" for automation, or the publish will ask for a one-time code.
3. **The secret.** GitHub → repository *Settings* → *Secrets and variables* → *Actions* →
   *New repository secret*: name `NPM_TOKEN`, value the token.
4. **Pull requests from Actions.** The WatermelonBros organisation blocks it by default, so
   first at the organisation level: github.com/organizations/WatermelonBros/settings/actions →
   *Workflow permissions*: *Read and write* and tick *Allow GitHub Actions to create and approve
   pull requests*. Then the same two settings in the repository (*Settings* → *Actions* →
   *General*). The version pull request needs it.
5. **Discord announcements (optional).** In the Discord channel: *Edit Channel* → *Integrations*
   → *Webhooks* → *New Webhook*, then *Copy Webhook URL*. Add it as the repository secret
   `DISCORD_WEBHOOK`. Every publish then posts "rind-ui x.y.z is out." with that version's
   changelog. Without the secret the step does nothing.

## Later: provenance and trusted publishing

npm provenance needs a **public** repository. When the repository goes public:

- set `NPM_CONFIG_PROVENANCE: true` in `release.yml`;
- optionally switch to npm **trusted publishing** (no token): on each package's npm settings
  page, add a trusted publisher for `WatermelonBros/rind-ui`, workflow `release.yml`; then
  remove `NPM_TOKEN` (the workflow already requests `id-token: write`).

## Publishing by hand (fallback)

```sh
npm login                 # an account that owns the @rind-ui org
pnpm version-packages     # applies changesets: versions + changelogs
git commit -am "release: version packages" && git push
pnpm release              # builds the four packages and publishes them
```

`npm view @rind-ui/react` shows what is live.

## Manual checks before a release

Checks no automated test covers, run by hand on real assistive technology and devices.

- **Tour**: a three-step tour (a centred welcome, two anchored steps) with VoiceOver (Safari,
  macOS and iOS) and NVDA (Firefox and Chrome): the card's name and description are read when
  the tour starts, the step change is announced when focus stays on Next, and the page stays
  usable behind an anchored step. On a phone, pinch-zoom while a step is shown: the dimmed
  area still covers the visible page and the cutout stays on the target.
