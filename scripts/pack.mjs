// Packs the plugin into a Zotero-installable .xpi (zip) in dist/.
// Includes only the runtime files: manifest.json, bootstrap.js, update.json, LICENSE.
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
const version = manifest.version;
const outDir = resolve(root, 'dist');
const outFile = resolve(outDir, `sumno-zotero-${version}.xpi`);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const output = createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

const done = new Promise((resolvePromise, rejectPromise) => {
  output.on('close', () => resolvePromise(archive.pointer()));
  archive.on('error', rejectPromise);
});

archive.pipe(output);
archive.file(resolve(root, 'manifest.json'), { name: 'manifest.json' });
archive.file(resolve(root, 'bootstrap.js'), { name: 'bootstrap.js' });
archive.file(resolve(root, 'update.json'), { name: 'update.json' });
archive.file(resolve(root, 'LICENSE'), { name: 'LICENSE' });
await archive.finalize();

const totalBytes = await done;
console.log(`Wrote ${outFile} (${totalBytes} bytes)`);
