#!/usr/bin/env node
/**
 * fetch-doc — turn a documentation URL into clean, readable text.
 *
 * The anchor for the dispatcher's mode ④ (create BDD from project docs on the
 * web). `source-to-requirements` runs this to pull the *actual* page text so its
 * extraction is grounded in real content — not the URL or the model's prior
 * (the "missing-context problem" behind hallucinated Gherkin).
 *
 * Usage
 *   node scripts/fetch-doc.js <url> [--max <chars>]
 *
 * Prints the page title, source URL, and body text to stdout (nothing is written
 * to disk). Exits non-zero on a bad URL or fetch failure so callers can detect it.
 *
 * Dep-free: uses Node's built-in global fetch (Node 18+). No HTML parser — a
 * deliberately small tag-stripper, good enough to feed an LLM extractor.
 */
const MAX = (() => {
  const i = process.argv.indexOf('--max');
  const n = i !== -1 ? parseInt(process.argv[i + 1], 10) : NaN;
  return Number.isFinite(n) ? n : 40000;
})();

const url = process.argv.find((a) => /^https?:\/\//i.test(a));

if (!url) {
  console.error('usage: node scripts/fetch-doc.js <http(s)-url> [--max <chars>]');
  process.exit(2);
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (named[n.toLowerCase()] !== undefined ? named[n.toLowerCase()] : m));
}

function htmlToText(html) {
  let s = html;
  const titleMatch = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch ? titleMatch[1] : '').trim();
  // drop non-content elements entirely
  s = s.replace(/<(script|style|noscript|svg|head|nav|footer|form)[\s\S]*?<\/\1>/gi, ' ');
  // turn block boundaries into newlines so structure survives
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)\s*>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n- ');
  s = s.replace(/<h[1-6][^>]*>/gi, '\n\n');
  // strip the rest of the tags
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  // collapse whitespace, keep paragraph breaks
  s = s
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title: decodeEntities(title), text: s };
}

(async () => {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': 'certance-fetch-doc/1.0 (+docs-ingestion)' },
      redirect: 'follow',
    });
  } catch (e) {
    console.error(`fetch failed: ${e.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`fetch failed: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const ct = res.headers.get('content-type') || '';
  const raw = await res.text();
  const { title, text } = /html/i.test(ct) ? htmlToText(raw) : { title: '', text: raw.trim() };
  const body = text.length > MAX ? text.slice(0, MAX) + `\n\n…[truncated at ${MAX} chars]` : text;

  console.log(`# Source: ${url}`);
  if (title) console.log(`# Title: ${title}`);
  console.log(`# Content-Type: ${ct || 'unknown'}  ·  ${body.length} chars\n`);
  console.log(body);
})();
