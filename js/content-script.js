'use strict';

const DEBUG = false;
const TRACE = DEBUG && false;

const SearchImgBtn = true;

const VERSIONS = {
    FEB18: 'FEB18',
    JUL19: 'JUL19',
    OCT19: 'OCT19'
};

const OCT19_CONTAINER_SELECTORS = ['.tvh9oe', '.EIehLd', '.fHE6De', '.Z7HyUd'];

var images = {};
var options;

function toI18n(str) {
    return str.replace(/__MSG_(\w+)__/g, function (_, v1) {
        return v1 ? chrome.i18n.getMessage(v1) : '';
    });
}


function localiseObject(obj, tag) {
    var msg = toI18n(tag);
    if (msg != tag) obj.innerHTML = msg;
}


// Finds the div which contains all required elements
function getContainer(node) {
    var container, version;

    var staticSelectors = [
        ['.irc_c[style*="visibility: visible;"][style*="transform: translate3d(0px, 0px, 0px);"]', VERSIONS.FEB18],
        ['.irc_c[data-ved]', VERSIONS.JUL19],
    ];
    for (var i = 0; i < OCT19_CONTAINER_SELECTORS.length; i++) {
        staticSelectors.push([OCT19_CONTAINER_SELECTORS[i], VERSIONS.OCT19]);
    }

    for (const [selector, ver] of staticSelectors) {
        container = node.closest(selector);
        if (container) {
            return [container, ver];
        }
    }

    if (DEBUG)
        console.log('ViewImage: container class name was not found statically!');

    // If no static selector matched, try dynamic lookup
    let img = node;
    if (img.tagName !== 'IMG') {
        img = node.querySelector('img[src][style][jsaction]') || node.closest('img[src][style][jsaction]');
    }

    if (img && img.tagName === 'IMG') {
        const dynamicSelectors = [
            'div[data-lhcontainer]',
            '[data-lhcontainer]'
        ];

        for (const selector of dynamicSelectors) {
            container = img.closest(selector);
            if (container) {
                version = VERSIONS.OCT19;
                return [container, version];
            }
        }
    }

    if (DEBUG)
        console.log('ViewImage: container class name was not found dynamically!');

    return [null, null];
}


function clearExtElements(container) {
    var oldExtensionElements = container.querySelectorAll('.vi_ext_addon');
    for (var element of oldExtensionElements) {
        element.remove();
    }
}


// Dynamically discovers the visit button class name by traversing DOM relative to an image element
function findVisitButtonClassName() {
    var vbClassName = null;
    var imgEl = document.querySelector('img[src][style][jsaction]');
    if (!imgEl) return null;

    var traversals = [
        function (el) { return el.parentElement.parentElement.parentElement.nextSibling.querySelector('div a span').parentElement.parentElement; },
        function (el) { return el.parentElement.parentElement.parentElement.nextSibling.nextSibling.querySelector('div a span').parentElement.parentElement; },
        function (el) { return el.parentElement.parentElement.parentElement.nextSibling.querySelector('div a div').parentElement; },
        function (el) { return el.parentElement.parentElement.nextSibling.querySelector('div a span').parentElement.parentElement; },
        function (el) { return el.parentElement.parentElement.nextSibling.nextSibling.querySelector('div a span').parentElement.parentElement; },
    ];

    for (var i = 0; i < traversals.length; i++) {
        try {
            vbClassName = traversals[i](imgEl).className.split(' ')[0];
        } catch {
            if (DEBUG)
                console.log('ViewImage: vbClassName not found via traversal ' + i);
        }
    }

    return vbClassName;
}


