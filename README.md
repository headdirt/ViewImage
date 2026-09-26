![Icon](icon/128.png)
# View Image Lite

[![CI](https://github.com/headdirt/ViewImage/actions/workflows/main.yml/badge.svg)](https://github.com/headdirt/ViewImage/actions/workflows/main.yml)

View Image is a Chrome / Firefox extension that re-implements the "View image" button in Google Image Search.

View Image Lite is the minimal edition of [View Image](https://github.com/headdirt/ViewImage): one content script, no permissions, no options. It adds a single "View image" button (always opens in a new tab) next to Google's "Visit" button. It lives on the `lite` branch, is versioned separately (tags `lite-v*`), and has its own Firefox add-on ID, so it can be installed alongside View Image.

This repository is a maintained fork of [bijij/ViewImage](https://github.com/bijij/ViewImage). The original browser store listings are not maintained from this fork.

## Install

This fork is distributed from GitHub only.

### Chrome / Edge development install

1. Download this repository or a release artifact from GitHub.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Choose "Load unpacked" and select the repository directory.

### Firefox development install

1. Download this repository or a release artifact from GitHub.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose "Load Temporary Add-on".
4. Select `manifest.json` from the repository directory.

Firefox temporary add-ons are removed when Firefox restarts. This fork does not currently maintain an AMO listing or signed self-distributed releases.

## Development

Install dependencies:

```sh
npm ci
```

Run checks:

```sh
npm run lint
npm test
```

Build a release zip:

```sh
npm run build
```

Run the live smoke test:

```sh
RUN_EXTENSION_SMOKE=1 npm run smoke
```

The smoke test opens a headed Chromium browser with the extension loaded and checks Google Images. It is skipped by default because it depends on network access and the current Google Images UI. Google serves a bot check to headless browsers, so it has to run headed.

### How the content script finds things

Google's class names are obfuscated and change every few months, so `content-script.js` avoids them entirely:

- The manifest injects on `/search`; `isImageSearch()` decides whether the page is Images (`udm=2`, `udm=imgs` or legacy `tbm=isch`).
- The preview panel is `[data-lhcontainer]`. The "Visit" button is the link described by the result title (`a[aria-describedby]`), and the preview image is inside the other link to the same page.
- Until the full-size image has loaded (or if it failed to), its URL is looked up by result id in the data Google embeds in the page (first page of results only). Otherwise no button is shown.

## Credits

- Original extension by [Joshua Butt](https://github.com/bijij)
- Updated userscript with working Google Images fixes by [ner00](https://github.com/ner00) - [userscript gist](https://gist.github.com/ner00/ec9ae47e202b8e99f19be44a5af6baf3)
- More accurate URL collection thanks to [devunt](https://github.com/devunt)/[make-gis-great-again](https://github.com/devunt/make-gis-great-again)
- Icon by [Daniel Hickman](https://github.com/danielhickman)
