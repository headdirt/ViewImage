'use strict';

const DEBUG = false;

const debug = (...args) => { if (DEBUG) console.log('ViewImage:', ...args); };

// Google has used several URL flags for the Images tab over the years:
// `tbm=isch` (legacy), `udm=2`, and `udm=imgs`. The manifest injects on all
// /search and /imgres pages; this decides whether we're actually on Images.
const IMAGE_SEARCH_UDM_VALUES = ['2', 'imgs'];

// Google's class names are obfuscated and rotate every few months, so the
// preview panel is located through attributes and document structure only:
//
//   [data-lhcontainer]                  one per preview panel (some preloaded)
//     [data-id="<docid>"]               the result currently shown
//     <a href="<page>"><img …></a>      the preview image(s), linked to the page
//     <h1 id="ucc-0">Title</h1>
//     <a href="<page>" aria-describedby="ucc-0">Visit</a>
//
// Our buttons are clones of the Visit button so they match Google's styling
// (including dark mode) without us shipping any of it.
const PANEL_SELECTOR = '[data-lhcontainer]';
const ADDON_CLASS = 'vi_ext_addon';
const DISABLED_CLASS = 'vi_ext_disabled';

// Attributes Google uses for its own click handling and click tracking. They
// are stripped from cloned buttons so clicks go straight to our href and are
// not reported back to Google.
const GOOGLE_ATTRIBUTES = [
    'jsaction', 'jscontroller', 'jsname', 'jslog', 'jsdata', 'ping', 'data-ved',
    'data-hveid', 'id', 'aria-describedby',
];

// On the first page of results Google embeds each result's data in an inline
// script as `[0,"<docid>",["<thumbnail>",h,w],["<full-size>",h,w],…]`. Results
// added later by infinite scroll are fetched by Google's own scripts and never
// reach the DOM, so this only helps for the initial results.
const PAGE_DATA_PATTERN = /\[0,"([\w-]+)",\["https?:[^"]+",\d+,\d+\],\["(https?:[^"]+)",\d+,\d+\]/g;

let options;

// --- URL helpers ---------------------------------------------------------

function isImageSearchURL(href) {
    try {
        const url = new URL(href);
        if (url.pathname === '/imgres') return true;
        if (url.pathname !== '/search') return false;
        return url.searchParams.get('tbm') === 'isch' ||
            IMAGE_SEARCH_UDM_VALUES.includes(url.searchParams.get('udm'));
    } catch {
        return false;
    }
}

// A URL we can link to as "the image": a real http(s) URL that isn't one of
// Google's gstatic thumbnails or favicons.
function isFullSizeImageURL(imageURL) {
    try {
        const url = new URL(imageURL);
        return (url.protocol === 'http:' || url.protocol === 'https:') &&
            !/(^|\.)gstatic\.com$/.test(url.hostname);
    } catch {
        return false;
    }
}

function findImageURLFromPageURL() {
    try {
        return new URL(window.location.href).searchParams.get('imgurl');
    } catch {
        return null;
    }
}

// --- Page data -----------------------------------------------------------

let pageData = null;
let pageDataScriptCount = -1;

function decodeScriptString(str) {
    return str
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\\//g, '/');
}

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
        debug(`Indexed ${pageData.size} results from page data`);
    }

    return pageData.get(docId) || null;
}

// --- DOM discovery -------------------------------------------------------

function findVisitLink(panel) {
    for (const link of panel.querySelectorAll('a[href][aria-describedby]')) {
        if (!link.classList.contains(ADDON_CLASS)) return link;
    }
    return null;
}

function findImageURL(panel, visitLink) {
    // 1. The full-size preview <img>, inside the link to the source page.
    for (const link of panel.querySelectorAll('a[href]')) {
        if (link === visitLink || link.href !== visitLink.href) continue;
        for (const img of link.querySelectorAll('img')) {
            if (isFullSizeImageURL(img.src)) return img.src;
        }
    }

    // 2. Google removes that <img> when the image fails to load (e.g. the host
    //    blocks hotlinking), which is when "View image" is most useful.
    const docId = panel.querySelector('[data-id]')?.dataset.id;
    const fromPageData = docId && findImageURLInPageData(docId);
    if (isFullSizeImageURL(fromPageData)) return fromPageData;

    // 3. Legacy /imgres?imgurl=… pages.
    const fromPageURL = findImageURLFromPageURL();
    if (isFullSizeImageURL(fromPageURL)) return fromPageURL;

    return null;
}

