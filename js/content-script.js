'use strict';

const DEBUG = false;
const TRACE = DEBUG && false;

const debug = (...args) => { if (DEBUG) console.log('ViewImage:', ...args); };
const trace = (...args) => { if (TRACE) console.log('ViewImage:', ...args); };

// Modern Google Images layout (Oct 2019 onward)
const CONTAINER_SELECTORS = ['.tvh9oe', '.EIehLd', '.fHE6De', '.Z7HyUd'];
const DYNAMIC_CONTAINER_SELECTORS = ['[data-lhcontainer]'];

// Candidate class names for the "Visit" button Google renders next to the
// preview. Google rotates these regularly; dynamic discovery covers the rest.
const VISIT_BUTTON_SELECTOR =
    '.ZsbmCf[href], a.J2oL9c, a.jAklOc, a.uZ49bd, a.e0XTue, a.kWgFk, a.j7ZI7c';
const SEARCH_LINK_SELECTOR =
    '.PvkmDc, .qnLx5b, .zSA7pe, .uZ49bd, .e0XTue, .kWgFk, .j7ZI7c';
const BUTTON_TEXT_SELECTOR =
    '.pM4Snf, .KSvtLc, .Pw5kW, .q7UPLe, .K8E1Be, .pFBf7b, span';

const IMG_SELECTOR = 'img[src][style][jsaction]';
const MUTATION_IMG_CLASSES = ['irc_mi', 'irc_mut', 'irc_ris'];

const images = {};
let options;

// --- DOM discovery ------------------------------------------------------

function getContainer(node) {
    for (const selector of CONTAINER_SELECTORS) {
        const container = node.closest(selector);
        if (container) return container;
    }

    debug('container class name was not found statically');

    let img = node;
    if (img.tagName !== 'IMG') {
        img = node.querySelector(IMG_SELECTOR) || node.closest(IMG_SELECTOR);
    }

    if (img && img.tagName === 'IMG') {
        for (const selector of DYNAMIC_CONTAINER_SELECTORS) {
            const container = img.closest(selector);
            if (container) return container;
        }
    }

    debug('container class name was not found dynamically');
    return null;
}

function clearExtElements(container) {
    for (const el of container.querySelectorAll('.vi_ext_addon')) {
        el.remove();
    }
}

// Dynamically discover the visit-button class name by traversing the DOM
// relative to an image element. Google's obfuscated class names change, so we
// locate the button structurally instead of by static class list.
function findVisitButtonClassName(imgEl) {
    if (!imgEl) return null;

    const traversals = [
        el => el.parentElement.parentElement.parentElement.nextSibling.querySelector('div a span').parentElement.parentElement,
        el => el.parentElement.parentElement.parentElement.nextSibling.nextSibling.querySelector('div a span').parentElement.parentElement,
        el => el.parentElement.parentElement.parentElement.nextSibling.querySelector('div a div').parentElement,
        el => el.parentElement.parentElement.nextSibling.querySelector('div a span').parentElement.parentElement,
        el => el.parentElement.parentElement.nextSibling.nextSibling.querySelector('div a span').parentElement.parentElement,
    ];

    for (let i = 0; i < traversals.length; i++) {
        try {
            return traversals[i](imgEl).className.split(' ')[0];
        } catch {
            debug(`vbClassName not found via traversal ${i}`);
        }
    }

    return null;
}

function findImageURL(container) {
    let image = container.querySelector(IMG_SELECTOR);
    if (image && image.src in images) {
        return images[image.src];
    }

    // Override url for images using base64 embeds
    if (!image || image.src === '' || image.src.startsWith('data')) {
        const thumbnail = document.querySelector(`img[name="${container.dataset.itemId}"]`);
        if (!thumbnail) {
            const url = new URL(window.location);
            const imgLink = url.searchParams.get('imgurl');
            if (imgLink) return imgLink;
        } else {
            const meta = thumbnail.closest('.rg_bx').querySelector('.rg_meta');
            const metadata = JSON.parse(meta.innerHTML);
            return metadata.ou;
        }
    }

    // If the above doesn't work, use the link in related images to find it
    if (!image || image.src === '' || image.src.startsWith('data')) {
        const targetImage = container.querySelector('img.target_image');
        if (targetImage) {
            const link = targetImage.closest('a');
            if (link) {
                if (link.href.match(/^[a-z]+:\/\/(?:www\.)?google\.[^/]*\/imgres\?/)) {
                    const linkUrl = new URL(link.href);
                    const newImgLink = linkUrl.searchParams.get('imgurl');
                    if (newImgLink) return newImgLink;
                } else {
                    return link.href;
                }
            }
        }
    }

    return image ? image.src : null;
}