function findImageURL(container, version) {

    var image = null;

    switch (version) {
        case VERSIONS.FEB18:
            image = container.querySelector('img[src]#irc_mi, img[alt^="Image result"][src]:not([src^="https://encrypted-tbn"]).irc_mut, img[src].irc_mi');
            break;
        case VERSIONS.JUL19:
            var iframe = container.querySelector('iframe.irc_ifr');
            if (!iframe)
                return findImageURL(container, VERSIONS.FEB18);
            try {
                image = iframe.contentDocument.querySelector('img#irc_mi');
            } catch {
                if (DEBUG)
                    console.log('ViewImage: Could not access iframe content');
            }
            break;
        case VERSIONS.OCT19:
            image = container.querySelector('img[src][style][jsaction]');
            if (image && image.src in images) {
                return images[image.src];
            }
    }

    // Override url for images using base64 embeds
    if (image === null || image.src === '' || image.src.startsWith('data')) {
        var thumbnail = document.querySelector('img[name="' + container.dataset.itemId + '"]');
        if (thumbnail === null) {
            var url = new URL(window.location);
            var imgLink = url.searchParams.get('imgurl');
            if (imgLink) {
                return imgLink;
            }
        } else {
            var meta = thumbnail.closest('.rg_bx').querySelector('.rg_meta');
            var metadata = JSON.parse(meta.innerHTML);
            return metadata.ou;
        }
    }

    // If the above doesn't work, use the link in related images to find it
    if (image === null || image.src === '' || image.src.startsWith('data')) {
        var target_image = container.querySelector('img.target_image');
        if (target_image) {
            var link = target_image.closest('a');
            if (link) {
                if (link.href.match(/^[a-z]+:\/\/(?:www\.)?google\.[^/]*\/imgres\?/)) {
                    var link_url = new URL(link.href);
                    var new_imgLink = link_url.searchParams.get('imgurl');
                    if (new_imgLink) {
                        return new_imgLink;
                    }
                } else {
                    return link.href;
                }
            }
        }
    }

    if (image) {
        return image.src;
    }

}

function addViewImageButton(container, imageURL, version, vbClassName) {

    var visitButton;
    switch (version) {
        case VERSIONS.FEB18:
            visitButton = container.querySelector('td > a.irc_vpl[href]').parentElement;
            break;
        case VERSIONS.JUL19:
            visitButton = container.querySelector('a.irc_hol[href]');
            break;
        case VERSIONS.OCT19:
            visitButton = container.querySelector('.ZsbmCf[href], a.J2oL9c, a.jAklOc, a.uZ49bd, a.e0XTue, a.kWgFk, a.j7ZI7c' + (vbClassName ? ', a.' + vbClassName : ''));
            break;
    }

    if (!visitButton) {
        if (DEBUG)
            console.log('ViewImage: Adding View-Image button failed, visit button was not found.');
        return false;
    }

    var viewImageButton = visitButton.cloneNode(true);
    viewImageButton.classList.add('vi_ext_addon');

    var viewImageLink;
    switch (version) {
        case VERSIONS.FEB18:
            viewImageLink = viewImageButton.querySelector('a');
            break;
        default:
            viewImageLink = viewImageButton;
    }

    if (imageURL && !imageURL.startsWith('https://encrypted-tbn0.gstatic.com')) {
        viewImageLink.href = imageURL;
    } else {
        viewImageLink.style = 'pointer-events: none;';
        viewImageLink.title = 'No full-sized image was found.';

        var viewImageDiv = viewImageLink.querySelector('div');
        if (viewImageDiv) {
            viewImageDiv.style = 'background-color: #707070; border-color: #707070;';
        }
    }

    if (version === VERSIONS.OCT19) {
        viewImageLink.removeAttribute('jsaction');
    }

    viewImageLink.removeAttribute('target');

    if (options['open-in-new-tab']) {
        viewImageLink.setAttribute('target', '_blank');
    }
    if (options['no-referrer']) {
        viewImageLink.setAttribute('rel', 'noreferrer');
    }

    if (imageURL && imageURL.startsWith('data')) {
        viewImageButton.setAttribute('download', '');
    }

    var viewImageButtonText;
    switch (version) {
        case VERSIONS.FEB18:
            viewImageButtonText = viewImageButton.querySelector('.Tl8XHc');
            break;
        case VERSIONS.JUL19:
            viewImageButtonText = viewImageButton.querySelector('.irc_ho');
            break;
        case VERSIONS.OCT19:
            viewImageButtonText = viewImageButton.querySelector('.pM4Snf, .KSvtLc, .Pw5kW, .q7UPLe, .K8E1Be, .pFBf7b, span');
            break;
    }

    if (options['manually-set-button-text']) {
        viewImageButtonText.innerText = options['button-text-view-image'];
    } else {
        localiseObject(viewImageButtonText, '__MSG_viewImage__');
    }

    visitButton.parentElement.insertBefore(viewImageButton, visitButton);
    visitButton.parentElement.insertBefore(visitButton, viewImageButton);

    return true;
}


