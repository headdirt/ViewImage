import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '../..');

test('adds View image controls on Google Images', async () => {
    test.skip(process.env.RUN_EXTENSION_SMOKE !== '1', 'Set RUN_EXTENSION_SMOKE=1 to run the live browser smoke test.');

    const userDataDir = path.join(process.cwd(), '.tmp-playwright-profile');
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    const browserName = process.env.PLAYWRIGHT_BROWSER_CHANNEL || (executablePath ? undefined : 'chrome');
    const context = await chromium.launchPersistentContext(userDataDir, {
        channel: browserName,
        executablePath,
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    });

    try {
        const page = await context.newPage();
        await page.goto('https://www.google.com/search?tbm=isch&q=puppies', {
            waitUntil: 'domcontentloaded',
        });

        await page.locator('img').first().click();
        await expect(page.locator('.vi_ext_addon').first()).toBeVisible();
    } finally {
        await context.close();
    }
});
