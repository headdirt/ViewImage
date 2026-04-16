import fs from 'node:fs';
import path from 'node:path';

const SENTINEL = '__GOOGLE_TLD_MATCHES__';
const rootDir = path.resolve(import.meta.dirname, '..');
const templatePath = path.join(rootDir, 'scripts', 'manifest.template.json');
const tldsPath = path.join(rootDir, 'scripts', 'google-tlds.json');
const manifestPath = path.join(rootDir, 'manifest.json');

const template = fs.readFileSync(templatePath, 'utf8');
const googleTlds = JSON.parse(fs.readFileSync(tldsPath, 'utf8'));
const templateData = JSON.parse(template);

const matches = googleTlds.map((tld) => `*://*.${tld}/*`);
const sentinelToken = JSON.stringify(SENTINEL);

function countSentinelValues(value) {
    if (value === SENTINEL) {
        return 1;
    }

    if (Array.isArray(value)) {
        return value.reduce((total, item) => total + countSentinelValues(item), 0);
    }

    if (value && typeof value === 'object') {
        return Object.values(value).reduce((total, item) => total + countSentinelValues(item), 0);
    }

    return 0;
}

function formatArrayAtToken(source, tokenIndex, values) {
    const lineStart = source.lastIndexOf('\n', tokenIndex) + 1;
    const baseIndent = source.slice(lineStart).match(/^\s*/)[0];
    const itemIndent = `${baseIndent}    `;
    const items = values.map((value) => `${itemIndent}${JSON.stringify(value)}`);

    return `[\n${items.join(',\n')}\n${baseIndent}]`;
}

function replaceSentinels(source, expectedReplacements) {
    let result = '';
    let cursor = 0;
    let replacements = 0;

    while (true) {
        const tokenIndex = source.indexOf(sentinelToken, cursor);

        if (tokenIndex === -1) {
            result += source.slice(cursor);
            break;
        }

        result += source.slice(cursor, tokenIndex);
        result += formatArrayAtToken(source, tokenIndex, matches);
        cursor = tokenIndex + sentinelToken.length;
        replacements += 1;
    }

    if (replacements !== expectedReplacements) {
        throw new Error(`Expected ${expectedReplacements} ${SENTINEL} sentinels, replaced ${replacements}`);
    }

    return result;
}

const sentinelCount = countSentinelValues(templateData);

if (sentinelCount === 0) {
    throw new Error(`No ${SENTINEL} sentinels found in ${templatePath}`);
}

const manifest = replaceSentinels(template, sentinelCount);

JSON.parse(manifest);
fs.writeFileSync(manifestPath, manifest.endsWith('\n') ? manifest : `${manifest}\n`);
