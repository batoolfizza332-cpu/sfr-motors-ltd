#!/usr/bin/env node
// One-off Phase 3 content restoration: generates dedicated location pages for
// Armadale, Whitburn and Airdrie (previously funnelled into the West Lothian
// hub page — see the Phase 2 migration plan's local-SEO risk note) from a
// shared template, matching the structure of the existing hand-written
// location pages (e.g. mobile-tyre-fitting-bathgate/index.html) so the site
// stays visually and structurally consistent.
//
// Run once: `node scripts/gen-location-pages.js`.

"use strict";

const fs = require("fs");
const path = require("path");

const SITE_DIR = path.join(__dirname, "..", "site");

const SERVICE_CARDS = [
  { icon: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.5 6.5l-1.7 1.7M8.2 15.8l-1.7 1.7M17.5 17.5l-1.7-1.7M8.2 8.2 6.5 6.5"/>`, title: "Mobile Tyre Fitting", href: "/mobile-tyre-fitting/", label: "Mobile Tyre Fitting", text: (t) => `New tyres fitted at your home or workplace in ${t}, without the trip to a garage.` },
  { icon: `<path d="M4 12a8 8 0 0 1 13.5-5.8M20 12a8 8 0 0 1-13.5 5.8"/><path d="M17.5 3v3.5H14M6.5 21v-3.5H10"/>`, title: "Tyre Replacement", href: "/mobile-tyre-replacement/", label: "Tyre Replacement", text: (t) => `Worn or damaged tyres replaced on-site in ${t}, quickly and without the hassle.` },
  { icon: `<path d="M9 12.5 11 14.5 15.5 9.5"/><path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.2 7.5 10 4.3-1.8 7.5-5 7.5-10v-6L12 2.5Z"/>`, title: "Puncture Repair", href: "/mobile-tyre-puncture-repair/", label: "Mobile Puncture Repair", text: (t) => `Suitable punctures assessed and repaired wherever you're parked in ${t}.` },
  { icon: `<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>`, title: "Emergency Tyre Assistance", href: "/emergency-tyre-change/", label: "Emergency Tyre Change", text: (t) => `Stuck in ${t} with a flat? We're open 24/7 and often close by.` },
  { icon: `<circle cx="12" cy="12" r="3.2"/><path d="M19.4 12a7.4 7.4 0 0 0-.13-1.4l2-1.56-2-3.46-2.36.95a7.4 7.4 0 0 0-1.21-.7L15.3 3.2h-4l-.4 2.63a7.4 7.4 0 0 0-1.21.7l-2.36-.95-2 3.46 2 1.56a7.4 7.4 0 0 0 0 2.8l-2 1.56 2 3.46 2.36-.95c.37.28.78.51 1.21.7l.4 2.63h4l.4-2.63a7.4 7.4 0 0 0 1.21-.7l2.36.95 2-3.46-2-1.56c.09-.46.13-.93.13-1.4Z"/>`, title: "Locking Wheel Nut Removal", href: "/mobile-locking-wheel-nut-removal/", label: "Locking Wheel Nut Removal", text: (t) => `Lost or seized locking wheel nuts removed wherever you're parked in ${t}.` },
  { icon: `<path d="M3.5 16V8.5a1 1 0 0 1 1-1h9v8.5"/><path d="M13.5 12h3.5l3 3.2v1.3h-2"/><path d="M3.5 16h1.7M9.3 16h2.9"/><circle cx="7" cy="17" r="1.8"/><circle cx="16.3" cy="17" r="1.8"/>`, title: "Van Tyre Replacement", href: "/van-tyre-replacement-services/", label: "Van Tyre Replacement", text: (t) => `Correctly rated tyres fitted for vans and light commercials in ${t}.` },
  { icon: `<path d="M3 16V9a1 1 0 0 1 1-1h9v8"/><path d="M13 11h5l3 3v2h-2"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>`, title: "Trade & Fleet Tyres", href: "/trade-fleet-tyre-services/", label: "Trade and Fleet Tyre Services", text: (t) => `Scheduled or emergency tyre cover for ${t}-based business vehicles.` },
  { icon: `<path d="M2.5 16.5h6v-6h-6Z"/><path d="M8.5 12.5h6l4 2.5v1.5h-2"/><circle cx="5.5" cy="18.5" r="1.6"/><circle cx="15.5" cy="18.5" r="1.6"/>`, title: "Caravan & Trailer Tyres", href: "/mobile-trailer-and-caravan-tyre-fitting/", label: "Caravan and Trailer Tyre Fitting", text: (t) => `Mobile fitting for caravan and trailer tyres, wherever it's stored or parked in ${t}.` },
  { icon: `<circle cx="12" cy="13" r="7.5"/><path d="M12 13 15 9.5"/><path d="M9 6.3l.9 1.6M15 6.3l-.9 1.6"/>`, title: "TPMS Services", href: "/tyre-pressure-monitoring-system/", label: "TPMS Services", text: () => `Tyre pressure warning light on? We can check and advise during your visit.` },
];

const WHY_CARDS = [
  { icon: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`, title: "24/7 Assistance", text: (t) => `Open around the clock for callouts across ${t}.` },
  { icon: `<path d="M12 21c-4-3.6-7-7.06-7-10.5A7 7 0 0 1 19 10.5C19 13.94 16 17.4 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/>`, title: "Mobile Convenience", text: () => `We come to your home, workplace or roadside location.` },
  { icon: `<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>`, title: "Professional Equipment", text: () => `Fully equipped vans, the same standard as a workshop.` },
  { icon: `<path d="M9 12.5 11 14.5 15.5 9.5"/><path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.2 7.5 10 4.3-1.8 7.5-5 7.5-10v-6L12 2.5Z"/>`, title: "Reliable Service", text: () => `Honest advice and a straightforward, dependable callout.` },
  { icon: `<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4v5h-5"/>`, title: "Customer-Focused Support", text: () => `We take the time to explain what's happening and why.` },
];

function svg(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
function pinSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21c-4-3.6-7-7.06-7-10.5A7 7 0 0 1 19 10.5C19 13.94 16 17.4 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/></svg>`;
}

function renderPage(loc) {
  const slug = loc.slug;
  const url = `https://sfrmotors.co.uk/${slug}/`;
  const faqSchema = loc.faqs
    .map(
      (f) => `    {
      "@type": "Question",
      "name": "${f.q}",
      "acceptedAnswer": { "@type": "Answer", "text": "${f.a.replace(/"/g, '\\"')}" }
    }`
    )
    .join(",\n");

  const servicesGrid = SERVICE_CARDS.map(
    (c) => `      <article class="sfr-services__card">
        <div class="sfr-services__icon" aria-hidden="true">${svg(c.icon)}</div>
        <h3>${c.title}</h3>
        <p>${c.text(loc.town)}</p>
        <a class="sfr-services__link" href="${c.href}" aria-label="Learn more about ${c.label}">
          Learn More
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
        </a>
      </article>`
  ).join("\n\n");

  const whyGrid = WHY_CARDS.map(
    (c) => `      <div class="sfr-why__card">
        <div class="sfr-why__icon">${svg(c.icon)}</div>
        <h3>${c.title}</h3>
        <p>${c.text(loc.town)}</p>
      </div>`
  ).join("\n\n");

  const nearbyPins = loc.nearby
    .map((n) => `      <a class="sfr-operate__pin" href="${n.href}">${pinSvg()}${n.name}</a>`)
    .join("\n");

  const faqHtml = loc.faqs
    .map(
      (f) => `      <details class="sfr-faq__item" name="sfr-loc-faq">
        <summary class="sfr-faq__summary">
          <span class="sfr-faq__q">${f.q}</span>
          <span class="sfr-faq__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
        </summary>
        <div class="sfr-faq__panel"><div class="sfr-faq__panel-inner">
          <p>${f.a}</p>
        </div></div>
      </details>`
    )
    .join("\n\n");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mobile Tyre Fitting ${loc.town} | SFR Motors Ltd</title>
<meta name="description" content="${loc.metaDescription}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#0c0d0f">

<meta property="og:type" content="website">
<meta property="og:site_name" content="SFR Motors Ltd">
<meta property="og:title" content="Mobile Tyre Fitting ${loc.town} | SFR Motors Ltd">
<meta property="og:description" content="${loc.ogDescription}">
<meta property="og:image" content="https://sfrmotors.co.uk/assets/img/og-image.jpg">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/assets/img/logo.webp" type="image/webp">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap"></noscript>

<link rel="stylesheet" href="/assets/css/main.css">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://sfrmotors.co.uk/" },
    { "@type": "ListItem", "position": 2, "name": "Areas We Cover", "item": "https://sfrmotors.co.uk/#sfr-areas-heading" },
    { "@type": "ListItem", "position": 3, "name": "${loc.town}", "item": "${url}" }
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Mobile Tyre Fitting ${loc.town}",
  "serviceType": "Mobile Tyre Fitting",
  "url": "${url}",
  "areaServed": ["${loc.town}"],
  "provider": {
    "@type": "AutomotiveBusiness",
    "name": "SFR Motors Ltd",
    "telephone": "+441312020289",
    "url": "https://sfrmotors.co.uk/",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "39 S Loch Park",
      "addressLocality": "Bathgate",
      "addressRegion": "West Lothian",
      "postalCode": "EH48 2QZ",
      "addressCountry": "GB"
    }
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
${faqSchema}
  ]
}
</script>
</head>
<body>

<a class="sfr-skip" href="#main">Skip to main content</a>

<div class="sfr-topbar">
  <div class="sfr-topbar__inner">
    <a href="tel:01312020289">📞 0131 202 0289</a>
    <span class="sfr-topbar__open"><span class="dot"></span>Open 24/7</span>
    <span class="sfr-topbar__areas">Bathgate &middot; West Lothian &middot; Edinburgh</span>
  </div>
</div>

<header class="sfr-header">
  <div class="sfr-header__inner">
    <a class="sfr-header__brand" href="/">
      <picture>
        <source srcset="/assets/img/logo.webp" type="image/webp">
        <img src="/assets/img/logo.jpg" alt="SFR Motors Ltd logo" width="42" height="42">
      </picture>
      <span class="sfr-header__brand-text">
        <span class="sfr-header__brand-name">SFR Motors Ltd</span>
        <span class="sfr-header__brand-motto">Secure. Fast. Reliable.</span>
      </span>
    </a>

    <nav class="sfr-nav" data-open="false" aria-label="Primary">
      <button class="sfr-nav__toggle" type="button" aria-expanded="false" aria-controls="sfr-nav-links" aria-label="Open menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <ul class="sfr-nav__links" id="sfr-nav-links">
        <li><a href="/">Home</a></li>
        <li><a href="/about-us/">About</a></li>
        <li><a href="/services/">Services</a></li>
        <li><a href="/#sfr-areas-heading">Areas We Cover</a></li>
        <li><a href="/#sfr-reviews-heading">Reviews</a></li>
        <li><a href="/#sfr-faq-heading">FAQ</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/contact-us/#quote-form">Get A Quote</a></li>
      </ul>
    </nav>

    <a class="sfr-header__call" href="tel:01312020289" aria-label="Call SFR Motors now on 0131 202 0289">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L14.5 14l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3 6.1 1.5 1.5 0 0 1 4 4.5Z"/></svg>
      <span>Call Now</span>
    </a>
  </div>
</header>

<main id="main">

<nav class="sfr-breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/#sfr-areas-heading">Areas We Cover</a></li>
    <li aria-current="page">${loc.town}</li>
  </ol>
</nav>

<section class="sfr-page-hero" id="top" aria-labelledby="sfr-loc-h1">
  <picture>
    <source media="(max-width: 700px)" srcset="/assets/img/${loc.hero}-700.avif" type="image/avif">
    <source media="(max-width: 700px)" srcset="/assets/img/${loc.hero}-700.webp" type="image/webp">
    <source srcset="/assets/img/${loc.hero}-1920.avif" type="image/avif">
    <source srcset="/assets/img/${loc.hero}-1920.webp" type="image/webp">
    <img
      class="sfr-page-hero__bg"
      src="/assets/img/${loc.hero}-1920.jpg"
      alt=""
      aria-hidden="true"
      fetchpriority="high"
      decoding="async"
      width="1920"
      height="${loc.heroHeight}"
    />
  </picture>
  <div class="sfr-page-hero__overlay"></div>

  <div class="sfr-page-hero__inner">
    <span class="sfr-page-hero__eyebrow"><span class="dot"></span>Areas We Cover</span>
    <h1 class="sfr-page-hero__title" id="sfr-loc-h1">Mobile Tyre Fitting ${loc.town}</h1>
    <p class="sfr-page-hero__text">Professional mobile tyre fitting, repair and replacement in ${loc.town} and surrounding areas.</p>

    <div class="sfr-page-hero__actions">
      <a class="sfr-page-hero__btn sfr-page-hero__btn--primary" href="/contact-us/#quote-form">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h14v11H8.5L5 19Z"/><path d="M8.5 9h7M8.5 12h4.5"/></svg>
        Get A Free Quote
      </a>
      <a class="sfr-page-hero__btn sfr-page-hero__btn--ghost" href="tel:01312020289">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L14.5 14l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3 6.1 1.5 1.5 0 0 1 4 4.5Z"/></svg>
        Call Now
      </a>
    </div>
  </div>
</section>

<section class="sfr-band" aria-labelledby="sfr-loc-intro-heading">
  <div class="sfr-band__inner">
    <div class="sfr-band__eyebrow">Mobile Tyre Fitting In ${loc.town}</div>
    <h2 class="sfr-band__title" id="sfr-loc-intro-heading">${loc.introHeading}</h2>
    <p class="sfr-band__text">${loc.introText}</p>
  </div>
</section>

<section class="sfr-services" aria-labelledby="sfr-loc-services-heading">
  <div class="sfr-services__inner">
    <div class="sfr-services__head">
      <div class="sfr-services__eyebrow">Our ${loc.town} Services</div>
      <h2 class="sfr-services__title" id="sfr-loc-services-heading">Everything Your <span>Tyres</span> Need</h2>
      <p class="sfr-services__intro">Fitting, repairs, replacements and emergency support, all carried out at your location in ${loc.town}.</p>
    </div>

    <div class="sfr-services__grid">

${servicesGrid}

    </div>
  </div>
</section>

<section class="sfr-band" aria-labelledby="sfr-loc-areas-heading">
  <div class="sfr-band__inner">
    <div class="sfr-band__eyebrow">${loc.town} &amp; Surrounding Areas</div>
    <h2 class="sfr-band__title" id="sfr-loc-areas-heading">Right At Home In ${loc.town}</h2>
    <p class="sfr-band__text">${loc.areasText}</p>
  </div>
</section>

<section class="sfr-why" aria-labelledby="sfr-loc-why-heading">
  <div class="sfr-why__inner">
    <div class="sfr-why__head">
      <div class="sfr-why__eyebrow">Why Choose SFR Motors</div>
      <h2 class="sfr-why__title" id="sfr-loc-why-heading">Trusted Mobile Tyre Fitting In ${loc.town}</h2>
    </div>

    <div class="sfr-why__grid sfr-why__grid--five">
${whyGrid}
    </div>
  </div>
</section>

<section class="sfr-guide" aria-labelledby="sfr-loc-scenarios-heading">
  <div class="sfr-guide__inner">
    <div class="sfr-guide__head">
      <div class="sfr-guide__eyebrow">Common Situations We Help With</div>
      <h2 class="sfr-guide__title" id="sfr-loc-scenarios-heading">Typical ${loc.town} Call-Outs</h2>
    </div>
    <div class="sfr-guide__grid">
      <div class="sfr-guide__item">
        <h3>${loc.scenario1.title}</h3>
        <p>${loc.scenario1.text}</p>
      </div>
      <div class="sfr-guide__item">
        <h3>${loc.scenario2.title}</h3>
        <p>${loc.scenario2.text}</p>
      </div>
    </div>
  </div>
</section>

<section class="sfr-operate" aria-labelledby="sfr-loc-nearby-heading">
  <div class="sfr-operate__inner">
    <div class="sfr-operate__eyebrow">Areas Nearby</div>
    <h2 class="sfr-operate__title" id="sfr-loc-nearby-heading">Also Covering The Areas Around ${loc.town}</h2>
    <p class="sfr-operate__text">As well as ${loc.town}, we provide mobile tyre fitting across ${loc.nearby.map((n) => n.name).join(", ")}.</p>
    <div class="sfr-operate__pins">
${nearbyPins}
    </div>
    <a class="sfr-operate__link" href="/#sfr-areas-heading">
      See all areas we cover
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
    </a>
  </div>
</section>

<section class="sfr-faq" aria-labelledby="sfr-loc-faq-heading">
  <div class="sfr-faq__inner">
    <div class="sfr-faq__head">
      <div class="sfr-faq__eyebrow">FAQs</div>
      <h2 class="sfr-faq__title" id="sfr-loc-faq-heading">${loc.town} Tyre Fitting Questions</h2>
    </div>

    <div class="sfr-faq__list">

${faqHtml}

    </div>
  </div>
</section>

<section class="sfr-emergency" aria-labelledby="sfr-loc-cta-heading">
  <div class="sfr-emergency__inner">
    <h2 class="sfr-emergency__title" id="sfr-loc-cta-heading">Need Tyre Help <span>In ${loc.town}?</span></h2>
    <p class="sfr-emergency__text">Let us know what's happened and where you are in ${loc.town}, and we'll get back to you with a price and an arrival time.</p>
    <div class="sfr-emergency__actions">
      <a class="sfr-emergency__btn" href="tel:01312020289">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L14.5 14l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3 6.1 1.5 1.5 0 0 1 4 4.5Z"/></svg>
        Call Now
      </a>
      <a class="sfr-emergency__btn" href="/contact-us/#quote-form">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h14v11H8.5L5 19Z"/><path d="M8.5 9h7M8.5 12h4.5"/></svg>
        Get A Free Quote
      </a>
    </div>
  </div>
</section>

</main>

<footer class="sfr-footer">
  <div class="sfr-footer__top">

    <div class="sfr-footer__col">
      <p class="sfr-footer__brand-name">SFR <span>Motors</span> Ltd</p>
      <p class="sfr-footer__tagline">Mobile Tyre Fitting &amp; Repair</p>
      <p class="sfr-footer__motto">Secure. Fast. Reliable.</p>

      <span class="sfr-footer__badge"><span class="dot"></span>Open 24/7</span><br/>

      <a class="sfr-footer__call" href="tel:01312020289">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L14.5 14l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3 6.1 1.5 1.5 0 0 1 4 4.5Z"/></svg>
        Call Now
      </a>

      <div class="sfr-footer__social">
        <a href="#" aria-label="SFR Motors on Facebook">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z"/></svg>
        </a>
        <a href="#" aria-label="SFR Motors on Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c2.7 0 3 0 4.1.06 1.1.05 1.8.22 2.4.46.7.27 1.2.62 1.7 1.12.5.5.85 1 1.12 1.7.24.6.41 1.3.46 2.4.06 1.1.06 1.4.06 4.1s0 3-.06 4.1c-.05 1.1-.22 1.8-.46 2.4a4.6 4.6 0 0 1-1.12 1.7c-.5.5-1 .85-1.7 1.12-.6.24-1.3.41-2.4.46-1.1.06-1.4.06-4.1.06s-3 0-4.1-.06c-1.1-.05-1.8-.22-2.4-.46a4.6 4.6 0 0 1-1.7-1.12 4.6 4.6 0 0 1-1.12-1.7c-.24-.6-.41-1.3-.46-2.4C2.2 15 2.2 14.7 2.2 12s0-3 .06-4.1c.05-1.1.22-1.8.46-2.4.27-.7.62-1.2 1.12-1.7.5-.5 1-.85 1.7-1.12.6-.24 1.3-.41 2.4-.46C9 2.2 9.3 2.2 12 2.2Zm0 1.8c-2.66 0-2.97 0-4.02.06-.9.04-1.4.2-1.7.32-.44.17-.75.37-1.08.7-.33.33-.53.64-.7 1.08-.13.32-.28.8-.32 1.7C4.12 9.03 4.12 9.34 4.12 12s0 2.97.06 4.02c.04.9.2 1.4.32 1.7.17.44.37.75.7 1.08.33.33.64.53 1.08.7.32.13.8.28 1.7.32 1.05.06 1.36.06 4.02.06s2.97 0 4.02-.06c.9-.04 1.4-.2 1.7-.32.44-.17.75-.37 1.08-.7.33-.33.53-.64.7-1.08.13-.32.28-.8.32-1.7.06-1.05.06-1.36.06-4.02s0-2.97-.06-4.02c-.04-.9-.2-1.4-.32-1.7a2.8 2.8 0 0 0-.7-1.08 2.8 2.8 0 0 0-1.08-.7c-.32-.13-.8-.28-1.7-.32C14.97 4 14.66 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Zm5.1-2a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>
        </a>
      </div>
    </div>

    <nav class="sfr-footer__col" aria-label="Quick links">
      <h3 class="sfr-footer__heading">Quick Links</h3>
      <ul class="sfr-footer__links">
        <li><a href="/">Home</a></li>
        <li><a href="/about-us/">About Us</a></li>
        <li><a href="/services/">Services</a></li>
        <li><a href="/#sfr-areas-heading">Areas We Cover</a></li>
        <li><a href="/#sfr-faq-heading">FAQ</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/contact-us/">Contact</a></li>
      </ul>
    </nav>

    <nav class="sfr-footer__col" aria-label="Our services">
      <h3 class="sfr-footer__heading">Our Services</h3>
      <ul class="sfr-footer__links">
        <li><a href="/mobile-tyre-fitting/">Mobile Tyre Fitting</a></li>
        <li><a href="/mobile-tyre-replacement/">Tyre Replacement</a></li>
        <li><a href="/mobile-tyre-puncture-repair/">Puncture Repair</a></li>
        <li><a href="/mobile-locking-wheel-nut-removal/">Locking Wheel Nut Removal</a></li>
        <li><a href="/trade-fleet-tyre-services/">Trade &amp; Fleet Tyres</a></li>
        <li><a href="/mobile-trailer-and-caravan-tyre-fitting/">Caravan &amp; Trailer Tyres</a></li>
        <li><a href="/our-tyre-range/">Our Tyre Range</a></li>
      </ul>
    </nav>

    <div class="sfr-footer__col">
      <h3 class="sfr-footer__heading">Contact Us</h3>
      <address class="sfr-footer__address">
      <ul class="sfr-footer__contact">
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true"><path d="M4 4.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L14.5 14l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3 6.1 1.5 1.5 0 0 1 4 4.5Z"/></svg>
          <a href="tel:01312020289">0131 202 0289</a>
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true"><path d="M4 4.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L14.5 14l5 2v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3 6.1 1.5 1.5 0 0 1 4 4.5Z"/></svg>
          <a href="https://wa.me/447448427154" target="_blank" rel="noopener">07448 427154</a>
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true"><path d="M4 5.5h16v13H4Z"/><path d="M4.5 6l7.5 6.5L19.5 6"/></svg>
          <a href="mailto:info@sfrmotors.co.uk">info@sfrmotors.co.uk</a>
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true"><path d="M12 21c-4-3.6-7-7.06-7-10.5A7 7 0 0 1 19 10.5C19 13.94 16 17.4 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/></svg>
          <a href="https://www.google.com/maps/search/?api=1&query=SFR+Motors+Ltd+Mobile+Tyre+Fitters+Bathgate" target="_blank" rel="noopener">Bathgate, West Lothian</a>
        </li>
      </ul>
      </address>
    </div>

  </div>

  <div class="sfr-footer__bottom">
    <div class="sfr-footer__bottom-inner">
      <div class="sfr-footer__legal">
        <a href="/privacy-policy/">Privacy Policy</a>
        <a href="/cookie-policy/">Cookie Policy</a>
        <a href="/terms-and-conditions/">Terms &amp; Conditions</a>
      </div>
      &copy; 2026 SFR Motors Ltd. All Rights Reserved.
    </div>
  </div>
</footer>

<script src="/assets/js/main.js" defer></script>
<script src="/assets/js/analytics.js" defer></script>
</body>
</html>
`;
}

const LOCATIONS = [
  {
    slug: "mobile-tyre-fitting-armadale",
    town: "Armadale",
    hero: "fleet-hero-bg",
    heroHeight: 1146,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Armadale, West Lothian. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Armadale, West Lothian. We come to you.",
    introHeading: "Local Tyre Fitting For Armadale Drivers",
    introText:
      "Armadale sits on the A89 corridor in West Lothian, a short drive from our Bathgate base, which keeps our response times to the town competitive. Whether your car is on the drive, parked at work, or you've broken down nearby, we bring a fully equipped mobile fitting van to you rather than asking you to find a garage. That covers everything from a single new tyre to a full set, a puncture repair, or an out-of-hours emergency callout. Get in touch with your location in Armadale and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Armadale, we regularly attend nearby West Lothian towns including Bathgate, Whitburn and Blackburn. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of Armadale is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Puncture On The School Run", text: "A slow puncture shows up on the way to drop the kids off in Armadale. Mobile fitting at the roadside or the school car park means the rest of the day doesn't get derailed chasing a garage appointment." },
    scenario2: { title: "Worn Tyres Ahead Of A Long Drive", text: "Tread depth is borderline before a longer trip out of Armadale. We can check, advise honestly on whether a repair or replacement is the right call, and fit on the spot if new tyres are needed." },
    nearby: [
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "Whitburn", href: "/mobile-tyre-fitting-whitburn/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Livingston", href: "/mobile-tyre-fitting-livingston/" },
    ],
    faqs: [
      { q: "Do you cover all of Armadale?", a: "Yes, we regularly attend callouts across Armadale, along with nearby West Lothian towns such as Bathgate and Whitburn." },
      { q: "How quickly can you reach me in Armadale?", a: "Armadale is close to our Bathgate base, so response times are usually competitive — get in touch with your location and we'll give you a realistic estimate." },
      { q: "Can you fit tyres at my workplace in Armadale?", a: "Yes, we attend workplaces, car parks and driveways across Armadale — just let us know the location when you get in touch." },
      { q: "What if I break down on the A89 near Armadale?", a: "We can attend roadside breakdowns near Armadale, including along the A89 — let us know exactly where you are and we'll confirm arrival time." },
      { q: "Do you offer emergency tyre assistance in Armadale at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Armadale." },
    ],
  },
  {
    slug: "mobile-tyre-fitting-whitburn",
    town: "Whitburn",
    hero: "emergency-hero-bg",
    heroHeight: 1010,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Whitburn, West Lothian. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Whitburn, West Lothian. We come to you.",
    introHeading: "Local Tyre Fitting For Whitburn Drivers",
    introText:
      "Whitburn sits just off the M8 in West Lothian, close to our Bathgate base, which makes callouts to the town straightforward for us. Wherever your vehicle is parked — at home, at work, or stopped at the roadside near the motorway — we bring the fitting bay to you instead of the other way around. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Whitburn and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Whitburn, we regularly attend nearby West Lothian towns including Bathgate, Armadale and Blackburn. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of Whitburn is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat Near The M8", text: "A tyre gives way close to the motorway near Whitburn. Rather than a tow to a garage, we can attend a safe roadside or nearby car park location and get you moving again." },
    scenario2: { title: "A Slow Leak Picked Up Locally", text: "A tyre keeps losing pressure after picking up debris on a Whitburn road. We can inspect it on-site and either repair or replace it there and then, depending on what's safe." },
    nearby: [
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "Armadale", href: "/mobile-tyre-fitting-armadale/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Livingston", href: "/mobile-tyre-fitting-livingston/" },
    ],
    faqs: [
      { q: "Do you cover all of Whitburn?", a: "Yes, we regularly attend callouts across Whitburn, along with nearby West Lothian towns such as Bathgate and Armadale." },
      { q: "How quickly can you reach me in Whitburn?", a: "Whitburn is close to our Bathgate base, so response times are usually competitive — get in touch with your location and we'll give you a realistic estimate." },
      { q: "Can you help with a breakdown near the M8 at Whitburn?", a: "Yes, we attend roadside callouts near Whitburn, including close to the M8 — let us know exactly where you are so we can confirm arrival time safely." },
      { q: "Can you fit tyres at my workplace in Whitburn?", a: "Yes, we attend workplaces, car parks and driveways across Whitburn — just let us know the location when you get in touch." },
      { q: "Do you offer emergency tyre assistance in Whitburn at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Whitburn." },
    ],
  },
  {
    slug: "mobile-tyre-fitting-airdrie",
    town: "Airdrie",
    hero: "about-hero-bg",
    heroHeight: 1008,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Airdrie, North Lanarkshire. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Airdrie, North Lanarkshire. We come to you.",
    introHeading: "Local Tyre Fitting For Airdrie Drivers",
    introText:
      "Airdrie sits in North Lanarkshire, along the same A89/M8 corridor that connects it to our Bathgate base, so it's well within reach for a mobile callout. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Airdrie and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Airdrie, we regularly attend nearby towns including Bathgate and the wider West Lothian area. Coverage can vary depending on the day, distance and how busy we are, so if you're not sure whether your part of Airdrie is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat Before The Commute", text: "A tyre goes down first thing before the commute out of Airdrie. Fitting at the driveway rather than a garage queue means the day doesn't get thrown off completely." },
    scenario2: { title: "Locking Wheel Nut Issues At Home", text: "A locking wheel nut key has gone missing and a tyre needs changing at an Airdrie address. We carry the specialist tools to remove it on-site without damaging the alloy." },
    nearby: [
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Livingston", href: "/mobile-tyre-fitting-livingston/" },
      { name: "Falkirk", href: "/mobile-tyre-fitting-falkirk/" },
    ],
    faqs: [
      { q: "Do you cover Airdrie?", a: "Yes, we attend callouts in Airdrie as part of our wider coverage area alongside Bathgate and West Lothian — get in touch with your location and we'll confirm." },
      { q: "How quickly can you reach me in Airdrie?", a: "Airdrie is a little further from our Bathgate base than our closest towns, so let us know your location and we'll give you a realistic arrival estimate rather than a generic promise." },
      { q: "Can you fit tyres at my workplace in Airdrie?", a: "Yes, we attend workplaces, car parks and driveways across Airdrie — just let us know the location when you get in touch." },
      { q: "Do you cover vans and trade vehicles based in Airdrie?", a: "Yes, our trade and fleet tyre service covers Airdrie-based vans and business vehicles — see our trade and fleet tyre services page for details." },
      { q: "Do you offer emergency tyre assistance in Airdrie at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Airdrie." },
    ],
  },
  {
    // Live URL is the bare "/broxburn/" (confirmed via search — no
    // "mobile-tyre-fitting-" prefix, unlike the other location pages).
    // Matched exactly per Task 1's preference, even though it breaks this
    // site's own naming convention for the other town pages.
    slug: "broxburn",
    town: "Broxburn",
    hero: "puncture-hero-bg",
    heroHeight: 1010,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Broxburn, West Lothian. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Broxburn, West Lothian. We come to you.",
    introHeading: "Local Tyre Fitting For Broxburn Drivers",
    introText:
      "Broxburn sits in West Lothian, along the A89 corridor between Edinburgh and Bathgate, well within reach of our base for a mobile callout. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Broxburn and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Broxburn, we regularly attend nearby West Lothian towns including Bathgate, Livingston and the wider West Lothian area. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of Broxburn is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Puncture On The Way To Work", text: "A tyre goes down on the commute out of Broxburn. Fitting at the roadside or a nearby car park means the rest of the day doesn't get derailed chasing a garage appointment." },
    scenario2: { title: "Worn Tyres Found At An MOT", text: "A local garage flags worn tyres during an MOT but can't fit them in on the spot. We can often get a Broxburn address sorted before it becomes a re-test problem." },
    nearby: [
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "Livingston", href: "/mobile-tyre-fitting-livingston/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Edinburgh", href: "/mobile-tyre-fitting-edinburgh/" },
    ],
    faqs: [
      { q: "Do you cover all of Broxburn?", a: "Yes, we regularly attend callouts across Broxburn, along with nearby West Lothian towns such as Bathgate and Livingston." },
      { q: "How quickly can you reach me in Broxburn?", a: "Broxburn is within our regular West Lothian coverage area, so get in touch with your location and we'll give you a realistic arrival estimate." },
      { q: "Can you fit tyres at my workplace in Broxburn?", a: "Yes, we attend workplaces, car parks and driveways across Broxburn — just let us know the location when you get in touch." },
      { q: "What if I break down on the A89 near Broxburn?", a: "We can attend roadside breakdowns near Broxburn, including along the A89 — let us know exactly where you are and we'll confirm arrival time." },
      { q: "Do you offer emergency tyre assistance in Broxburn at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Broxburn." },
    ],
  },
  // ---- Batch A (Phase 4B): recreated from the WordPress export's confirmed,
  // genuine location content for these 5 towns (Bo'ness, Harthill, Addiewell,
  // Linlithgow, West Calder) — written fresh, not scraped, but drawing on the
  // real local geography (roads, neighbouring towns, well-known public
  // landmarks) confirmed present in the live export for each. See
  // WORDPRESS_MIGRATION_AUDIT.md §3/§6 for the audit trail. ----
  {
    slug: "mobile-tyre-fitting-boness",
    town: "Bo'ness",
    hero: "fleet-hero-bg",
    heroHeight: 1146,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Bo'ness, Falkirk district. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Bo'ness. We come to you.",
    introHeading: "Local Tyre Fitting For Bo'ness Drivers",
    introText:
      "Bo'ness sits on the Firth of Forth in the Falkirk district, a manageable drive from our Bathgate base along the A904 towards Grangemouth. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Bo'ness and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Bo'ness, we regularly attend the surrounding Falkirk district, including Grangemouth and Linlithgow. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of Bo'ness is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat Near The Waterfront", text: "A tyre gives way while parked up near the Forth waterfront in Bo'ness. We can attend a safe roadside or car park location and get you moving again without a tow." },
    scenario2: { title: "Worn Tyres Ahead Of The A904 Commute", text: "Tread depth is borderline before a regular commute along the A904 towards Grangemouth. We can check, advise honestly, and fit on the spot if new tyres are needed." },
    nearby: [
      { name: "Linlithgow", href: "/mobile-tyre-fitting-linlithgow/" },
      { name: "Falkirk", href: "/mobile-tyre-fitting-falkirk/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
    ],
    faqs: [
      { q: "Do you cover all of Bo'ness?", a: "Yes, we attend callouts across Bo'ness and the surrounding Falkirk district — get in touch with your location and we'll confirm." },
      { q: "How quickly can you reach me in Bo'ness?", a: "Get in touch with your location in Bo'ness and we'll give you a realistic arrival estimate rather than a generic promise." },
      { q: "Can you fit tyres at my workplace in Bo'ness?", a: "Yes, we attend workplaces, car parks and driveways across Bo'ness — just let us know the location when you get in touch." },
      { q: "What if I break down on the A904 near Bo'ness?", a: "We can attend roadside breakdowns near Bo'ness, including along the A904 towards Grangemouth — let us know exactly where you are and we'll confirm arrival time." },
      { q: "Do you offer emergency tyre assistance in Bo'ness at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Bo'ness." },
    ],
  },
  {
    slug: "mobile-tyre-fitting-harthill",
    town: "Harthill",
    hero: "emergency-hero-bg",
    heroHeight: 1010,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Harthill, North Lanarkshire. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Harthill. We come to you.",
    introHeading: "Local Tyre Fitting For Harthill Drivers",
    introText:
      "Harthill sits right on the M8, on the corridor linking Glasgow and Edinburgh, and close to our Bathgate base. Wherever your vehicle is — at home, at work, or stopped at the roadside near the motorway — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Harthill and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Harthill, we regularly attend nearby towns including Shotts and the wider Bathgate and West Lothian area. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of Harthill is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat Near The M8", text: "A tyre gives way close to the motorway near Harthill. Rather than a tow to a garage, we can attend a safe roadside or nearby car park location and get you moving again." },
    scenario2: { title: "A Puncture Found On Howburn Road", text: "A slow puncture shows up on a Harthill side road. We can inspect it on-site and either repair or replace it there and then, depending on what's safe." },
    nearby: [
      { name: "Shotts", href: "/mobile-tyre-fitting-shotts/" },
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Airdrie", href: "/mobile-tyre-fitting-airdrie/" },
    ],
    faqs: [
      { q: "Do you cover all of Harthill?", a: "Yes, we attend callouts across Harthill and nearby towns such as Shotts and Bathgate — get in touch with your location and we'll confirm." },
      { q: "How quickly can you reach me in Harthill?", a: "Harthill is on the M8 corridor close to our Bathgate base — get in touch with your location and we'll give you a realistic arrival estimate." },
      { q: "Can you help with a breakdown near the M8 at Harthill?", a: "Yes, we attend roadside callouts near Harthill, including close to the M8 — let us know exactly where you are so we can confirm arrival time safely." },
      { q: "Can you fit tyres at my workplace in Harthill?", a: "Yes, we attend workplaces, car parks and driveways across Harthill — just let us know the location when you get in touch." },
      { q: "Do you offer emergency tyre assistance in Harthill at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Harthill." },
    ],
  },
  {
    slug: "mobile-tyre-fitting-in-addiewell",
    town: "Addiewell",
    hero: "about-hero-bg",
    heroHeight: 1008,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Addiewell, West Lothian. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Addiewell. We come to you.",
    introHeading: "Local Tyre Fitting For Addiewell Drivers",
    introText:
      "Addiewell sits in West Lothian close to West Calder, a short drive from our Bathgate base and on the route many local drivers take commuting towards Edinburgh. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Addiewell and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Addiewell, we regularly attend nearby West Lothian towns including West Calder, Bathgate and the wider West Lothian area. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of Addiewell is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat Before The Edinburgh Commute", text: "A tyre goes down first thing before the commute out of Addiewell towards Edinburgh. Fitting at the driveway rather than a garage queue means the day doesn't get thrown off completely." },
    scenario2: { title: "A Slow Leak Picked Up Locally", text: "A tyre keeps losing pressure after picking up debris on a local road. We can inspect it on-site and either repair or replace it there and then, depending on what's safe." },
    nearby: [
      { name: "West Calder", href: "/mobile-tyre-fitting-west-calder/" },
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Livingston", href: "/mobile-tyre-fitting-livingston/" },
    ],
    faqs: [
      { q: "Do you cover all of Addiewell?", a: "Yes, we regularly attend callouts across Addiewell, along with nearby West Lothian towns such as West Calder and Bathgate." },
      { q: "How quickly can you reach me in Addiewell?", a: "Addiewell is within our regular West Lothian coverage area — get in touch with your location and we'll give you a realistic arrival estimate." },
      { q: "Can you fit tyres at my workplace in Addiewell?", a: "Yes, we attend workplaces, car parks and driveways across Addiewell — just let us know the location when you get in touch." },
      { q: "Do you cover the drive between Addiewell and Edinburgh?", a: "Yes, we can attend roadside breakdowns on the routes between Addiewell and Edinburgh — let us know exactly where you are and we'll confirm arrival time." },
      { q: "Do you offer emergency tyre assistance in Addiewell at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Addiewell." },
    ],
  },
  {
    slug: "mobile-tyre-fitting-linlithgow",
    town: "Linlithgow",
    hero: "puncture-hero-bg",
    heroHeight: 1010,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Linlithgow, West Lothian. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Linlithgow. We come to you.",
    introHeading: "Local Tyre Fitting For Linlithgow Drivers",
    introText:
      "Linlithgow sits between Bo'ness and Bathgate in West Lothian, on the corridor connecting Falkirk to Edinburgh, and well within reach of our base for a mobile callout. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Linlithgow and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Linlithgow, we regularly attend nearby West Lothian towns including Bo'ness, Bathgate and the wider West Lothian area. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of Linlithgow is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Puncture Near The Town Centre", text: "A tyre picks up damage parked near Linlithgow's town centre. We can attend and assess it on-site, repairing it where that's safe or fitting a replacement if not." },
    scenario2: { title: "Worn Tyres Ahead Of A Longer Drive", text: "Tread depth is borderline before a longer trip out of Linlithgow. We can check, advise honestly on whether a repair or replacement is the right call, and fit on the spot if new tyres are needed." },
    nearby: [
      { name: "Bo'ness", href: "/mobile-tyre-fitting-boness/" },
      { name: "Falkirk", href: "/mobile-tyre-fitting-falkirk/" },
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
    ],
    faqs: [
      { q: "Do you cover all of Linlithgow?", a: "Yes, we regularly attend callouts across Linlithgow, along with nearby West Lothian towns such as Bo'ness and Bathgate." },
      { q: "How quickly can you reach me in Linlithgow?", a: "Linlithgow is within our regular West Lothian coverage area — get in touch with your location and we'll give you a realistic arrival estimate." },
      { q: "Can you fit tyres at my workplace in Linlithgow?", a: "Yes, we attend workplaces, car parks and driveways across Linlithgow — just let us know the location when you get in touch." },
      { q: "What if I break down between Linlithgow and Bathgate?", a: "We can attend roadside breakdowns on the routes between Linlithgow and Bathgate — let us know exactly where you are and we'll confirm arrival time." },
      { q: "Do you offer emergency tyre assistance in Linlithgow at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Linlithgow." },
    ],
  },
  {
    slug: "mobile-tyre-fitting-west-calder",
    town: "West Calder",
    hero: "fleet-hero-bg",
    heroHeight: 1146,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in West Calder, West Lothian. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in West Calder. We come to you.",
    introHeading: "Local Tyre Fitting For West Calder Drivers",
    introText:
      "West Calder sits on the A71 in West Lothian, close to Addiewell and Polbeth, and a manageable drive from our Bathgate base. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in West Calder and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as West Calder, we regularly attend nearby West Lothian towns including Addiewell, Polbeth and Bathgate. Coverage can vary depending on the day and how busy we are, so if you're not sure whether your part of West Calder is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat On The A71", text: "A tyre gives way while driving the A71 near West Calder. We can attend a safe roadside or nearby car park location and get you moving again without a tow." },
    scenario2: { title: "A Puncture Near West Calder High School", text: "A slow puncture shows up on the school run in West Calder. Mobile fitting at a safe nearby location means the rest of the day doesn't get derailed chasing a garage appointment." },
    nearby: [
      { name: "Addiewell", href: "/mobile-tyre-fitting-in-addiewell/" },
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
      { name: "Livingston", href: "/mobile-tyre-fitting-livingston/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
    ],
    faqs: [
      { q: "Do you cover all of West Calder?", a: "Yes, we regularly attend callouts across West Calder, along with nearby West Lothian towns such as Addiewell and Bathgate." },
      { q: "How quickly can you reach me in West Calder?", a: "West Calder is within our regular West Lothian coverage area — get in touch with your location and we'll give you a realistic arrival estimate." },
      { q: "Can you fit tyres at my workplace in West Calder?", a: "Yes, we attend workplaces, car parks and driveways across West Calder — just let us know the location when you get in touch." },
      { q: "What if I break down on the A71 near West Calder?", a: "We can attend roadside breakdowns near West Calder, including along the A71 — let us know exactly where you are and we'll confirm arrival time." },
      { q: "Do you offer emergency tyre assistance in West Calder at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in West Calder." },
    ],
  },
  // ---- Shotts and Wishaw: per WORDPRESS_MIGRATION_AUDIT.md §6 Q3, the live
  // WordPress pages for these two currently show another town's content
  // verbatim (Bathgate and Edinburgh respectively) — not migrated here. This
  // content is deliberately generic where it can't be verified: no invented
  // landmarks, response times, local offices or customer claims, only the
  // already-documented business facts (address, phone, 24/7, coverage-area
  // membership per SFR_Website_Info.txt) and well-known, publicly verifiable
  // geography (motorway/road corridors, county). ----
  {
    slug: "mobile-tyre-fitting-shotts",
    town: "Shotts",
    hero: "emergency-hero-bg",
    heroHeight: 1010,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Shotts, North Lanarkshire. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Shotts. We come to you.",
    introHeading: "Local Tyre Fitting For Shotts Drivers",
    introText:
      "Shotts sits in North Lanarkshire on the corridor between Edinburgh and Glasgow, within reach of our Bathgate base for a mobile callout. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Shotts and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Shotts, we regularly attend nearby towns including Harthill and Wishaw, as part of our wider coverage area. Coverage can vary depending on the day, distance and how busy we are, so if you're not sure whether your part of Shotts is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat Before The Commute", text: "A tyre goes down first thing before a commute out of Shotts. Fitting at the driveway rather than a garage queue means the day doesn't get thrown off completely." },
    scenario2: { title: "A Puncture Found Locally", text: "A slow puncture shows up on a Shotts road. We can inspect it on-site and either repair or replace it there and then, depending on what's safe." },
    nearby: [
      { name: "Harthill", href: "/mobile-tyre-fitting-harthill/" },
      { name: "Wishaw", href: "/mobile-tyre-fitting-wishaw/" },
      { name: "Airdrie", href: "/mobile-tyre-fitting-airdrie/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
    ],
    faqs: [
      { q: "Do you cover Shotts?", a: "Yes, we attend callouts in Shotts as part of our wider coverage area — get in touch with your location and we'll confirm." },
      { q: "How quickly can you reach me in Shotts?", a: "Let us know your location in Shotts and we'll give you a realistic arrival estimate rather than a generic promise." },
      { q: "Can you fit tyres at my workplace in Shotts?", a: "Yes, we attend workplaces, car parks and driveways across Shotts — just let us know the location when you get in touch." },
      { q: "Do you cover vans and trade vehicles based in Shotts?", a: "Yes, our trade and fleet tyre service covers Shotts-based vans and business vehicles — see our trade and fleet tyre services page for details." },
      { q: "Do you offer emergency tyre assistance in Shotts at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Shotts." },
    ],
  },
  {
    slug: "mobile-tyre-fitting-wishaw",
    town: "Wishaw",
    hero: "about-hero-bg",
    heroHeight: 1008,
    metaDescription: "SFR Motors Ltd provides 24/7 mobile tyre fitting, repair and replacement in Wishaw, North Lanarkshire. We come to your home, workplace or roadside — get a free quote today.",
    ogDescription: "24/7 mobile tyre fitting, repair and replacement in Wishaw. We come to you.",
    introHeading: "Local Tyre Fitting For Wishaw Drivers",
    introText:
      "Wishaw sits in North Lanarkshire on the M8 corridor, within reach of our Bathgate base for a mobile callout. Wherever your vehicle is — at home, at work, or stopped at the roadside — we bring a fully equipped fitting van to you rather than asking you to find a garage. That covers new tyre fitting, replacements, puncture repair and out-of-hours emergency assistance. Get in touch with your location in Wishaw and we'll confirm availability and a price before we set off.",
    areasText:
      "As well as Wishaw, we regularly attend nearby towns including Shotts and Airdrie, as part of our wider coverage area. Coverage can vary depending on the day, distance and how busy we are, so if you're not sure whether your part of Wishaw is included, just get in touch with your location and we'll confirm before you book anything in.",
    scenario1: { title: "A Flat Near The M8", text: "A tyre gives way close to the motorway near Wishaw. Rather than a tow to a garage, we can attend a safe roadside or nearby car park location and get you moving again." },
    scenario2: { title: "Worn Tyres Ahead Of A Long Drive", text: "Tread depth is borderline before a longer trip out of Wishaw. We can check, advise honestly on whether a repair or replacement is the right call, and fit on the spot if new tyres are needed." },
    nearby: [
      { name: "Shotts", href: "/mobile-tyre-fitting-shotts/" },
      { name: "Airdrie", href: "/mobile-tyre-fitting-airdrie/" },
      { name: "West Lothian", href: "/mobile-tyre-fitting-west-lothian/" },
      { name: "Bathgate", href: "/mobile-tyre-fitting-bathgate/" },
    ],
    faqs: [
      { q: "Do you cover Wishaw?", a: "Yes, we attend callouts in Wishaw as part of our wider coverage area — get in touch with your location and we'll confirm." },
      { q: "How quickly can you reach me in Wishaw?", a: "Let us know your location in Wishaw and we'll give you a realistic arrival estimate rather than a generic promise." },
      { q: "Can you fit tyres at my workplace in Wishaw?", a: "Yes, we attend workplaces, car parks and driveways across Wishaw — just let us know the location when you get in touch." },
      { q: "Can you help with a breakdown near the M8 at Wishaw?", a: "Yes, we attend roadside callouts near Wishaw, including close to the M8 — let us know exactly where you are so we can confirm arrival time safely." },
      { q: "Do you offer emergency tyre assistance in Wishaw at night?", a: "Yes, we operate 24/7, so get in touch any time and we'll confirm what we can do for an out-of-hours callout in Wishaw." },
    ],
  },
];

for (const loc of LOCATIONS) {
  const outDir = path.join(SITE_DIR, loc.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), renderPage(loc));
  console.log(`  generated site/${loc.slug}/index.html`);
}
