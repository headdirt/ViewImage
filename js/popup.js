'use strict';

document.getElementById('options-page').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

const manifestData = chrome.runtime.getManifest();
chrome.runtime.getPlatformInfo(info => {
    const debugString = `v${manifestData.version} (${info.os} ${info.nacl_arch}) - ${manifestData.current_locale}`;
    document.getElementById('debug').innerText = debugString;
});
