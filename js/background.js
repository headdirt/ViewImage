'use strict';

// Shared helpers are loaded here for MV3 service workers and via
// background.scripts in Firefox.
if (typeof importScripts === 'function') {
    importScripts('./default-options.js', './extension-api.js', './i18n.js');
}

const DEBUG = false;
const debug = (...args) => { if (DEBUG) console.log('ViewImage:', ...args); };

const SEARCH_BY_IMAGE_MENU_ID = 'ViewImage-SearchByImage';
const MENU_OPTION_KEY = 'context-menu-search-by-image';

async function ensureContextMenu() {
    const { options = {} } = await storageSyncGet('options');
    const effective = Object.assign({}, VIEW_IMAGE_DEFAULT_OPTIONS, options);

    // Always remove first so this is idempotent across service-worker restarts
    await removeContextMenu(SEARCH_BY_IMAGE_MENU_ID);

    if (effective[MENU_OPTION_KEY]) {
        chrome.contextMenus.create({
            id: SEARCH_BY_IMAGE_MENU_ID,
            title: toI18n('__MSG_searchImage__'),
            contexts: ['image'],
        });
    }
}

async function handleInstalled() {
    // Legacy migration: pre-5.4.x stored a `defaultOptions` key in sync storage.
    await Promise.all([
        storageSyncRemove('defaultOptions'),
        ensureContextMenu(),
    ]);
}

chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onStartup.addListener(ensureContextMenu);

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.options) return;
    const before = changes.options.oldValue?.[MENU_OPTION_KEY];
    const after = changes.options.newValue?.[MENU_OPTION_KEY];
    if (before !== after) void ensureContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    debug('Search By Image context menu item clicked.', info, tab);

    if (info.menuItemId === SEARCH_BY_IMAGE_MENU_ID) {
        chrome.tabs.create({
            url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(info.srcUrl)}`,
        });
    }
});
