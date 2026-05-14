// Sanity-check the plugin files before packing. Run via `npm run verify`.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const failures = [];

const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 2) failures.push('manifest_version must be 2');
if (!manifest.applications?.zotero?.id) failures.push('applications.zotero.id missing');
if (!manifest.applications?.zotero?.id.endsWith('@sumno.com.br')) {
  failures.push('applications.zotero.id should end with @sumno.com.br');
}
if (!manifest.applications?.zotero?.strict_min_version) {
  failures.push('strict_min_version missing');
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
