![Icon](icon/128.png)
# View Image

[![CI](https://github.com/headdirt/ViewImage/actions/workflows/main.yml/badge.svg)](https://github.com/headdirt/ViewImage/actions/workflows/main.yml)

View Image is a Chrome / Firefox extension that re-implements the "View image" button in Google Image Search.

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

### Userscript

A userscript version is published as a [gist](https://gist.github.com/headdirt/1af7759b4e3faf544a802e5300428a80) for Tampermonkey, Violentmonkey and similar managers. It is generated from the extension source, so both behave the same; options are set by editing `USER_OPTIONS` at the top of the script.

## Development

Install dependencies:

```sh
npm ci
```

Run checks:

```sh
npm run lint
npm run lint:extension
npm test
```

If you edit the TLD list or manifest structure, run `npm run manifest`.

Build the userscript into `dist/viewimage.user.js` (never edit the gist by hand; it is overwritten from this output):

```sh
npm run userscript
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

Google's class names are obfuscated and change every few months, so `js/content-script.js` avoids them entirely:

- The manifest injects on `/search`; `isImageSearchURL()` decides whether the page is Images (`udm=2`, `udm=imgs` or legacy `tbm=isch`).
- The preview panel is `[data-lhcontainer]`. The "Visit" button is the link described by the result title (`a[aria-describedby]`), and the preview image is inside the other link to the same page.
- If the full-size image failed to load, its URL is looked up by result id in the data Google embeds in the page (first page of results only).

## Credits

- Original extension by [Joshua Butt](https://github.com/bijij)
- Updated userscript with working Google Images fixes by [ner00](https://github.com/ner00) - [userscript gist](https://gist.github.com/ner00/ec9ae47e202b8e99f19be44a5af6baf3)
- More accurate URL collection thanks to [devunt](https://github.com/devunt)/[make-gis-great-again](https://github.com/devunt/make-gis-great-again)
- Icon by [Daniel Hickman](https://github.com/danielhickman)