// --- Button rendering ----------------------------------------------------

function findLabelElement(button) {
    for (const el of [button, ...button.querySelectorAll('*')]) {
        for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return el;
        }
    }
    return null;
}

function createButton(visitLink, { label, icon, href, newTab, noReferrer, disabledTitle }) {
    const button = visitLink.cloneNode(true);
    button.classList.add(ADDON_CLASS);

    for (const el of [button, ...button.querySelectorAll('*')]) {
        for (const attr of GOOGLE_ATTRIBUTES) el.removeAttribute(attr);
        if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);
    }
    for (const attr of ['href', 'target', 'rel']) button.removeAttribute(attr);

    const labelElement = findLabelElement(button);
    if (labelElement) {
        if (icon) {
            labelElement.textContent = '';
            const img = document.createElement('img');
            img.className = 'vi_ext_icon';
            img.src = icon;
            img.alt = label;
            labelElement.appendChild(img);
        } else {
            labelElement.textContent = label;
        }
    }

    if (href) {
        button.href = href;
        if (newTab) button.target = '_blank';
        const rel = [newTab && 'noopener', noReferrer && 'noreferrer'].filter(Boolean);
        if (rel.length) button.rel = rel.join(' ');
    } else {
        button.classList.add(DISABLED_CLASS);
        button.setAttribute('aria-disabled', 'true');
        button.title = disabledTitle;
    }

    return button;
}

function renderPanel(panel) {
    const visitLink = findVisitLink(panel);
    if (!visitLink) return;

    const imageURL = findImageURL(panel, visitLink);

    // Mutations fire constantly while the panel is open, including for our own
    // buttons; only rebuild when what we'd render has changed or Google has
    // re-rendered the button row and dropped ours.
    const state = `${visitLink.href}\n${imageURL}`;
    const existing = panel.querySelectorAll(`.${ADDON_CLASS}`);
    if (existing.length === 2 && existing[0].dataset.viState === state &&
        existing[0].previousElementSibling === visitLink) {
        return;
    }
    for (const el of existing) el.remove();

    debug('Rendering buttons for', imageURL, panel);

    const manualText = options['manually-set-button-text'];
    const viewImageLabel = (manualText && options['button-text-view-image']) || toI18n('__MSG_viewImage__');
    const searchLabel = (manualText && options['button-text-search-by-image']) || toI18n('__MSG_searchImage__');

    const searchButton = createButton(visitLink, {
        label: searchLabel,
        icon: manualText && options['button-text-search-by-image'] ? null : chrome.runtime.getURL('img/lens.svg'),
        href: imageURL && `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageURL)}`,
        newTab: options['open-search-by-in-new-tab'],
        disabledTitle: 'No searchable image URL was found.',
    });
    const viewImageButton = createButton(visitLink, {
        label: viewImageLabel,
        href: imageURL,
        newTab: options['open-in-new-tab'],
        noReferrer: options['no-referrer'],
        disabledTitle: 'No full-sized image was found.',
    });

    searchButton.dataset.viState = state;
    visitLink.after(searchButton, viewImageButton);
}

// --- Observation ---------------------------------------------------------

let frameScheduled = false;

function renderAllPanels() {
    frameScheduled = false;
    for (const panel of document.querySelectorAll(PANEL_SELECTOR)) {
        renderPanel(panel);
    }
}

function scheduleRender() {
    if (frameScheduled) return;
    frameScheduled = true;
    requestAnimationFrame(renderAllPanels);
}

async function start() {
    const storage = await storageSyncGet('options');
    options = Object.assign({}, VIEW_IMAGE_DEFAULT_OPTIONS, storage.options || {});

    debug('Initialising observer...');

    new MutationObserver(scheduleRender).observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'data-id'],
    });

    scheduleRender();
}

if (isImageSearchURL(window.location.href)) {
    start();
} else {
    debug('Not an image search page, skipping');
}
