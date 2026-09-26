import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..');

const IMAGE_SEARCH_URL = 'https://www.google.com/search?q=otters&udm=2';
const PAGE_URL = 'https://example.com/page';
const FULL_URL = 'https://example.com/full.jpg';
const THUMBNAIL_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:thumb&s=10';
const FAVICON_URL = 'https://encrypted-tbn2.gstatic.com/faviconV2?url=https://example.com';

async function loadContentScript(page, options = {}) {
    await page.evaluate((mockOptions) => {
        window.chrome = {
            i18n: {
                getMessage(key) {
                    const messages = {
                        viewImage: 'View image',
                        searchImage: 'Search by image',
                    };
                    return messages[key] || key;
                },
            },
            storage: {
                sync: {
                    async get() {
                        return { options: mockOptions };
                    },
                },
            },
        };
    }, options);

    await page.addScriptTag({ path: path.join(extensionPath, 'js/default-options.js') });
    await page.addScriptTag({ path: path.join(extensionPath, 'js/i18n.js') });
    await page.addScriptTag({ path: path.join(extensionPath, 'js/content-script.js') });
}

// Mirrors the structure of Google's preview panel (Sept 2026), with class names
// deliberately randomised: the content script must not depend on them.
function panelHTML({ docId = 'DOC1', pageURL = PAGE_URL, fullURL = FULL_URL } = {}) {
    const fullImage = fullURL ? `<img class="q1" jsname="kn3ccd" src="${fullURL}" alt="Otter">` : '';
    return `
        <div class="x9" data-lhcontainer="1" jsaction="rcuQ6b:npT2md">
            <div class="x8" data-id="${docId}">
                <a rel="noopener" target="_blank" href="${pageURL}">
                    <img class="q2" src="${FAVICON_URL}" alt=""><span>Example</span>
                </a>
                <a rel="noopener" target="_blank" href="${pageURL}" class="q3" aria-label="Visit Example">
                    ${fullImage}
                    <img class="q4" jsname="JuXqh" src="${THUMBNAIL_URL}" alt="Otter">
                </a>
                <div>
                    <a rel="noopener" target="_blank" href="${pageURL}"><h1 id="ucc-0">Otter - Example</h1></a>
                    <a aria-describedby="ucc-0" rel="noopener" target="_blank" href="${pageURL}"
                       class="q5" data-ved="0CBoQ3YkB" ping="/url?sa=t&amp;url=x" jsaction="visit">
                        <div class="q6" aria-label="Visit" jsname="abc"><span class="q7" jsaction="t">Visit</span></div>
                    </a>
                </div>
                <div class="related">
                    <a href="https://other.example/"><img src="https://other.example/related.jpg" alt=""></a>
                </div>
            </div>
        </div>
    `;
}

