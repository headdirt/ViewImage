'use strict';

function toI18n(str) {
    return str.replace(/__MSG_(\w+)__/g, (_, key) => key ? chrome.i18n.getMessage(key) : '');
}

function localiseObject(obj, tag) {
    const msg = toI18n(tag);
    if (msg) obj.textContent = msg;
}

function localisePage() {
    for (const el of document.querySelectorAll('[data-localise]')) {
        localiseObject(el, el.getAttribute('data-localise'));
    }
}
