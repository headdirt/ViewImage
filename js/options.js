'use strict';

// Current options extend defaults
let defaultOptions;
let options;

const load = () => new Promise(resolve => {
    chrome.storage.sync.get('options', storage => {
        options = storage.options || Object.assign({}, defaultOptions);
        show(options);
        resolve(options);
    });
});

const save = object => new Promise(resolve => {
    chrome.storage.sync.set({ options: object }, resolve);
});

const update_page = () => {
    const manualButtonToggle = document.getElementById('manually-set-button-text');
    const manualButtonText = document.getElementById('manual-toggle');

    if (manualButtonToggle.checked) {
        manualButtonText.classList.remove('disabled');
    } else {
        manualButtonText.classList.add('disabled');
    }
};

const show = opts => {
    for (const key in opts) {
        const element = document.getElementById(key);
        if (!element) continue;
        switch (typeof opts[key]) {
            case 'boolean':
                element.checked = opts[key];
                break;
            case 'string':
                element.value = opts[key];
                break;
        }
    }
    update_page();
};

const update_context_menu = enabled => {
    chrome.contextMenus.remove('ViewImage-SearchByImage', () => {
        void chrome.runtime.lastError; // suppress "no such menu item" warning

        if (!enabled) return;

        chrome.contextMenus.create({
            id: 'ViewImage-SearchByImage',
            title: toI18n('__MSG_searchImage__'),
            contexts: ['image'],
        });
    });
};

const reset = () => {
    save(defaultOptions).then(() => {
        show(defaultOptions);
        update_context_menu(defaultOptions['context-menu-search-by-image']);
    });
};

chrome.storage.sync.get('defaultOptions', storage => {
    defaultOptions = storage.defaultOptions;
    load();
});

document.addEventListener('change', event => {
    if (event.target.id === 'context-menu-search-by-image') {
        update_context_menu(event.target.checked);
    }

    switch (event.target.type) {
        case 'checkbox':
            options[event.target.id] = event.target.checked;
            break;
        case 'text':
            options[event.target.id] = event.target.value;
            break;
    }

    save(options);
    update_page();
});

document.addEventListener('click', event => {
    if (event.target.id === 'reset-options') {
        reset();
    }
    update_page();
});
