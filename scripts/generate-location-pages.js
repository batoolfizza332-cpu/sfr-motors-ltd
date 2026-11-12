// Generates the pilot town pages (site/mobile-tyre-fitting-<slug>.html) from data/locations-pilot.json.
//
// The page shell (top bar, header, footer) and the markup of the shared sections (services grid, "why choose us",
// nearby-areas pins, call-to-action) are taken from site/mobile-tyre-fitting-armadale.html, so the pilot pages always
// match the existing location pages. All visible copy in those sections comes from the town's own data fields.
//
//   node scripts/generate-location-pages.js          write the pages
//   node scripts/generate-location-pages.js --check  exit 1 if any page is out of date (used by the tests)
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "site");
const DATA = path.join(ROOT, "data", "locations-pilot.json");
const BASE_FILE = "mobile-tyre-fitting-armadale.html";
const BASE_TOWN = "Armadale";
const DOMAIN = "https://sfrmotors.co.uk";
const PHOTO_W = [640, 1200];
const PHOTO_H = { 640: 360, 1200: 675 };

const esc = (s) => String(s).replace(/&(?!(?:[a-z]+|#\d+);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Plain text for JSON-LD: strip tags, decode the few entities the copy uses.
const plain = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&amp;/g, "&").replace(/&rsquo;/g, "’");

function section(html, cls) {
  const m = html.match(new RegExp(`<section class="${cls}"[\\s\\S]*?</section>`));
  if (!m) throw new Error(`${BASE_FILE}: section .${cls} not found`);
  return m[0];
}

function loadBase() {
  const html = fs.readFileSync(path.join(SITE, BASE_FILE), "utf8");
  const shellTop = html.slice(html.indexOf("<body>"), html.indexOf('<main id="main">'));
  const shellBottom = html.slice(html.indexOf("</main>"));
  if (!shellTop || !shellBottom) throw new Error(`${BASE_FILE}: page shell not found`);
  return {
    shellTop,
    shellBottom,
    services: section(html, "sfr-services"),
    why: section(html, "sfr-why"),
    operate: section(html, "sfr-operate"),
    cta: section(html, "sfr-emergency"),
  };
}

const forTown = (block, town) => block.split(BASE_TOWN).join(town);

// Replace the text of the n-th match of `re` (group 2 = the text between group 1 and group 3) with values[n].
function fillEach(block, re, values, what) {
  let i = 0;
  const out = block.replace(re, (m, open, _text, close) => (i < values.length ? open + values[i++] + close : m));
  if (i !== values.length) throw new Error(`${what}: expected ${values.length} slots, filled ${i}`);
  return out;
}

// The shared sections keep the Armadale markup (cards, icons, links), but every sentence is the town's own copy from
// the data file, so the pilot pages are not a town-name swap of each other or of Armadale (doorway-page rule).
function townSections(base, t) {
  const need = (k, n) => {
    const v = t[k];
    if (n ? !(Array.isArray(v) && v.length === n) : typeof v !== "string" || !v) throw new Error(`${t.slug}: data field "${k}" missing or wrong length`);
    return v;
  };
  let services = forTown(base.services, t.town)
    .replace(/(<div class="sfr-services__eyebrow">)[\s\S]*?(<\/div>)/, `$1Our ${t.town} Services$2`);
  services = fillEach(services, /(<p class="sfr-services__intro">)([\s\S]*?)(<\/p>)/g, [need("servicesIntro")], `${t.slug} services intro`);
  services = fillEach(services, /(<article class="sfr-services__card">[\s\S]*?<\/h3>\s*<p>)([\s\S]*?)(<\/p>)/g, need("serviceCards", 9), `${t.slug} service cards`);
  let why = forTown(base.why, t.town)
    .replace(/(<h2 class="sfr-why__title" id="sfr-loc-why-heading">)[\s\S]*?(<\/h2>)/, `$1${t.whyTitle || `Why ${t.town} Drivers Call SFR Motors`}$2`);
  why = fillEach(why, /(<div class="sfr-why__card">[\s\S]*?<\/h3>\s*<p>)([\s\S]*?)(<\/p>)/g, need("why", 5), `${t.slug} why cards`);
  const operate = fillEach(forTown(base.operate, t.town), /(<p class="sfr-operate__text">)([\s\S]*?)(<\/p>)/g, [need("operateText")], `${t.slug} operate text`);
  let cta = forTown(base.cta, t.town)
    .replace(/(<h2 class="sfr-emergency__title" id="sfr-loc-cta-heading">)[\s\S]*?(<\/h2>)/, `$1Tyre Trouble <span>In ${t.town}?</span>$2`);
  cta = fillEach(cta, /(<p class="sfr-emergency__text">)([\s\S]*?)(<\/p>)/g, [need("ctaText")], `${t.slug} CTA text`);
  for (const [name, block] of Object.entries({ services, why, operate, cta })) {
    if (block.includes(BASE_TOWN)) throw new Error(`${t.slug}: "${BASE_TOWN}" text leaked into the ${name} section`);
  }
  return { services, why, operate, cta };
}

function photo(p) {
  const set = (ext) => PHOTO_W.map((w) => `/assets/img/${p.file}-${w}.${ext} ${w}w`).join(", ");
  const sizes = "(min-width: 800px) 760px, calc(100vw - 40px)";
  return `<div class="sfr-photo">
  <figure class="sfr-photo__figure">
    <picture>
      <source type="image/avif" srcset="${set("avif")}" sizes="${sizes}">
      <source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">
      <img
        src="/assets/img/${p.file}-1200.webp"
        alt="${esc(p.alt)}"
        loading="lazy"
        decoding="async"
        width="1200"
        height="${PHOTO_H[1200]}"
      />
    </picture>
  </figure>
</div>`;
}

function faqItem([q, a]) {
  return `      <details class="sfr-faq__item" name="sfr-loc-faq">
        <summary class="sfr-faq__summary">
          <span class="sfr-faq__q">${q}</span>
          <span class="sfr-faq__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
        </summary>
        <div class="sfr-faq__panel"><div class="sfr-faq__panel-inner">
          <p>${a}</p>
        </div></div>
      </details>`;
}

function render(t, base) {
  const sec = townSections(base, t);
  if (typeof t.heroText !== "string" || !t.heroText) throw new Error(`${t.slug}: data field "heroText" missing`);
  const url = `${DOMAIN}/mobile-tyre-fitting-${t.slug}/`;
  const title = `24/7 Mobile Tyre Fitting ${t.town}, West Lothian | SFR Motors Ltd`;
  const json = (o) => JSON.stringify(o, null, 2);
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${DOMAIN}/` },
    { "@type": "ListItem", position: 2, name: "Areas We Cover", item: `${DOMAIN}/#sfr-areas-heading` },
    { "@type": "ListItem", position: 3, name: t.town, item: url },
  ] };
  const service = { "@context": "https://schema.org", "@type": "Service", name: `Mobile Tyre Fitting ${t.town}`, serviceType: "Mobile Tyre Fitting", url, areaServed: [t.town],
    provider: { "@type": "AutomotiveBusiness", name: "SFR Motors Ltd | Mobile Tyre Fitters", telephone: "+441312020289", url: `${DOMAIN}/`,
      address: { "@type": "PostalAddress", addressLocality: "Bathgate", addressRegion: "West Lothian", addressCountry: "GB" },
      openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "00:00", closes: "23:59" } } };
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: t.faqs.map(([q, a]) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(a) } })) };

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#070707">

