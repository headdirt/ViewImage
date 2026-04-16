'use strict';

// i18n helpers are shared via js/i18n.js (loaded via importScripts on MV3
// service workers, via the manifest's background.scripts array on Firefox).
if (typeof importScripts === 'function') {
    importScripts('./i18n.js');
}

const DEBUG = false;
const debug = (...args) => { if (DEBUG) console.log('ViewImage:', ...args); };

const defaultOptions = {
    'open-in-new-tab': true,
    'open-search-by-in-new-tab': true,
    'manually-set-button-text': false,
    'no-referrer': false,
    'button-text-view-image': '',
    'button-text-search-by-image': '',
    'context-menu-search-by-image': true,
};

// Publish defaults so content scripts can read them without re-declaring
chrome.storage.sync.set({ defaultOptions });

async function ensureContextMenu() {
    const { options = {}, defaultOptions: storedDefaults } =
        await chrome.storage.sync.get(['options', 'defaultOptions']);
    const effective = Object.assign({}, defaultOptions, storedDefaults || {}, options);

    // Always remove first so this is idempotent across service-worker restarts
    await new Promise(resolve => {
        chrome.contextMenus.remove('ViewImage-SearchByImage', () => {
            void chrome.runtime.lastError;
            resolve();
        });
    });

    if (effective['context-menu-search-by-image']) {
        chrome.contextMenus.create({
            id: 'ViewImage-SearchByImage',
            title: toI18n('__MSG_searchImage__'),
            contexts: ['image'],
        });
    }
}

chrome.runtime.onInstalled.addListener(ensureContextMenu);
chrome.runtime.onStartup.addListener(ensureContextMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
    debug('Search By Image context menu item clicked.', info, tab);

    if (info.menuItemId === 'ViewImage-SearchByImage') {
        chrome.tabs.create({
            url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(info.srcUrl)}`,
        });
    }
});
