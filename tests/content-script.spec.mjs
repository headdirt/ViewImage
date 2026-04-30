import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '..');

async function loadContentScript(page, options = {}) {
    await page.evaluate((mockOptions) => {
        window.chrome = {
            i18n: {
                getMessage(key) {
                    const messages = {
                        viewImage: 'View image',
                    };
                    return messages[key] || key;
                },
            },
            runtime: {
                getURL(pathname) {
                    return `chrome-extension://view-image/${pathname}`;
                },
            },
            storage: {
                sync: {
                    get(_keys, callback) {
                        callback({ options: mockOptions });
                    },
                },
            },
        };
    }, options);

    await page.addScriptTag({ path: path.join(extensionPath, 'js/default-options.js') });
    await page.addScriptTag({ path: path.join(extensionPath, 'js/extension-api.js') });
    await page.addScriptTag({ path: path.join(extensionPath, 'js/i18n.js') });
    await page.addScriptTag({ path: path.join(extensionPath, 'js/content-script.js') });
}

async function setGoogleImageFixture(page, imageSrc = 'https://example.com/full.jpg') {
    await page.setContent(`
        <main>
            <section class="tvh9oe">
                <img class="preview-image" src="${imageSrc}" style="width: 100px" jsaction="x" />
                <nav>
                    <a class="ZsbmCf" href="https://example.com/page" jsaction="visit"><span>Visit</span></a>
                    <a class="PvkmDc" href="https://images.google.com/searchbyimage"><span>Search</span></a>
                </nav>
            </section>
        </main>
    `);
}

test('injects controls into already-rendered Google Images markup', async ({ page }) => {
    await setGoogleImageFixture(page);
    await loadContentScript(page);

    await expect(page.locator('.vi_ext_addon')).toHaveCount(2);

    const viewImage = page.locator('.vi_ext_addon').first();
    await expect(viewImage).toHaveAttribute('href', 'https://example.com/full.jpg');
    await expect(viewImage).toHaveAttribute('target', '_blank');
    await expect(viewImage).toHaveAttribute('rel', 'noopener');
    await expect(viewImage).toContainText('View image');

    const searchImage = page.locator('.vi_ext_addon').nth(1);
    await expect(searchImage).toHaveAttribute(
        'href',
        'https://lens.google.com/uploadbyurl?url=https%3A%2F%2Fexample.com%2Ffull.jpg'
    );
});

test('applies link privacy options when rendering controls', async ({ page }) => {
    await setGoogleImageFixture(page);
    await loadContentScript(page, {
        'no-referrer': true,
        'open-search-by-in-new-tab': false,
    });

    const viewImage = page.locator('.vi_ext_addon').first();
    await expect(viewImage).toHaveAttribute('rel', 'noopener noreferrer');

    const searchImage = page.locator('.vi_ext_addon').nth(1);
    await expect(searchImage).not.toHaveAttribute('target', '_blank');
    await expect(searchImage).not.toHaveAttribute('rel', 'noopener');
});

test('falls back to related image links when preview src is embedded data', async ({ page }) => {
    await setGoogleImageFixture(
        page,
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
    );
    await page.locator('.tvh9oe').evaluate(container => {
        const link = document.createElement('a');
        link.href = 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Ffallback.jpg';
        const img = document.createElement('img');
        img.className = 'target_image';
        link.appendChild(img);
        container.appendChild(link);
    });
    await loadContentScript(page);

    await expect(page.locator('.vi_ext_addon').first()).toHaveAttribute(
        'href',
        'https://example.com/fallback.jpg'
    );
});