<meta property="og:type" content="website">
<meta property="og:site_name" content="SFR Motors Ltd">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:image" content="${DOMAIN}/assets/img/og-image.jpg">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/assets/img/logo.webp" type="image/webp">

<link rel="preload" href="/assets/fonts/roboto-latin-var.woff2" as="font" type="font/woff2" crossorigin>

<link rel="stylesheet" href="/assets/css/main.css">

<!-- Generated by scripts/generate-location-pages.js from data/locations-pilot.json. Edit the data, not this file. -->
<script type="application/ld+json">
${json(breadcrumb)}
</script>
<script type="application/ld+json">
${json(service)}
</script>
<script type="application/ld+json">
${json(faq)}
</script>
</head>
${base.shellTop}<main id="main">

<nav class="sfr-breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/#sfr-areas-heading">Areas We Cover</a></li>
    <li aria-current="page">${t.town}</li>
  </ol>
</nav>

<section class="sfr-page-hero" id="top" aria-labelledby="sfr-loc-h1">
  <picture>
    <source media="(max-width: 700px)" srcset="/assets/img/cta-bg-700.avif" type="image/avif">
    <source media="(max-width: 700px)" srcset="/assets/img/cta-bg-700.webp" type="image/webp">
    <source srcset="/assets/img/cta-bg.avif" type="image/avif">
    <source srcset="/assets/img/cta-bg.webp" type="image/webp">
    <img
      class="sfr-page-hero__bg"
      src="/assets/img/cta-bg.webp"
      alt=""
      aria-hidden="true"
      fetchpriority="high"
      decoding="async"
      width="1920"
      height="1010"
    />
  </picture>
  <div class="sfr-page-hero__overlay"></div>

  <div class="sfr-page-hero__inner">
    <span class="sfr-page-hero__eyebrow"><span class="dot"></span>Areas We Cover</span>
    <h1 class="sfr-page-hero__title" id="sfr-loc-h1">Mobile Tyre Fitting in ${t.town}, West Lothian</h1>
    <p class="sfr-page-hero__text">${t.heroText}</p>
