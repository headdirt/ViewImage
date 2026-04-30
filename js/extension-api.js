'use strict';

function storageSyncGet(keys) {
    return new Promise(resolve => {
        chrome.storage.sync.get(keys, resolve);
    });
}

function storageSyncSet(values) {
    return new Promise(resolve => {
        chrome.storage.sync.set(values, resolve);
    });
}

function storageSyncRemove(keys) {
    return new Promise(resolve => {
        chrome.storage.sync.remove(keys, resolve);
    });
}

function removeContextMenu(id) {
    return new Promise(resolve => {
        chrome.contextMenus.remove(id, () => {
            void chrome.runtime.lastError;
            resolve();
        });
    });
}
