/*
 * sumno-zotero — read-only sync from sumno library into Zotero 7+.
 * https://github.com/sumno-app/sumno-zotero
 * MIT License.
 */
/* globals Zotero, Components, Services */

var SumnoPlugin;

const PREF_TOKEN = 'extensions.sumno.token';
const PREF_API_BASE = 'extensions.sumno.apiBase';
const DEFAULT_API_BASE = 'https://www.sumno.com.br';
const COLLECTION_NAME = 'Sumno';

function install() {}
function uninstall() {}

function startup({ id, version, rootURI }) {
  SumnoPlugin = {
    id,
    version,
    rootURI,
    showConfigure,
    syncLibrary,
  };
  Zotero.SumnoPlugin = SumnoPlugin;
  registerMenu();
  Zotero.debug(`[sumno-zotero] startup ${version}`);
}

function shutdown() {
  unregisterMenu();
  Zotero.SumnoPlugin = undefined;
  SumnoPlugin = undefined;
  Zotero.debug('[sumno-zotero] shutdown');
}

// =====================================================================
// Token + config storage
// =====================================================================

function getToken() {
  return Zotero.Prefs.get(PREF_TOKEN, true) || null;
}
function setToken(token) {
  Zotero.Prefs.set(PREF_TOKEN, token, true);
}
function clearToken() {
  Zotero.Prefs.clear(PREF_TOKEN, true);
}
function getApiBase() {
  return Zotero.Prefs.get(PREF_API_BASE, true) || DEFAULT_API_BASE;
}

// =====================================================================
// Menu (Tools → Sumno: …)
// =====================================================================

function eachBrowserWindow(fn) {
  const wm = Components.classes['@mozilla.org/appshell/window-mediator;1']
    .getService(Components.interfaces.nsIWindowMediator);
  const e = wm.getEnumerator('navigator:browser');
  while (e.hasMoreElements()) fn(e.getNext());
}

function registerMenu() {
  eachBrowserWindow(addMenuToWindow);
}

function addMenuToWindow(win) {
  const doc = win.document;
  const tools = doc.getElementById('menu_ToolsPopup');
  if (!tools || doc.getElementById('sumno-menu-separator')) return;

  const sep = doc.createXULElement('menuseparator');
  sep.id = 'sumno-menu-separator';
  tools.appendChild(sep);

  const configure = doc.createXULElement('menuitem');
  configure.id = 'sumno-menu-configure';
  configure.setAttribute('label', 'Sumno: Configure token…');
  configure.addEventListener('command', () => showConfigure(win));
  tools.appendChild(configure);

  const sync = doc.createXULElement('menuitem');
  sync.id = 'sumno-menu-sync';
  sync.setAttribute('label', 'Sumno: Sync library');
  sync.addEventListener('command', () => syncLibrary(win));
  tools.appendChild(sync);
}

function unregisterMenu() {
  eachBrowserWindow((win) => {
    const doc = win.document;
    ['sumno-menu-separator', 'sumno-menu-configure', 'sumno-menu-sync'].forEach((id) => {
      const el = doc.getElementById(id);
      if (el) el.remove();
    });
  });
}

// =====================================================================
// Configure prompt
// =====================================================================

function showConfigure(win) {
  const result = { value: getToken() || '' };
  const ok = Services.prompt.prompt(
    win,
    'sumno-zotero',
    'Paste your sumno access token (from sumno.com.br/conta/tokens). Leave empty to clear.',
    result,
    null,
    {},
  );
  if (!ok) return;
  const trimmed = (result.value || '').trim();
  if (trimmed === '') {
    clearToken();
    Services.prompt.alert(win, 'sumno-zotero', 'Token cleared.');
    return;
  }
  if (!trimmed.startsWith('sumno_pat_')) {
    Services.prompt.alert(
      win,
      'sumno-zotero',
      'Token format invalid. Expected a value starting with sumno_pat_.',
    );
    return;
  }
  setToken(trimmed);
  Services.prompt.alert(
    win,
    'sumno-zotero',
    'Token saved. Use Tools → Sumno: Sync library to fetch your papers.',
  );
}

// =====================================================================
// Sync — fetch /api/v1/library and create Zotero items
// =====================================================================

async function fetchLibrary() {
  const token = getToken();
  if (!token) throw new Error('No token configured.');
  const url = `${getApiBase()}/api/v1/library`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Token rejected (401). Generate a new one at sumno.com.br/conta/tokens and reconfigure.');
    }
    if (res.status === 429) {
      throw new Error('Rate limit hit (60 requests/minute). Wait a minute and try again.');
    }
    if (res.status === 404) {
      throw new Error('API v1 is not enabled on this sumno project yet.');
    }
    throw new Error(`Unexpected response: HTTP ${res.status}.`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.items)) {
    throw new Error('Invalid response shape from sumno API.');
  }
  return data;
}