async function gotoGooglePage(page, url = IMAGE_SEARCH_URL, body = '') {
    await page.route('https://www.google.com/**', route => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><body>${body}</body>`,
    }));
    await page.goto(url);
}

const addons = page => page.locator('.vi_ext_addon');
const searchButton = page => addons(page).nth(0);
const viewImageButton = page => addons(page).nth(1);

test('adds Search by image and View image after the Visit button', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML());
    await loadContentScript(page);

    await expect(addons(page)).toHaveCount(2);
    const order = await page.locator('a[aria-describedby] ~ a').evaluateAll(
        links => links.map(a => a.textContent.trim() || a.querySelector('img')?.alt)
    );
    expect(order).toEqual(['Search by image', 'View image']);

    await expect(viewImageButton(page)).toHaveAttribute('href', FULL_URL);
    await expect(viewImageButton(page)).toHaveAttribute('target', '_blank');
    await expect(viewImageButton(page)).toHaveAttribute('rel', 'noopener');
    await expect(viewImageButton(page)).toHaveText('View image');
    await expect(viewImageButton(page).locator('[aria-label]')).toHaveAttribute('aria-label', 'View image');

    await expect(searchButton(page)).toHaveAttribute(
        'href',
        `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(FULL_URL)}`
    );
    await expect(searchButton(page).locator('img.vi_ext_icon')).toHaveAttribute(
        'src', /^data:image\/svg\+xml,/
    );
});

test('strips Google click handlers and click tracking from cloned buttons', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML());
    await loadContentScript(page);

    await expect(addons(page)).toHaveCount(2);
    const leftovers = await addons(page).evaluateAll(buttons => buttons.flatMap(button =>
        [button, ...button.querySelectorAll('*')].flatMap(el =>
            ['jsaction', 'jsname', 'ping', 'data-ved', 'aria-describedby', 'id'].filter(a => el.hasAttribute(a))
        )
    ));
    expect(leftovers).toEqual([]);
});

for (const url of [
    'https://www.google.com/search?q=otters&udm=2',
    'https://www.google.com/search?q=otters&udm=imgs',
    'https://www.google.com/search?q=otters&tbm=isch',
]) {
    test(`runs on image search URL ${url}`, async ({ page }) => {
        await gotoGooglePage(page, url, panelHTML());
        await loadContentScript(page);

        await expect(addons(page)).toHaveCount(2);
    });
}

for (const url of [
    'https://www.google.com/search?q=otters',
    'https://www.google.com/search?q=otters&udm=28',
    'https://www.google.com/search?q=udm%3D2',
]) {
    test(`does not run on non-image URL ${url}`, async ({ page }) => {
        await gotoGooglePage(page, url, panelHTML());
        await loadContentScript(page);
        await page.waitForTimeout(100);

        await expect(addons(page)).toHaveCount(0);
    });
}

test('applies link privacy and new-tab options', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML());
    await loadContentScript(page, {
        'no-referrer': true,
        'open-search-by-in-new-tab': false,
    });

    await expect(viewImageButton(page)).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(searchButton(page)).not.toHaveAttribute('target');
    await expect(searchButton(page)).not.toHaveAttribute('rel');
});

test('uses manually set button text', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML());
    await loadContentScript(page, {
        'manually-set-button-text': true,
        'button-text-view-image': 'Open',
        'button-text-search-by-image': 'Lens',
    });

    await expect(viewImageButton(page)).toHaveText('Open');
    await expect(searchButton(page)).toHaveText('Lens');
    await expect(searchButton(page).locator('img')).toHaveCount(0);
});

test('falls back to page data when the full-size image failed to load', async ({ page }) => {
    const pageData = '<script>var d={"a1":[1,[0,"DOC1",["https://encrypted-tbn0.gstatic.com/images?q\\u003dtbn:x\\u0026s",215,235],' +
        '["https://example.com/from-data.jpg?a\\u003d1\\u0026b\\u003d2",843,922],"x"]]};</script>';
    await gotoGooglePage(page, IMAGE_SEARCH_URL, pageData + panelHTML({ fullURL: null }));
    await loadContentScript(page);

    await expect(viewImageButton(page)).toHaveAttribute('href', 'https://example.com/from-data.jpg?a=1&b=2');
});

test('shows disabled buttons when no full-size image URL is available', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML({ fullURL: null }));
    await loadContentScript(page);

    for (const button of [viewImageButton(page), searchButton(page)]) {
        await expect(button).not.toHaveAttribute('href');
        await expect(button).not.toHaveAttribute('target');
        await expect(button).toHaveAttribute('aria-disabled', 'true');
        await expect(button).toHaveClass(/vi_ext_disabled/);
    }
    await expect(viewImageButton(page)).toHaveAttribute('title', 'No full-sized image was found.');
});

test('updates buttons when the panel switches to another result', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML());
    await loadContentScript(page);
    await expect(viewImageButton(page)).toHaveAttribute('href', FULL_URL);

    await page.evaluate(() => {
        const panel = document.querySelector('[data-lhcontainer]');
        panel.querySelector('[data-id]').dataset.id = 'DOC2';
        for (const a of panel.querySelectorAll('a[href="https://example.com/page"]:not(.vi_ext_addon)')) {
            a.href = 'https://example.com/second';
        }
        panel.querySelector('img[jsname="kn3ccd"]').src = 'https://example.com/second.jpg';
    });

    await expect(viewImageButton(page)).toHaveAttribute('href', 'https://example.com/second.jpg');
    await expect(addons(page)).toHaveCount(2);
});

test('upgrades disabled buttons once the full-size image appears', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML({ fullURL: null }));
    await loadContentScript(page);
    await expect(viewImageButton(page)).toHaveAttribute('aria-disabled', 'true');

    await page.evaluate(fullURL => {
        const img = document.createElement('img');
        img.src = fullURL;
        document.querySelector('[aria-label="Visit Example"]').prepend(img);
    }, FULL_URL);

    await expect(viewImageButton(page)).toHaveAttribute('href', FULL_URL);
    await expect(viewImageButton(page)).not.toHaveAttribute('aria-disabled');
    await expect(addons(page)).toHaveCount(2);
});

test('re-adds buttons when Google re-renders the button row', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML());
    await loadContentScript(page);
    await expect(addons(page)).toHaveCount(2);

    await page.evaluate(() => {
        for (const el of document.querySelectorAll('.vi_ext_addon')) el.remove();
        const row = document.querySelector('a[aria-describedby]').parentElement;
        row.replaceWith(row.cloneNode(true));
    });

    await expect(addons(page)).toHaveCount(2);
});

test('handles preloaded panels and panels added after load', async ({ page }) => {
    await gotoGooglePage(page, IMAGE_SEARCH_URL, panelHTML());
    await loadContentScript(page);
    await expect(addons(page)).toHaveCount(2);

    await page.evaluate(html => {
        document.body.insertAdjacentHTML('beforeend', html);
    }, panelHTML({ docId: 'DOC2', pageURL: 'https://example.com/two', fullURL: 'https://example.com/two.jpg' }));

    await expect(addons(page)).toHaveCount(4);
    await expect(page.locator('[data-id="DOC2"] .vi_ext_addon').nth(1)).toHaveAttribute(
        'href', 'https://example.com/two.jpg'
    );
});
