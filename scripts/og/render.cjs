// Renders the social share image and the icon set from HTML/SVG sources.
//   node scripts/og/render.cjs <path-to-a-folder-with-puppeteer-installed>
// (puppeteer is not a project dependency – any local install works.)
// Output: public/og/og-boarding-pass.jpg (1200×630) and public/icons/*.png
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const puppeteer = require(require.resolve('puppeteer', { paths: [process.argv[2] || root] }));

(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();

  // 1) share image
  fs.mkdirSync(path.join(root, 'public/og'), { recursive: true });
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(__dirname, 'og.html').replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(root, 'public/og/og-boarding-pass.jpg'), type: 'jpeg', quality: 88 });

  // 2) icons from the favicon SVG (dark tile, gold "Í")
  fs.mkdirSync(path.join(root, 'public/icons'), { recursive: true });
  const svg = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
  for (const [name, size, full] of [
    ['favicon-32.png', 32, false],
    ['apple-touch-icon.png', 180, true], // iOS rounds the corners itself → full-bleed square
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
  ]) {
    await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const html = `<html><body style="margin:0;background:${full ? '#05030a' : 'transparent'}">${svg
      .replace('<svg ', `<svg width="${size}" height="${size}" `)
      .replace(full ? /rx="14"/ : /$^/, 'rx="0"')
      .replace(full ? /<rect x="2"[^>]*\/>/ : /$^/, '')}</body></html>`; // iOS: no ring (it would be cut by the mask)
    await p.setContent(html);
    await p.screenshot({ path: path.join(root, 'public/icons', name), omitBackground: !full });
  }
  console.log('rendered: public/og/og-boarding-pass.jpg, public/icons/*.png');
  await b.close();
})();