function addSearchImageButton(container, imageURL, version, vbClassName) {

    var link;
    switch (version) {
        case VERSIONS.FEB18:
            link = container.querySelector('.irc_dsh > a.irc_hol');
            break;
        case VERSIONS.JUL19:
            link = container.querySelector('.irc_ft > a.irc_help');
            break;
        case VERSIONS.OCT19:
            link = container.querySelector('.PvkmDc, .qnLx5b, .zSA7pe, .uZ49bd, .e0XTue, .kWgFk, .j7ZI7c' + (vbClassName ? ', .' + vbClassName : ''));
            break;
    }

    if (!link) {
        if (DEBUG)
            console.log('ViewImage: Adding Search-By-Image button failed, link was not found.');
        return;
    }

    var searchImageButton = link.cloneNode(true);
    searchImageButton.classList.add('vi_ext_addon');

    var searchImageButtonText;
    switch (version) {
        case VERSIONS.FEB18:
            searchImageButtonText = container.querySelector('.irc_ho');
            break;
        case VERSIONS.JUL19:
        case VERSIONS.OCT19:
            searchImageButtonText = searchImageButton.querySelector('span');
            break;
    }

    if (options['manually-set-button-text']) {
        searchImageButtonText.innerText = options['button-text-search-by-image'];
    } else {
        searchImageButtonText.innerText = '';
        var lensButton = document.createElement('img');
        lensButton.style.marginTop = '5px';
        lensButton.style.width = '23px';
        lensButton.src = 'https://fonts.gstatic.com/s/i/productlogos/lens_2023q2/v2/192px.svg';
        lensButton.alt = 'Search by image';
        searchImageButtonText.appendChild(lensButton);
    }

    searchImageButton.href = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(imageURL);

    if (options['open-search-by-in-new-tab']) {
        searchImageButton.setAttribute('target', '_blank');
    }

    link.parentElement.insertBefore(searchImageButton, link);
    link.parentElement.insertBefore(link, searchImageButton);

}


function addLinks(node) {

    if (DEBUG)
        console.log('ViewImage: Trying to add links to node: ', node);

    var [container, version] = getContainer(node);

    if (!container) {
        if (DEBUG)
            console.log('ViewImage: Adding links failed, container was not found.');
        return false;
    }

    if (DEBUG)
        console.log('ViewImage: Assuming site version: ', version);

    clearExtElements(container);

    var imageURL = findImageURL(container, version);

    if (!imageURL) {
        if (DEBUG)
            console.log('ViewImage: Adding links failed, image was not found.');
        return false;
    }

    // Compute vbClassName once for both buttons
    var vbClassName = (version === VERSIONS.OCT19) ? findVisitButtonClassName() : null;

    addViewImageButton(container, imageURL, version, vbClassName);
    if (SearchImgBtn)
        addSearchImageButton(container, imageURL, version, vbClassName);

    return true;
}

function parseDataSource(array) {

    if (DEBUG)
        console.log('ViewImage: Parsing data source...');

    var meta;
    try {
        meta = array[31][0][12][2];

        for (var i = 0; i < meta.length; i++) {
            try {
                images[meta[i][1][2][0]] = meta[i][1][3][0];
            } catch {
                if (DEBUG)
                    console.log('ViewImage: Skipping image');
            }
        }
    }
    catch {
        // Fallback data structure path
        meta = array[56][1][0][0][1][0];

        for (var j = 0; j < meta.length; j++) {
            try {
                var data = Object.values(meta[j][0][0])[0];
                images[data[1][2][0]] = data[1][3][0];
            } catch {
                if (DEBUG)
                    console.log('ViewImage: Skipping image');
            }
        }
    }
}

