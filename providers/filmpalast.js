// filmpalast.js
const puppeteer = require('puppeteer');

const SITE = 'https://filmpalast.to'; // ggf. anpassen

async function withPage(fn) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/109.0.0.0 Safari/537.36'
  );
  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function list(path = '/') {
  return withPage(async (page) => {
    const url = new URL(path, SITE).href;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const items = await page.$$eval(
      '.movie-list .movie, .listing .item, .ml-item, article.post',
      (els) => els.map((el) => {
        const a = el.querySelector('a');
        const img = el.querySelector('img');
        const titleEl = el.querySelector('.title, h3, a, .ml-title');
        return {
          title: titleEl ? titleEl.textContent.trim() : null,
          url: a ? a.href : null,
          poster: img?.getAttribute('src') ||
                  img?.getAttribute('data-src') ||
                  img?.getAttribute('data-srcset') || null,
        };
      }).filter(i => i.title && i.url)
    );

    return items;
  });
}

async function details(pageUrl) {
  return withPage(async (page) => {
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

    const title = await page.$eval(
      'h1, .title, .entry-title',
      (el) => el.textContent.trim()
    ).catch(() => null);

    const description = await page.$eval(
      '.description, .content, #beschreibung, .entry-content',
      (el) => el.textContent.trim()
    ).catch(() => null);

    const poster = await page.$eval(
      'meta[property="og:image"], img.poster',
      (el) => el.getAttribute('content') || el.getAttribute('src')
    ).catch(() => null);

    const year = await page.$eval(
      '.year, .meta .year',
      (el) => el.textContent.trim()
    ).catch(() => null);

    const cast = await page.$$eval(
      '.cast li, .actors a',
      (els) => els.map((e) => e.textContent.trim())
    ).catch(() => []);

    const links = await page.$$eval(
      'a[href*="embed"], a[href*="stream"], .mirror a, .links a, a[href*="player"]',
      (els) => els.map((a) => a.href)
    );

    return { title, description, poster, year, cast, links };
  });
}

async function streams(pageUrl) {
  const det = await details(pageUrl);
  const found = [];

  for (const l of det.links) {
    await withPage(async (page) => {
      try {
        await page.goto(l, { waitUntil: 'domcontentloaded' });

        // Iframe-Quelle
        const iframe = await page.$eval('iframe', (el) => el.src).catch(() => null);
        if (iframe) found.push(iframe);

        // Video sources
        const videos = await page.$$eval('video source', (els) =>
          els.map((s) => s.getAttribute('src')).filter(Boolean)
        );
        found.push(...videos);

        // Suche nach mp4/m3u8/mkv im HTML
        const html = await page.content();
        const re = /(?:"|')((https?:\/\/)[^"']+\.(mp4|m3u8|mkv))(?:"|')/g;
        let m;
        while ((m = re.exec(html)) !== null) {
          found.push(m[1]);
        }
      } catch (e) {
        // still ok
      }
    });
  }

  return Array.from(new Set(found));
}

module.exports = { list, details, streams };
