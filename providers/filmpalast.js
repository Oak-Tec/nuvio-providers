// filmpalast.js
const cheerio = require('cheerio');
const { fetchHtml } = require('./utils');

const SITE = 'https://filmpalast.to'; // adjust if different domain

async function list(path = '/') {
  const url = new URL(path, SITE).href;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const items = [];
  $('.movie-list .movie, .listing .item, .ml-item, article.post').each((i, el) => {
    const el$ = $(el);
    const title = el$.find('.title, h3, a, .ml-title').first().text().trim();
    const href = el$.find('a').attr('href');
    const poster = el$.find('img').attr('src') || el$.find('img').attr('data-src');
    const url = href ? new URL(href, SITE).href : null;
    if (title && url) items.push({ title, url, poster });
  });

  return items;
}

async function details(pageUrl) {
  const html = await fetchHtml(pageUrl);
  const $ = cheerio.load(html);

  const title = $('h1, .title, .entry-title').first().text().trim();
  const description = $('.description, .content, #beschreibung, .entry-content').text().trim();
  const poster = $('meta[property="og:image"]').attr('content') || $('img.poster').attr('src');
  const year = $('.year, .meta .year').first().text().trim();
  const cast = [];
  $('.cast li, .actors a').each((i, el) => cast.push($(el).text().trim()));

  const links = [];
  $('a[href*="embed"], a[href*="stream"], .mirror a, .links a, a[href*="player"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href) links.push(new URL(href, pageUrl).href);
  });

  return { title, description, poster, year, cast, links };
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

      const re = /(?:"|')((https?:\/\/)[^"']+\.(mp4|m3u8|mkv))(?:"|')/g;
      let m;
      while ((m = re.exec(html)) !== null) found.push(m[1]);
    } catch (e) { /* ignore embed failures */ }
  }

  return Array.from(new Set(found));
}

module.exports = { list, details, streams };