// --- Button injection ---------------------------------------------------

function addViewImageButton(container, imageURL, vbClassName) {
    const selector = VISIT_BUTTON_SELECTOR + (vbClassName ? `, a.${vbClassName}` : '');
    const visitButton = container.querySelector(selector);

    if (!visitButton) {
        debug('Adding View-Image button failed, visit button was not found');
        return false;
    }

    const viewImageButton = visitButton.cloneNode(true);
    viewImageButton.classList.add('vi_ext_addon');
    const viewImageLink = viewImageButton;

    if (imageURL && !imageURL.startsWith('https://encrypted-tbn0.gstatic.com')) {
        viewImageLink.href = imageURL;
    } else {
        viewImageLink.style = 'pointer-events: none;';
        viewImageLink.title = 'No full-sized image was found.';

        const viewImageDiv = viewImageLink.querySelector('div');
        if (viewImageDiv) {
            viewImageDiv.style = 'background-color: #707070; border-color: #707070;';
        }
    }

    viewImageLink.removeAttribute('jsaction');
    viewImageLink.removeAttribute('target');

    if (options['open-in-new-tab']) {
        viewImageLink.setAttribute('target', '_blank');
    }
    const relParts = [];
    if (options['open-in-new-tab']) relParts.push('noopener');
    if (options['no-referrer']) relParts.push('noreferrer');
    if (relParts.length) viewImageLink.setAttribute('rel', relParts.join(' '));

    if (imageURL && imageURL.startsWith('data')) {
        viewImageButton.setAttribute('download', '');
    }

    const viewImageButtonText = viewImageButton.querySelector(BUTTON_TEXT_SELECTOR);
    if (!viewImageButtonText) return false;

    if (options['manually-set-button-text']) {
        viewImageButtonText.innerText = options['button-text-view-image'];
    } else {
        localiseObject(viewImageButtonText, '__MSG_viewImage__');
    }

    visitButton.parentElement.insertBefore(viewImageButton, visitButton);
    visitButton.parentElement.insertBefore(visitButton, viewImageButton);

    return true;
}

