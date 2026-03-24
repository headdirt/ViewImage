'use strict';

const DEBUG = false;

function toI18n(str) {
    return str.replace(/__MSG_(\w+)__/g, function (match, v1) {
        return v1 ? chrome.i18n.getMessage(v1) : '';
    });
}

// Default options
const defaultOptions = {
    'open-in-new-tab': true,
    'open-search-by-in-new-tab': true,
    'manually-set-button-text': false,
    'no-referrer': false,
    'button-text-view-image': '',
    'button-text-search-by-image': '',
    'context-menu-search-by-image': true,
};

// Save default options to storage
chrome.storage.sync.get('defaultOptions', function () {
    chrome.storage.sync.set({ defaultOptions });
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['options', 'defaultOptions'], (storage) => {
        if (!Object.prototype.hasOwnProperty.call(storage, 'options')) {
            storage.options = {};
        }

        const options = Object.assign({}, defaultOptions, storage.defaultOptions || {}, storage.options);

        // Setup "Search by image" context menu item
        if (options['context-menu-search-by-image']) {
            chrome.contextMenus.create(
                {
                    'id': 'ViewImage-SearchByImage',
                    'title': toI18n('__MSG_searchImage__'),
                    'contexts': ['image'],
                }
            );
        }
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (DEBUG)
        console.log('ViewImage: Search By Image context menu item clicked.', info, tab);

    if (info.menuItemId === 'ViewImage-SearchByImage') {
        chrome.tabs.create({
            url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(info.srcUrl)}`,
        });
    }
});
