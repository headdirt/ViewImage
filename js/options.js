'use strict';

let options;

const load = () => storageSyncGet('options').then(storage => {
    options = Object.assign({}, VIEW_IMAGE_DEFAULT_OPTIONS, storage.options || {});
    show(options);
    return options;
});

const save = object => storageSyncSet({ options: object });

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

const reset = () => {
    save(VIEW_IMAGE_DEFAULT_OPTIONS).then(() => {
        show(VIEW_IMAGE_DEFAULT_OPTIONS);
    });
};

load();

document.addEventListener('change', event => {
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
