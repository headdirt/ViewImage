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

## Development

Install dependencies:

```sh
npm ci
```

Run checks:

```sh
npm run lint
npm run lint:extension
```

If you edit the TLD list or manifest structure, run `npm run manifest`.

Build a release zip:

```sh
npm run build
```

Run the live smoke test:

```sh
RUN_EXTENSION_SMOKE=1 npm run smoke
```

The smoke test opens a headed Chromium browser with the extension loaded and checks Google Images. It is skipped by default because it depends on network access and the current Google Images UI.

## Credits

- Original extension by [Joshua Butt](https://github.com/bijij)
- Updated userscript with working Google Images fixes by [ner00](https://github.com/ner00) - [userscript gist](https://gist.github.com/ner00/ec9ae47e202b8e99f19be44a5af6baf3)
- More accurate URL collection thanks to [devunt](https://github.com/devunt)/[make-gis-great-again](https://github.com/devunt/make-gis-great-again)
- Icon by [Daniel Hickman](https://github.com/danielhickman)