function addSearchImageButton(container, imageURL, vbClassName) {
    const selector = SEARCH_LINK_SELECTOR + (vbClassName ? `, .${vbClassName}` : '');
    const link = container.querySelector(selector);

    if (!link) {
        debug('Adding Search-By-Image button failed, link was not found');
        return;
    }

    const searchImageButton = link.cloneNode(true);
    searchImageButton.classList.add('vi_ext_addon');

    const searchImageButtonText = searchImageButton.querySelector('span');
    if (!searchImageButtonText) return false;

    if (options['manually-set-button-text']) {
        searchImageButtonText.innerText = options['button-text-search-by-image'];
    } else {
        searchImageButtonText.innerText = '';
        const lensButton = document.createElement('img');
        lensButton.style.marginTop = '5px';
        lensButton.style.width = '23px';
        lensButton.src = chrome.runtime.getURL('img/lens.svg');
        lensButton.alt = 'Search by image';
        searchImageButtonText.appendChild(lensButton);
    }

    searchImageButton.href = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageURL)}`;

    if (options['open-search-by-in-new-tab']) {
        searchImageButton.setAttribute('target', '_blank');
        searchImageButton.setAttribute('rel', 'noopener');
    }

    link.parentElement.insertBefore(searchImageButton, link);
    link.parentElement.insertBefore(link, searchImageButton);
}

function addLinks(node) {
    debug('Trying to add links to node:', node);

    const container = getContainer(node);
    if (!container) {
        debug('Adding links failed, container was not found');
        return false;
    }

    clearExtElements(container);

    const imageURL = findImageURL(container);
    if (!imageURL) {
        debug('Adding links failed, image was not found');
        return false;
    }

    const imgEl = document.querySelector(IMG_SELECTOR);
    const vbClassName = findVisitButtonClassName(imgEl);

    addViewImageButton(container, imageURL, vbClassName);
    addSearchImageButton(container, imageURL, vbClassName);

    return true;
}

// --- Data-source parsing ------------------------------------------------

function parseDataSource(array) {
    debug('Parsing data source...');

    let meta;
    try {
        meta = array[31][0][12][2];
        for (const entry of meta) {
            try {
                images[entry[1][2][0]] = entry[1][3][0];
            } catch {
                debug('Skipping image');
            }
        }
    } catch {
        // Fallback data structure path
        meta = array[56][1][0][0][1][0];
        for (const entry of meta) {
            try {
                const data = Object.values(entry[0][0])[0];
                images[data[1][2][0]] = data[1][3][0];
            } catch {
                debug('Skipping image');
            }
        }
    }
}

function parseDataSourceType1(params) {
    debug('Parsing data source type 1...');

    const dataStart = /\sdata:\[/;
    const dataEnd = '], ';

    const match = params.match(dataStart);
    const startIndex = match.index + match[0].length - 1;
    const endIndex = startIndex + params.slice(startIndex).indexOf(dataEnd) + 1;

    parseDataSource(JSON.parse(params.slice(startIndex, endIndex)));
}

function bootstrapImageIndex() {
    try {
        const startSearch = />AF_initDataCallback\(/g;
        const endSearch = ');</script>';
        const htmlContent = document.documentElement.innerHTML;
        let success = false;

        let match;
        while (!success && ((match = startSearch.exec(htmlContent)) !== null)) {
            const startIndex = match.index + match[0].length;
            const endIndex = startIndex + htmlContent.slice(startIndex).indexOf(endSearch);
            const params = htmlContent.slice(startIndex, endIndex);

            const dsMatch = params.match(/key:\s'ds:(\d)'/);
            if (dsMatch === null) continue;

            if (dsMatch[1] === '1') {
                parseDataSourceType1(params);
                success = true;
            }
        }

        if (success) {
            debug('Successfully created source images array');
        } else {
            debug('Failed to find data source');
        }
    } catch (error) {
        debug('Failed to create source images array');
        if (DEBUG) console.error(error);
    }
}

bootstrapImageIndex();

// --- MutationObserver with rAF batching ---------------------------------

const pendingNodes = new Set();
let frameScheduled = false;

function scheduleAddLinks(node) {
    pendingNodes.add(node);
    if (frameScheduled) return;
    frameScheduled = true;
    requestAnimationFrame(() => {
        frameScheduled = false;
        const batch = Array.from(pendingNodes);
        pendingNodes.clear();
        for (const n of batch) addLinks(n);
    });
}

const observer = new MutationObserver(mutations => {
    trace('Mutations detected:', mutations);

    let imgClassName;
    try {
        imgClassName = document.querySelector(IMG_SELECTOR).className.split(' ')[0];
    } catch {
        imgClassName = null;
    }

    const classesToCheck = [...MUTATION_IMG_CLASSES];
    if (imgClassName) classesToCheck.push(imgClassName);

    for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
            if (!node.classList) continue;
            if (classesToCheck.some(c => node.classList.contains(c))) {
                scheduleAddLinks(node);
            }
        }

        if (imgClassName && mutation.target.classList && mutation.target.classList.contains(imgClassName)) {
            for (const selector of CONTAINER_SELECTORS) {
                const node = mutation.target.closest(selector);
                if (node && !node.hasAttribute('aria-hidden')) {
                    scheduleAddLinks(node);
                    break;
                }
            }
        }
    }
});

// Get options and start observing
chrome.storage.sync.get(['options', 'defaultOptions'], storage => {
    options = Object.assign({}, storage.defaultOptions || {}, storage.options || {});

    debug('Initialising observer...');

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'src', 'style'],
    });
});
