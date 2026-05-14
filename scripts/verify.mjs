// Sanity-check the plugin files before packing. Run via `npm run verify`.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const failures = [];

const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 2) failures.push('manifest_version must be 2');

// Either applications.zotero or browser_specific_settings.zotero must be present;
// when both are present they must agree on id and strict_min_version (Zotero 7
// reads applications.zotero, Zotero 9+ prefers browser_specific_settings.zotero).
const legacyZotero = manifest.applications?.zotero;
const modernZotero = manifest.browser_specific_settings?.zotero;
const zoteroBlock = modernZotero ?? legacyZotero;
if (!zoteroBlock) {
  failures.push('Manifest must declare applications.zotero or browser_specific_settings.zotero');
} else {
  if (!zoteroBlock.id) failures.push('zotero.id missing');
  if (zoteroBlock.id && !zoteroBlock.id.endsWith('@sumno.com.br')) {
    failures.push('zotero.id should end with @sumno.com.br');
  }
  if (!zoteroBlock.strict_min_version) failures.push('zotero.strict_min_version missing');
}
if (legacyZotero && modernZotero) {
  if (legacyZotero.id !== modernZotero.id) {
    failures.push('applications.zotero.id and browser_specific_settings.zotero.id must match');
  }
  if (legacyZotero.strict_min_version !== modernZotero.strict_min_version) {
    failures.push('strict_min_version must match across both manifest blocks');
  }
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  failures.push(`version "${manifest.version}" not semver`);
}

const bootstrap = await readFile(resolve(root, 'bootstrap.js'), 'utf8');
for (const fn of ['function install', 'function uninstall', 'function startup', 'function shutdown']) {
  if (!bootstrap.includes(fn)) failures.push(`bootstrap.js missing ${fn}`);
}

const update = JSON.parse(await readFile(resolve(root, 'update.json'), 'utf8'));
const updateVer = update.addons?.['sumno-zotero@sumno.com.br']?.updates?.[0]?.version;
if (updateVer !== manifest.version) {
  failures.push(
    `update.json version (${updateVer}) does not match manifest.json (${manifest.version})`,
  );
}

if (failures.length === 0) {
  console.log(`Verify OK — manifest v${manifest.version}, bootstrap.js ${bootstrap.length} chars`);
  process.exit(0);
}
console.error('Verify FAILED:');
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
