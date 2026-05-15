# sumno-zotero

Read-only Zotero 7+ plugin that pulls your [sumno](https://sumno.com.br) library into Zotero as a regular collection — with title, authors, year, DOI, abstract, Open Access URL and the original OpenAlex ID preserved.

Read-only means: **sumno → Zotero, one direction.** The plugin never writes anything to sumno, never sends Zotero data anywhere, and never touches items outside the `Sumno` collection it manages.

> ⚠️ **Beta.** This is the v0.1.0 release. The API surface on the sumno side may evolve. Open an issue if something breaks.

## Install

1. Open Zotero 7+. (Help → About Zotero must show **Version 7.0** or later; the plugin won't install on Zotero 6.)
2. Download the latest `.xpi` from [Releases](https://github.com/sumno-app/sumno-zotero/releases/latest).
3. In Zotero: **Tools → Plugins** → ⚙ (gear, top-right of the plugins window) → **Install Plugin From File…** → pick the `.xpi`. Alternatively: drag and drop the `.xpi` directly onto the Zotero window.
4. Restart Zotero.

## Configure

1. Go to https://sumno.com.br/conta/tokens (must be signed in).
2. Click **Generate token**, give it a name (e.g. `Zotero on laptop`), choose an expiration. Copy the raw value — it is shown **only once**.
3. In Zotero: **Tools → Sumno: Configure token…** → paste → OK.

## Sync

**Tools → Sumno: Sync library.**

Items appear in a collection called **Sumno**, which is created automatically the first time. Re-running sync is safe — items are deduplicated by the OpenAlex ID stored in each item's **Extra** field. Existing items are skipped, not overwritten.

A success dialog at the end shows how many items were added and how many were skipped.

## FAQ

**Is it safe? What can the token do?**
The token authorizes only the public `GET /api/v1/library` endpoint on sumno. It cannot write to your sumno account, change your subscription, view your billing, or read other endpoints. Each token has its own rate limit (60 requests/minute) and you can revoke it at any time on `/conta/tokens`.

**Where is the token stored?**
In Zotero's preference store (`Zotero.Prefs.set('extensions.sumno.token', ...)`). Not in a plain file. To clear it, run **Tools → Sumno: Configure token…** and submit an empty value.

**Does it send my Zotero library to sumno?**
No. The plugin only reads from sumno and writes to your local Zotero collection. No outbound request to sumno carries any Zotero data.

**Does it overwrite items I already curated by hand?**
No. Deduplication uses the OpenAlex ID in the **Extra** field. Items you imported some other way (Zotero connector, DOI lookup, etc.) are left alone unless they happen to have the same `openalex:` line — which is unusual.

**Will it work with Zotero 6?**
No. Zotero 6 used a different plugin structure (XUL Overlay). Migrating to it isn't worth the maintenance cost; Zotero 7 is the supported floor.

**Why one-direction only?**
A first version that does one thing well, predictably, is more useful than a two-way sync with subtle conflicts. Bidirectional sync is on the roadmap — but only with real demand evidence.

**Rate limit hit. Now what?**
The API allows 60 requests/minute per token. The plugin does exactly one request per sync, so you'd only see this if you spammed the menu. Wait a minute and try again.

## Roadmap

No dates promised — direction follows real user feedback.

- **0.2.x** — incremental sync (only changes since last run); per-tag collection mapping.
- **0.3.x** — pull sumno notes into Zotero notes (when the notes feature ships in sumno).
- **1.0** — bidirectional sync, if demand is there.
- **Other clients** (Obsidian, Mendeley, Roam) — only with a written defense and signal of demand.

## Development

```bash
# Verify manifest, bootstrap.js, and update.json shape
npm run verify

# Build the .xpi locally (output in dist/)
npm install
npm run pack
```

To test a local build, install `dist/sumno-zotero-*.xpi` via **Tools → Add-ons → Install Add-on From File…**, the same way as a release. Reinstalling replaces the previous version cleanly.

## Releasing

Maintainer-only:

```bash
# 1. Bump version in manifest.json, update.json, package.json, CHANGELOG.md
# 2. Tag and push
git tag vX.Y.Z
git push origin vX.Y.Z
# 3. GitHub Action packs and attaches dist/sumno-zotero-X.Y.Z.xpi to the release
```

## License

MIT — see [LICENSE](./LICENSE). Use it, modify it, ship it. No warranty.

## Support

- **Bugs and feature requests:** open a [GitHub issue](https://github.com/sumno-app/sumno-zotero/issues) — best-effort, no SLA, but issues are easier to track and benefit other users.
- **Anything else (account, billing, plugin questions you'd rather email):** [suporte@sumno.com.br](mailto:suporte@sumno.com.br) — written in Portuguese (Brazilian product), but replies in English are fine if you write that way. Solo maintainer; expect a reply within a few business days.
