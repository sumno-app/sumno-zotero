# Changelog

All notable changes to **sumno-zotero** are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [0.1.5] — 2026-05-14

### Fixed
- v0.1.4 sync saved each new item successfully but then called `collection.addItem(item.id)` outside the transaction — Zotero rejected with `Not in transaction`. The item ended up in the library but not inside the **Sumno** collection. Now the collection membership is added to the item before `saveTx()`, so creation and collection assignment happen in the same atomic transaction.

### Added
- Self-heal for previously-imported items that ended up outside the **Sumno** collection (e.g. left over from v0.1.4). Sync now detects items already imported by their OpenAlex ID and attaches them to the collection if missing. Reported as `N attached to "Sumno"` in the success alert.

## [0.1.4] — 2026-05-14

### Fixed
- OpenAlex occasionally returns authors with empty `display_name` (anonymous, unparsed, missing metadata). v0.1.3 tried to insert those creators with empty strings, and Zotero rejected the whole item with `Creator names cannot be empty`. Now empty authors are skipped silently.
- The sync loop was tudo-ou-nada — one item with invalid metadata aborted the whole batch. Now each item is wrapped in its own try/catch; failures are counted and reported, the rest of the library still imports.

### Changed
- Success alert now reports `created / skipped / failed` instead of just `created / skipped`.

## [0.1.3] — 2026-05-14

### Fixed
- Zotero 9 strictly requires `applications.zotero.strict_max_version` to be present in the manifest, even though it was optional in earlier versions. v0.1.1 removed it, v0.1.2 still omitted it — both refused to install on Zotero 9 with `Reading manifest: applications.zotero.strict_max_version not provided`. v0.1.3 declares `strict_max_version: "99.*"` in both `applications.zotero` and `browser_specific_settings.zotero`, which is permissive enough to cover any realistic Zotero version without further rebuilds.

## [0.1.2] — 2026-05-14

### Fixed
- v0.1.1 still refused to install on Zotero 9.x with a generic "incompatible" error. Some Mozilla-based application versions stopped honoring the legacy `applications.zotero` block in favor of `browser_specific_settings.zotero`. Manifest now declares both for broad compatibility across Zotero 7, 8, and 9+.

## [0.1.1] — 2026-05-14

### Fixed
- `strict_max_version` was set to `8.0.*` in v0.1.0, which made the plugin refuse to install on Zotero 8.1+ (including 9.x). Removed the upper bound; only `strict_min_version: 7.0.0` is enforced now.

## [0.1.0]

Initial public release.

### Added
- Manual sync from `sumno` library to a Zotero collection named **Sumno** via `Tools → Sumno: Sync library`.
- Personal Access Token configuration via `Tools → Sumno: Configure token…`.
- Deduplication by OpenAlex ID stored in the **Extra** field of each item.
- Support for journal articles, book chapters, conference papers, datasets and preprints.
- Read-only (sumno → Zotero); no data sent from Zotero to sumno.
