import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const userscriptPath = path.join(rootDir, 'dist', 'viewimage.user.js');

test.beforeAll(() => {
    execFileSync(process.execPath, [path.join(rootDir, 'scripts', 'build-userscript.mjs')]);
});

async function gotoGooglePanel(page, { lang = 'en', url = 'https://www.google.com/search?q=otters&udm=2' } = {}) {
    await page.route('https://www.google.com/**', route => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><html lang="${lang}"><body>
            <div data-lhcontainer="1">
                <div data-id="DOC1">
                    <a href="https://example.com/page"><img src="https://example.com/full.jpg" alt=""></a>
                    <h1 id="ucc-0">Title</h1>
                    <a aria-describedby="ucc-0" href="https://example.com/page"><div aria-label="Visit"><span>Visit</span></div></a>
                </div>
            </div>
        </body></html>`,
    }));
    await page.goto(url);
}

test('header matches every Google domain on /search and /imgres', () => {
    const source = fs.readFileSync(userscriptPath, 'utf8');
    const tlds = JSON.parse(fs.readFileSync(path.join(rootDir, 'scripts', 'google-tlds.json'), 'utf8'));
    const matches = [...source.matchAll(/^\/\/ @match\s+(\S+)$/gm)].map(m => m[1]);

    expect(matches).toHaveLength(tlds.length * 2);
    expect(matches).toContain('*://*.google.com/search*');
    expect(matches).toContain('*://*.google.co.uk/imgres*');

    const { version } = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(source).toContain(`// @version         ${version}\n`);
});

test('runs without extension APIs and adds working buttons', async ({ page }) => {
    await gotoGooglePanel(page);
    expect(await page.evaluate(() => typeof window.chrome?.storage)).toBe('undefined');
    await page.addScriptTag({ path: userscriptPath });

    const buttons = page.locator('.vi_ext_addon');
    await expect(buttons).toHaveCount(2);
    await expect(buttons.nth(1)).toHaveText('View image');
    await expect(buttons.nth(1)).toHaveAttribute('href', 'https://example.com/full.jpg');
    await expect(buttons.nth(0).locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);

    // Nothing leaks into the page's global scope.
    expect(await page.evaluate(() => [typeof VIEW_IMAGE_DEFAULT_OPTIONS, typeof USER_OPTIONS])).toEqual(['undefined', 'undefined']);
});

test('localises button text from the page language', async ({ page }) => {
    await gotoGooglePanel(page, { lang: 'de' });
    await page.addScriptTag({ path: userscriptPath });

    await expect(page.locator('.vi_ext_addon').nth(1)).toHaveText('Bild ansehen');
});

test('does nothing outside image search', async ({ page }) => {
    await gotoGooglePanel(page, { url: 'https://www.google.com/search?q=otters' });
    await page.addScriptTag({ path: userscriptPath });
    await page.waitForTimeout(100);

    await expect(page.locator('.vi_ext_addon')).toHaveCount(0);
});
