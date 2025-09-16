// megakino.js
const cheerio = require('cheerio');
const { fetchHtml } = require('./utils');

const SITE = 'https://megakino.me';

async function list(path = '/') {
  const url = new URL(path, SITE).href;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const items = [];

  $('.movie, .film-card, .item, .ml-item, article.post').each((i, el) => {
    const el$ = $(el);
    const link = el$.find('a').attr('href');
    const title = el$.find('h3, .title').text().trim() || el$.find('img').attr('alt');
    const poster = el$.find('img').attr('src') || el$.find('img').attr('data-src');
    if (link && title) items.push({ title, url: new URL(link, SITE).href, poster });
  });

  return items;
}

async function details(pageUrl) {
  const html = await fetchHtml(pageUrl);
  const $ = cheerio.load(html);
  const title = $('h1, .title').text().trim();
  const description = $('.description, .synopsis, .entry-content').text().trim();
  const poster = $('meta[property="og:image"]').attr('content') || $('img.poster').attr('src');

  const links = [];
  $('.download a, .mirror a, a[href*="embed"], a[href*="player"]').each((i, el) => {
    const h = $(el).attr('href');
    if (h) links.push(new URL(h, pageUrl).href);
  });

  return { title, description, poster, links };
}

async function streams(pageUrl) {
  const det = await details(pageUrl);
  const found = [];

  for (const l of det.links) {
    try {
      const html = await fetchHtml(l);
      const $ = cheerio.load(html);
      const iframe = $('iframe').attr('src');
      if (iframe) found.push(new URL(iframe, l).href);

      $('video source').each((i, s) => {
        const src = $(s).attr('src');
        if (src) found.push(new URL(src, l).href);
      });

      const re = /(?:"|')((https?:\/\/)[^"']+\.(mp4|m3u8))(?:"|')/g;
      let m;
      while ((m = re.exec(html)) !== null) found.push(m[1]);
    } catch (e) {}
  }

  return Array.from(new Set(found));
}

module.exports = { list, details, streams };