${heroActions()}
  </div>
</section>

<section class="sfr-band" aria-labelledby="sfr-loc-intro-heading">
  <div class="sfr-band__inner">
    <div class="sfr-band__eyebrow">Mobile Tyre Fitting In ${t.town}</div>
    <h2 class="sfr-band__title" id="sfr-loc-intro-heading">Tyre Help That Comes To You In ${t.town}</h2>
    <p class="sfr-band__text">
      ${t.intro}
    </p>
  </div>
</section>

${photo(t.photos[0])}

${sec.services}

${sec.why}

<section class="sfr-guide" aria-labelledby="sfr-loc-scenarios-heading">
  <div class="sfr-guide__inner">
    <div class="sfr-guide__head">
      <div class="sfr-guide__eyebrow">Common Situations We Help With</div>
      <h2 class="sfr-guide__title" id="sfr-loc-scenarios-heading">Typical ${t.town} Call-Outs</h2>
    </div>
    <div class="sfr-guide__grid">
${t.scenarios.map(([h, p]) => `      <div class="sfr-guide__item">
        <h3>${h}</h3>
        <p>${p}</p>
      </div>`).join("\n")}
    </div>
  </div>
</section>

${photo(t.photos[1])}

<section class="sfr-band" aria-labelledby="sfr-loc-areas-heading">
  <div class="sfr-band__inner">
    <div class="sfr-band__eyebrow">${t.town} &amp; Nearby Areas</div>
    <h2 class="sfr-band__title" id="sfr-loc-areas-heading">Across ${t.town} And The Surrounding Area</h2>
    <p class="sfr-band__text">
      ${t.areasText}
    </p>
  </div>
</section>

${sec.operate}

<section class="sfr-faq" aria-labelledby="sfr-loc-faq-heading">
  <div class="sfr-faq__inner">
    <div class="sfr-faq__head">
      <div class="sfr-faq__eyebrow">FAQs</div>
      <h2 class="sfr-faq__title" id="sfr-loc-faq-heading">${t.town} Tyre Fitting Questions</h2>
    </div>

    <div class="sfr-faq__list">

${t.faqs.map(faqItem).join("\n\n")}

    </div>
  </div>
</section>

${sec.cta}

${base.shellBottom}`;
}

function heroActions() {
  return `
    <div class="sfr-page-hero__actions">
      <a class="sfr-page-hero__btn sfr-page-hero__btn--primary" href="https://wa.me/447448427154?text=Hi%20SFR%2C%20I%20found%20you%20on%20Google" target="_blank" rel="noopener" aria-label="WhatsApp Us on 07448 427154 (opens in a new tab)">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5A9.5 9.5 0 0 0 3.6 17l-1.1 4 4.1-1.1A9.5 9.5 0 1 0 12 2.5Zm0 1.8a7.7 7.7 0 0 1 6.5 11.9l-.2.3.6 2.2-2.3-.6-.3.2A7.7 7.7 0 1 1 12 4.3Z"/></svg>
        WhatsApp Us
      </a>
      <a class="sfr-page-hero__btn sfr-page-hero__btn--ghost" href="tel:+441312020289">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L14.5 14l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3 6.1 1.5 1.5 0 0 1 4 4.5Z"/></svg>
        Call Now
      </a>
    </div>`;
}

function build() {
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const base = loadBase();
  return data.towns.map((t) => ({ file: `mobile-tyre-fitting-${t.slug}.html`, html: render(t, base), town: t }));
}

module.exports = { build, DATA, PHOTO_W };

if (require.main === module) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const { file, html } of build()) {
    const target = path.join(SITE, file);
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    // Line endings do not count: a Windows checkout (core.autocrlf) turns LF into CRLF.
    if (current !== null && current.replace(/\r\n/g, "\n") === html.replace(/\r\n/g, "\n")) continue;
    if (check) { console.error(`out of date: site/${file}`); stale++; }
    else { fs.writeFileSync(target, html); console.log(`wrote site/${file}`); }
  }
  if (check && stale) process.exit(1);
}