async function getOrCreateCollection() {
  const libraryID = Zotero.Libraries.userLibraryID;
  const collections = Zotero.Collections.getByLibrary(libraryID);
  const existing = collections.find(
    (c) => c.name === COLLECTION_NAME && !c.parentID,
  );
  if (existing) return existing;
  const collection = new Zotero.Collection({ libraryID, name: COLLECTION_NAME });
  await collection.saveTx();
  return collection;
}

function mapItemType(t) {
  switch (t) {
    case 'book':
      return 'book';
    case 'book-chapter':
      return 'bookSection';
    case 'conference-paper':
      return 'conferencePaper';
    case 'dataset':
      return 'dataset';
    case 'preprint':
      return 'preprint';
    default:
      return 'journalArticle';
  }
}

function workToZoteroItem(work, openalexId) {
  const itemTypeID = Zotero.ItemTypes.getID(mapItemType(work.type));
  const item = new Zotero.Item(itemTypeID);
  item.setField('title', work.title || '(untitled)');
  if (work.publication_year) item.setField('date', String(work.publication_year));
  if (work.doi) item.setField('DOI', work.doi);
  if (work.abstract) item.setField('abstractNote', work.abstract);
  if (work.open_access && work.open_access.oa_url) item.setField('url', work.open_access.oa_url);
  if (work.language) item.setField('language', work.language);
  item.setField('extra', `openalex: ${openalexId}\nsumno: imported`);

  if (Array.isArray(work.authors)) {
    let creatorIdx = 0;
    for (const author of work.authors) {
      const displayName = ((author && author.display_name) || '').trim();
      if (!displayName) continue; // OpenAlex occasionally returns null/empty authors; Zotero rejects creators with no name.
      const parts = displayName.split(/\s+/);
      const lastName = parts.pop() || displayName;
      const firstName = parts.join(' ');
      item.setCreator(creatorIdx, {
        firstName,
        lastName,
        creatorTypeID: Zotero.CreatorTypes.getID('author'),
      });
      creatorIdx++;
    }
  }
  return item;
}

async function syncLibrary(win) {
  if (!getToken()) {
    Services.prompt.alert(
      win,
      'sumno-zotero',
      'No token configured. Use Tools → Sumno: Configure token first.',
    );
    return;
  }
  try {
    Zotero.debug('[sumno-zotero] fetching library...');
    const data = await fetchLibrary();
    Zotero.debug(`[sumno-zotero] fetched ${data.count} items`);

    if (data.count === 0) {
      Services.prompt.alert(win, 'sumno-zotero', 'Your sumno library is empty. Nothing to sync.');
      return;
    }

    const collection = await getOrCreateCollection();
    const libraryID = Zotero.Libraries.userLibraryID;

    const existingItems = await Zotero.Items.getAll(libraryID, false);
    const existingByOpenalex = new Map();
    for (const item of existingItems) {
      const extra = item.getField('extra') || '';
      const m = /openalex:\s*(W\d+)/.exec(extra);
      if (m) existingByOpenalex.set(m[1], item);
    }

    let created = 0;
    let addedToCollection = 0;
    let skipped = 0;
    let failed = 0;
    for (const it of data.items) {
      if (!it.work) {
        skipped++;
        continue;
      }
      const existing = existingByOpenalex.get(it.openalex_id);
      if (existing) {
        // Item already imported before. Self-heal: ensure it's in the Sumno collection.
        try {
          const cols = existing.getCollections();
          if (!cols.includes(collection.id)) {
            existing.addToCollection(collection.id);
            await existing.saveTx();
            addedToCollection++;
          } else {
            skipped++;
          }
        } catch (err) {
          failed++;
          const msg = (err && err.message) ? err.message : String(err);
          Zotero.debug(`[sumno-zotero] failed to attach ${it.openalex_id} to collection: ${msg}`);
        }
        continue;
      }
      try {
        const item = workToZoteroItem(it.work, it.openalex_id);
        // Add to collection BEFORE saveTx so item creation and collection
        // membership are persisted in the same atomic transaction.
        item.addToCollection(collection.id);
        await item.saveTx();
        created++;
      } catch (err) {
        failed++;
        const msg = (err && err.message) ? err.message : String(err);
        Zotero.debug(`[sumno-zotero] failed to import ${it.openalex_id}: ${msg}`);
      }
    }

    const parts = [];
    parts.push(`${created} new item(s)`);
    if (addedToCollection > 0) parts.push(`${addedToCollection} attached to "${COLLECTION_NAME}"`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (failed > 0) parts.push(`${failed} failed (see Debug Output)`);
    Services.prompt.alert(
      win,
      'sumno-zotero',
      `Sync complete. ${parts.join(', ')}.`,
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    Services.prompt.alert(win, 'sumno-zotero', `Sync failed: ${msg}`);
    Zotero.debug(`[sumno-zotero] ${msg}`);
  }
}