function parseDataSourceType1(params) {
    if (DEBUG)
        console.log('ViewImage: Parsing data source type 1...');

    const data_start_search = /\sdata:\[/;
    const data_end_search = '], ';

    var match = params.match(data_start_search);

    var start_index = match.index + match[0].length - 1;
    var end_index = start_index + params.slice(start_index).indexOf(data_end_search) + 1;

    parseDataSource(JSON.parse(params.slice(start_index, end_index)));
}

// Check if source holds array of images
try {
    const start_search = />AF_initDataCallback\(/g;
    const end_search = ');</script>';
    var htmlContent = document.documentElement.innerHTML;

    var success = false;

    let match;
    while (!success && ((match = start_search.exec(htmlContent)) !== null)) {
        var start_index = match.index + match[0].length;
        var end_index = start_index + htmlContent.slice(start_index).indexOf(end_search);

        var params = htmlContent.slice(start_index, end_index);

        const ds_search = /key:\s'ds:(\d)'/;
        var ds_match = params.match(ds_search);

        if (ds_match === null) {
            continue;
        }

        if (ds_match[1] === '1') {
            parseDataSourceType1(params);
            success = true;
        }
    }

    if (!success) {
        if (DEBUG)
            console.log('ViewImage: Failed to find data source.');
    }
    else if (DEBUG)
        console.log('ViewImage: Successfully created source images array.');

} catch (error) {
    if (DEBUG) {
        console.log('ViewImage: Failed to create source images array.');
        console.error(error);
    }
}


// Define the mutation observers
var observer = new MutationObserver(function (mutations) {

    if (TRACE)
        console.log('ViewImage: Mutations detected: ', mutations);

    var node, imgClassName;
    try {
        imgClassName = document.querySelector('img[src][style][jsaction]').className.split(' ')[0];
    } catch {
        imgClassName = null;
    }
    for (var mutation of mutations) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            for (node of mutation.addedNodes) {
                if (node.classList) {
                    var classesToCheck = ['irc_mi', 'irc_mut', 'irc_ris'];
                    if (imgClassName) classesToCheck.push(imgClassName);
                    if (classesToCheck.some(className => node.classList.contains(className))) {
                        addLinks(node);
                    }
                }
            }
        }

        if (imgClassName && mutation.target.classList && mutation.target.classList.contains(imgClassName)) {
            node = null;
            for (var i = 0; i < OCT19_CONTAINER_SELECTORS.length; i++) {
                node = mutation.target.closest(OCT19_CONTAINER_SELECTORS[i]);
                if (node) break;
            }

            if (node && !node.hasAttribute('aria-hidden')) {
                addLinks(node);
            }
        }
    }
});

// Get options and start adding links
chrome.storage.sync.get(['options', 'defaultOptions'], function (storage) {
    options = Object.assign({}, storage.defaultOptions || {}, storage.options || {});

    if (DEBUG)
        console.log('ViewImage: Initialising observer...');

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'src', 'style']
    });
});

// inject CSS into document
if (DEBUG)
    console.log('ViewImage: Injecting CSS...');

var customStyle = document.createElement('style');
customStyle.innerText = `
.irc_dsh>.irc_hol.vi_ext_addon,
.irc_ft>.irc_help.vi_ext_addon,
.PvkmDc.vi_ext_addon,
.qnLx5b.vi_ext_addon
{
margin: 0 4pt!important
}

.irc_hol.vi_ext_addon
{
flex-grow:0!important
}

.zSA7pe[href^="/searchbyimage"] {
margin-left: 4px;
}

.ZsbmCf.vi_ext_addon{
flex-grow:0
}`;
document.head.appendChild(customStyle);
