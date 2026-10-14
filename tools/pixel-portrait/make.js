// Makes the video game theme's 8-bit versions of the profile photos.
// Usage (from this folder): npm install, then node make.js
//
// For each entry in settings.json it:
//   1. asks macOS (Vision) where the person is in the photo, and where their facial features are
//   2. turns photo + mask into pixel art in headless Chrome (sprite.html)
//   3. saves resources/img/<name>.png, plus work/preview.png showing everything scaled up
const { execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const repoRoot = path.resolve(__dirname, '../..');
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));

fs.mkdirSync(path.join(__dirname, 'work'), { recursive: true });
for (const s of settings) {
    const run = (script, output) => {
        console.log(`${script}: ${s.photo} -> ${output}`);
        execFileSync('swift', [script, s.photo, output], { cwd: __dirname, stdio: ['ignore', 'ignore', 'inherit'] });
    };
    run('segment.swift', s.mask);
    if (s.landmarks) {
        run('landmarks.swift', s.landmarks);
    }
}

// Serve the whole repo so sprite.html can load the photos with the relative paths in settings.json
const types = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    const file = path.join(repoRoot, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end();
        }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    });
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
    const tab = await browser.newPage();
    await tab.goto(`http://127.0.0.1:${server.address().port}/tools/pixel-portrait/sprite.html`);

    const previews = [];
    for (const s of settings) {
        const dataUrl = await tab.evaluate(options => makeSprite(options), s);
        const output = path.join(repoRoot, 'resources/img', s.name + '.png');
        fs.writeFileSync(output, Buffer.from(dataUrl.split(',')[1], 'base64'));
        console.log('wrote', path.relative(repoRoot, output));
        previews.push(`<figure><img src="${dataUrl}"><figcaption>${s.name}</figcaption></figure>`);
    }

    // Each image at 4x with crisp pixels, on the theme's sky blue
    await tab.setViewport({ width: 400, height: 300 });
    await tab.setContent(`<style>
        body { margin: 0; padding: 20px; width: max-content; display: flex; gap: 24px; background: #6b8cff; color: #fff; font: 14px monospace; }
        figure { margin: 0; text-align: center; }
        img { display: block; width: 192px; height: 192px; image-rendering: pixelated; background: #ffd23f; }
    </style>${previews.join('')}`);
    await tab.screenshot({ path: path.join(__dirname, 'work/preview.png'), fullPage: true });
    console.log('preview: tools/pixel-portrait/work/preview.png');

    await browser.close();
    server.close();
})();
