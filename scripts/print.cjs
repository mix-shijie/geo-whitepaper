'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const root = path.resolve(__dirname, '..');
const playwright = process.env.WHITEPAPER_PLAYWRIGHT || 'playwright';
const executablePath = process.env.WHITEPAPER_CHROMIUM;
const {chromium} = require(playwright);

async function run() {
  const browser = await chromium.launch({headless: true, executablePath});
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(pathToFileURL(path.join(root, 'whitepaper.html')).href);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [390, 1280]) {
      await page.setViewportSize({width, height: 920});
      const layout = await page.evaluate(() => ({
        links: [...document.querySelectorAll('nav a')].every(link => document.querySelector(link.hash)),
        local: [...document.querySelectorAll('a[href]')].filter(link => /^file:/.test(link.href))
          .map(link => link.href.split('#')[0]),
        chartCount: [...document.images].filter(image => image.complete && image.naturalWidth).length,
        overflow: document.documentElement.scrollWidth > innerWidth
      }));
      assert.equal(layout.links, true);
      assert.equal(layout.chartCount, 3);
      assert.equal(layout.overflow, false, width + 'px 页面横向溢出');
      for (const url of layout.local) assert.ok(fs.existsSync(new URL(url)), '本地链接不存在：' + url);
      if (process.env.WHITEPAPER_QA) {
        await page.screenshot({path: path.join(process.env.WHITEPAPER_QA, 'reader-' + width + '.png')});
      }
    }
    assert.ok(requests.every(url => /^(file:|data:)/.test(url)), '离线页加载了在线资源');
    // Keep references usable in a PDF carried away from this workspace.
    await page.evaluate(() => {
      const publicRoot = 'https://github.com/mix-shijie/geo-whitepaper/blob/main/';
      for (const link of document.querySelectorAll('a[href]')) {
        const reference = link.getAttribute('href');
        if (!reference.startsWith('#') && link.protocol === 'file:') {
          link.href = new URL(reference, publicRoot).href;
        }
      }
    });
    await page.pdf({path: path.join(root, 'whitepaper.pdf'), preferCSSPageSize: true, printBackground: true, tagged: true, outline: true});
    console.log('HTML：目录、离线资源和 390/1280 px 版面通过；已导出 A4 PDF。');
  } finally {
    await browser.close();
  }
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
