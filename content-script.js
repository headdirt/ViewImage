'use strict';

// Google's class names are obfuscated and rotate every few months, so the
// preview panel is found through attributes and structure only. In each
// [data-lhcontainer] panel, the Visit button is the link described by the
// result title (a[aria-describedby]), and the full-size image sits inside
// another link to the same page. Our button is a clone of Visit, so it matches
// Google's styling (including dark mode) without us shipping any.

const LABEL = 'View image';
const BUTTON_CLASS = 'vi_ext_addon';

// Stripped from the clone so clicks go straight to the image, untracked.
const GOOGLE_ATTRIBUTES = [
    'jsaction', 'jscontroller', 'jsname', 'jslog', 'jsdata', 'ping', 'data-ved',
    'data-hveid', 'id', 'aria-describedby',
];

// The Images tab has been `tbm=isch` (legacy), `udm=2` and `udm=imgs`.
function isImageSearch() {
    const params = new URLSearchParams(location.search);
    return params.get('tbm') === 'isch' || ['2', 'imgs'].includes(params.get('udm'));
}

// Anything but Google's own gstatic thumbnails and favicons.
const isFullSizeImage = src => /^https?:\/\//.test(src) && !/^https?:\/\/([^/]*\.)?gstatic\.com\//.test(src);

// On the first page of results Google embeds each result's data in an inline
// script as `[0,"<docid>",["<thumbnail>",h,w],["<full-size>",h,w],…]`. Results
// added later by infinite scroll are fetched by Google's own scripts and never
// reach the DOM, so this only helps for the initial results.
const PAGE_DATA_PATTERN = /\[0,"([\w-]+)",\["https?:[^"]+",\d+,\d+\],\["(https?:[^"]+)",\d+,\d+\]/g;

let pageData = new Map();
let pageDataScriptCount = -1;

const decodeScriptString = str => str
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, '/');

function findImageURLInPageData(docId) {
    // Scan lazily, and only again if Google has added scripts since.
    if (document.scripts.length !== pageDataScriptCount) {
        pageDataScriptCount = document.scripts.length;
        pageData = new Map();
        for (const script of document.scripts) {
            if (script.src) continue;
            for (const [, id, imageURL] of script.textContent.matchAll(PAGE_DATA_PATTERN)) {
                if (!pageData.has(id)) pageData.set(id, decodeScriptString(imageURL));
            }
        }
    }
    return pageData.get(docId) || null;
}

function findImageURL(panel, visitLink) {
    // The full-size preview <img>, inside the link to the source page.
    for (const link of panel.querySelectorAll('a[href]')) {
        if (link === visitLink || link.href !== visitLink.href) continue;
        for (const img of link.querySelectorAll('img')) {
            if (isFullSizeImage(img.src)) return img.src;
        }
    }

    // Until that has loaded, or if it failed to, the URL from the page data.
    const docId = panel.querySelector('[data-id]')?.dataset.id;
    const fromPageData = docId && findImageURLInPageData(docId);
    return isFullSizeImage(fromPageData) ? fromPageData : null;
}

function createButton(visitLink, imageURL) {
    const button = visitLink.cloneNode(true);
    button.classList.add(BUTTON_CLASS);
    const elements = [button, ...button.querySelectorAll('*')];
    for (const el of elements) {
        for (const attr of GOOGLE_ATTRIBUTES) el.removeAttribute(attr);
        if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', LABEL);
    }
    const label = elements.find(el => [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()));
    if (label) label.textContent = LABEL;
    button.href = imageURL;
    button.target = '_blank';
    button.rel = 'noopener';
    return button;
}

function renderPanel(panel) {
    const visitLink = panel.querySelector(`a[href][aria-describedby]:not(.${BUTTON_CLASS})`);
    if (!visitLink) return;
    const imageURL = findImageURL(panel, visitLink);

    // Mutations fire constantly while the panel is open, including for our own
    // button; only rebuild when the image changed or Google dropped ours.
    const existing = panel.querySelectorAll(`.${BUTTON_CLASS}`);
    const upToDate = existing.length === 1 && existing[0].getAttribute('href') === imageURL &&
        existing[0].previousElementSibling === visitLink;
    if (imageURL ? upToDate : existing.length === 0) return;
    for (const el of existing) el.remove();
    if (imageURL) visitLink.after(createButton(visitLink, imageURL));
}

let frameScheduled = false;

function scheduleRender() {
    if (frameScheduled) return;
    frameScheduled = true;
    requestAnimationFrame(() => {
        frameScheduled = false;
        for (const panel of document.querySelectorAll('[data-lhcontainer]')) renderPanel(panel);
    });
}

if (isImageSearch()) {
    new MutationObserver(scheduleRender).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'data-id'],
    });
    scheduleRender();
}
