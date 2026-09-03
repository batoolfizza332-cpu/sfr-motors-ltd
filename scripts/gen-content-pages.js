#!/usr/bin/env node
// One-off Phase 3 content restoration: generates the legal pages (privacy,
// cookies, terms — missing from site/ entirely before this), the tyre-range
// page, and a starter blog (index + one post recreated at its live slug so
// no redirect is needed for it) — see the Phase 2 migration plan's content-gap
// list. Shares the site's standard header/nav/footer chrome; body content
// uses the new .sfr-legal / .sfr-bloglist components added to main.css.
//
// Run once: `node scripts/gen-content-pages.js`.

"use strict";

const fs = require("fs");
const path = require("path");

const SITE_DIR = path.join(__dirname, "..", "site");
const DOMAIN = "https://sfrmotors.co.uk";

function shell({ slug, title, metaDescription, breadcrumbLabel, bodyHtml, robots = "index, follow", extraSchema = "" }) {
  const url = `${DOMAIN}/${slug}/`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${metaDescription}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#0c0d0f">

<meta property="og:type" content="website">
<meta property="og:site_name" content="SFR Motors Ltd">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${metaDescription}">
<meta property="og:image" content="https://sfrmotors.co.uk/assets/img/og-image.jpg">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/assets/img/logo.webp" type="image/webp">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap">

<link rel="stylesheet" href="/assets/css/main.css">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "${DOMAIN}/" },
    { "@type": "ListItem", "position": 2, "name": "${breadcrumbLabel}", "item": "${url}" }
  ]
}
</script>${extraSchema}
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
    <li aria-current="page">${breadcrumbLabel}</li>
  </ol>
</nav>

${bodyHtml}

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
        <li><a href="/caravan-trailer-tyre-fitting/">Caravan &amp; Trailer Tyres</a></li>
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

function legalSection({ eyebrow, title, updated, bodyHtml }) {
  return `<section class="sfr-legal" aria-labelledby="sfr-legal-h1">
  <div class="sfr-legal__inner">
    <div class="sfr-legal__eyebrow">${eyebrow}</div>
    <h1 class="sfr-legal__title" id="sfr-legal-h1">${title}</h1>
    <p class="sfr-legal__updated">Last updated: 3 September 2026</p>
    <div class="sfr-legal__body">
${bodyHtml}
    </div>
  </div>
</section>`;
}

const pages = [];

// ---------------------------------------------------------------- Privacy
pages.push({
  slug: "privacy-policy",
  title: "Privacy Policy | SFR Motors Ltd",
  metaDescription: "How SFR Motors Ltd collects, uses and protects your information when you contact us or use sfrmotors.co.uk.",
  breadcrumbLabel: "Privacy Policy",
  bodyHtml: legalSection({
    eyebrow: "Legal",
    title: "Privacy Policy",
    bodyHtml: `      <p>SFR Motors Ltd ("we", "us", "our") provides mobile tyre fitting services across Bathgate, West Lothian and the surrounding area. This page explains what happens to your information when you visit sfrmotors.co.uk or get in touch with us.</p>

      <h2>Who we are</h2>
      <p>SFR Motors Ltd, 39 S Loch Park, Bathgate, West Lothian, EH48 2QZ, United Kingdom. You can reach us on <a href="tel:01312020289">0131 202 0289</a> or <a href="mailto:info@sfrmotors.co.uk">info@sfrmotors.co.uk</a>.</p>

      <h2>Information you give us</h2>
      <p>When you use the quote form on this site, you may give us your name, phone number, vehicle details, registration, tyre size, location and preferred appointment time. Submitting the form opens a pre-filled WhatsApp message addressed to us — the information is sent directly to our WhatsApp number and is not collected, stored or processed by this website itself; we do not run a server that stores form submissions. If you message or call us directly, we handle that information the same way any small business would, only to arrange and carry out your tyre service.</p>

      <h2>Information collected automatically</h2>
      <p>This website may use Google Analytics (GA4) to understand how the site is used — for example, which pages are visited and which buttons are clicked. Where analytics is active, it does not receive anything you type into the quote form; only the fact that a call, WhatsApp message or quote request happened is recorded. See our <a href="/cookie-policy/">Cookie Policy</a> for details of what this involves and when it is switched on.</p>

      <h2>How we use your information</h2>
      <ul>
        <li>To respond to your enquiry and arrange, carry out and follow up on a tyre fitting, repair or replacement.</li>
        <li>To keep basic records of work carried out, where relevant for warranty, invoicing or trade/fleet account purposes.</li>
        <li>To understand how our website is used, where analytics is active, so we can improve it.</li>
      </ul>
      <p>We do not sell your information, and we do not use it for marketing you haven't asked for.</p>

      <h2>Sharing your information</h2>
      <p>We don't share your information with third parties except where a service provider needs it to help us operate — for example, WhatsApp (Meta) to receive your enquiry message, or Google if analytics is active — or where we're required to by law.</p>

      <h2>How long we keep it</h2>
      <p>We keep enquiry and job information for as long as reasonably needed for the purpose it was collected — typically for warranty and accounting purposes — and no longer than necessary.</p>

      <h2>Your rights</h2>
      <p>Under UK GDPR, you have the right to ask what information we hold about you, to ask us to correct or delete it, and to object to how it's used. To do any of this, contact us at <a href="mailto:info@sfrmotors.co.uk">info@sfrmotors.co.uk</a>. If you're not satisfied with our response, you can complain to the Information Commissioner's Office (ico.org.uk).</p>

      <h2>Changes to this policy</h2>
      <p>We may update this page from time to time. The date at the top shows when it was last revised.</p>

      <p><em>This policy is a plain-English starting point reflecting how the website currently works. As with any legal page, we'd recommend having it reviewed by a solicitor before it goes live, particularly once analytics or any new data collection is switched on.</em></p>`,
  }),
});

// ---------------------------------------------------------------- Cookies
pages.push({
  slug: "cookie-policy",
  title: "Cookie Policy | SFR Motors Ltd",
  metaDescription: "What cookies sfrmotors.co.uk uses, why, and how to control them.",
  breadcrumbLabel: "Cookie Policy",
  bodyHtml: legalSection({
    eyebrow: "Legal",
    title: "Cookie Policy",
    bodyHtml: `      <p>This page explains how sfrmotors.co.uk uses cookies and similar technology, and the choices you have.</p>

      <h2>What are cookies?</h2>
      <p>Cookies are small text files a website can place on your device to remember information — for example, whether you've visited before, or how you found the site.</p>

      <h2>What this site currently uses</h2>
      <table>
        <thead><tr><th>Type</th><th>Purpose</th><th>Sets cookies?</th></tr></thead>
        <tbody>
          <tr><td>Google Fonts</td><td>Loads the site's typeface</td><td>No — served without cookies</td></tr>
          <tr><td>Quote form</td><td>Opens a pre-filled WhatsApp message</td><td>No — handled entirely in your browser, nothing stored by this site</td></tr>
          <tr><td>Google Analytics (GA4)</td><td>Understands how the site is used</td><td>Only if and when it's switched on — see below</td></tr>
        </tbody>
      </table>

      <h2>About our analytics cookies</h2>
      <p>This site is built with optional support for Google Analytics (GA4), which — when active — sets cookies to distinguish visitors and measure page and button engagement (such as calls, WhatsApp clicks and quote requests). At the time of writing, analytics has not yet been switched on for this site. If it is switched on in future, this policy will be updated, and — in line with UK PECR/GDPR rules on cookie consent — a way to accept or decline non-essential cookies will be added before analytics starts running.</p>

      <h2>Managing cookies</h2>
      <p>You can control or delete cookies through your browser settings at any time. Blocking cookies won't stop you calling, messaging or getting a quote from us — none of that depends on cookies.</p>

      <h2>Questions</h2>
      <p>If you have any questions about this policy, contact us at <a href="mailto:info@sfrmotors.co.uk">info@sfrmotors.co.uk</a>.</p>

      <p><em>As with the Privacy Policy, we'd recommend a solicitor reviews this page — particularly the consent mechanism — before analytics is switched on.</em></p>`,
  }),
});

// ---------------------------------------------------------------- Terms
pages.push({
  slug: "terms-and-conditions",
  title: "Terms & Conditions | SFR Motors Ltd",
  metaDescription: "The terms that apply when you book a mobile tyre fitting, repair or replacement with SFR Motors Ltd, and when you use sfrmotors.co.uk.",
  breadcrumbLabel: "Terms & Conditions",
  bodyHtml: legalSection({
    eyebrow: "Legal",
    title: "Terms &amp; Conditions",
    bodyHtml: `      <p>These terms apply when you book a service with SFR Motors Ltd or use sfrmotors.co.uk. By requesting a quote, booking a callout, or using this website, you agree to them.</p>

      <h2>Quotes and pricing</h2>
      <p>Prices we give over the phone, by WhatsApp or via the quote form are estimates based on the information you provide. The final price is confirmed before any work begins, and may change if the job turns out to need different parts, tyres or work once we're on-site — we'll always tell you before proceeding.</p>

      <h2>Booking and arrival times</h2>
      <p>Arrival times we give are estimates, not guarantees — actual arrival can be affected by traffic, weather, the number of callouts we're handling, and the exact location. We'll keep you updated if a job is going to take longer than expected to reach you.</p>

      <h2>Payment</h2>
      <p>We accept card, cash and other common payment methods, as agreed at the time of booking. Payment is due on completion of the work unless otherwise agreed in advance, for example under a trade or fleet account.</p>

      <h2>Cancellations</h2>
      <p>You can cancel or reschedule a booking by contacting us as early as possible. Since callouts are scheduled around your location and timing, please give us as much notice as you can if your plans change.</p>

      <h2>Tyres and parts</h2>
      <p>Where we fit a tyre or part you haven't personally chosen the exact specification for, we'll match it to your vehicle's requirements as best we reasonably can and confirm with you before fitting. Any manufacturer's warranty on tyres or parts is provided by the manufacturer, not by us, in addition to your statutory rights.</p>

      <h2>Liability</h2>
      <p>We carry out all work to a professional standard. Nothing in these terms limits our liability for death or personal injury caused by our negligence, or for anything else that can't legally be limited or excluded.</p>

      <h2>Using this website</h2>
      <p>You're welcome to browse and use this website for the purpose of finding out about and booking our services. Content on this site — text, images and logo — belongs to SFR Motors Ltd unless stated otherwise, and shouldn't be copied or reused without permission.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the law of Scotland, and any dispute will be subject to the jurisdiction of the Scottish courts.</p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent to <a href="mailto:info@sfrmotors.co.uk">info@sfrmotors.co.uk</a> or <a href="tel:01312020289">0131 202 0289</a>.</p>

      <p><em>These terms are a plain-English starting point for a small mobile tyre-fitting business. As with the other legal pages, we'd recommend a solicitor reviews them — particularly the liability and warranty sections — before they go live.</em></p>`,
  }),
});

// ---------------------------------------------------------------- Tyre range
pages.push({
  slug: "our-tyre-range",
  title: "Our Tyre Range | SFR Motors Ltd",
  metaDescription: "SFR Motors Ltd fits a wide range of tyre brands and budgets, mobile, across Bathgate and West Lothian. Get a free quote for your vehicle.",
  breadcrumbLabel: "Our Tyre Range",
  bodyHtml: legalSection({
    eyebrow: "Tyres We Fit",
    title: "Our Tyre Range",
    bodyHtml: `      <p>Whatever you drive and whatever your budget, we carry a wide range of tyre sizes and options on our vans so we can fit the right tyre for your vehicle on the same visit, wherever you're parked in Bathgate or West Lothian.</p>

      <h2>Premium, mid-range and budget options</h2>
      <p>We stock a spread of tyres across premium, mid-range and value price points, so you can choose what suits your vehicle, driving and budget — not just whatever happens to be on the shelf. If you have a specific brand or spec in mind, let us know when you get in touch and we'll confirm availability before we arrive.</p>

      <h2>Car, van, caravan and trailer sizes</h2>
      <p>Our vans carry common sizes for cars and light commercials, plus specialist sizes for caravans and trailers — see our <a href="/van-tyre-replacement-services/">van tyre replacement</a> and <a href="/caravan-trailer-tyre-fitting/">caravan &amp; trailer tyre fitting</a> pages for more on those.</p>

      <h2>Not sure which tyre you need?</h2>
      <p>Tell us your vehicle's registration or the size on your tyre's sidewall when you get in touch, and we'll confirm exactly what's needed and a price before we set off — no guesswork, no hidden charges.</p>

      <h2>How to get a price</h2>
      <p>Call <a href="tel:01312020289">0131 202 0289</a>, message us on <a href="https://wa.me/447448427154" target="_blank" rel="noopener">WhatsApp</a>, or use the <a href="/contact-us/#quote-form">quote form</a> and we'll get back to you with pricing for your vehicle.</p>`,
  }),
});

// ---------------------------------------------------------------- Blog index
const BLOG_POST_SLUG = "how-mobile-tyre-fitting-in-livingston-saves-time-and-improves-road-safety";
pages.push({
  slug: "blog",
  title: "Blog | SFR Motors Ltd",
  metaDescription: "Tyre tips, road safety advice and news from SFR Motors Ltd, Bathgate's mobile tyre fitting team.",
  breadcrumbLabel: "Blog",
  bodyHtml: `<section class="sfr-legal" aria-labelledby="sfr-legal-h1">
  <div class="sfr-legal__inner">
    <div class="sfr-legal__eyebrow">SFR Motors Blog</div>
    <h1 class="sfr-legal__title" id="sfr-legal-h1">Tyre Tips &amp; Road Safety Advice</h1>
    <p class="sfr-legal__updated">Practical, no-nonsense advice from the SFR Motors team.</p>
    <div class="sfr-bloglist">
      <article class="sfr-bloglist__item">
        <span class="sfr-bloglist__date">Blog post</span>
        <h2 class="sfr-bloglist__title"><a href="/blog/${BLOG_POST_SLUG}/">How Mobile Tyre Fitting In Livingston Saves Time And Improves Road Safety</a></h2>
        <p class="sfr-bloglist__excerpt">Why a mobile fitter can be faster and safer than a garage visit for Livingston drivers, especially when the fault is discovered somewhere inconvenient.</p>
        <a class="sfr-bloglist__link" href="/blog/${BLOG_POST_SLUG}/">Read more &rarr;</a>
      </article>
    </div>
    <p style="margin-top:28px;font-size:13.5px;color:var(--sfr-sub);">This blog is being rebuilt alongside the rest of the site — more posts are on the way. Looking for something specific? <a href="/contact-us/">get in touch</a>.</p>
  </div>
</section>`,
});

// ---------------------------------------------------------------- Blog post
const blogArticleSchema = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How Mobile Tyre Fitting In Livingston Saves Time And Improves Road Safety",
  "author": { "@type": "Organization", "name": "SFR Motors Ltd" },
  "publisher": {
    "@type": "Organization",
    "name": "SFR Motors Ltd",
    "logo": { "@type": "ImageObject", "url": "https://sfrmotors.co.uk/assets/img/logo.jpg" }
  },
  "mainEntityOfPage": "https://sfrmotors.co.uk/blog/${BLOG_POST_SLUG}/",
  "image": "https://sfrmotors.co.uk/assets/img/og-image.jpg"
}
</script>`;
pages.push({
  slug: `blog/${BLOG_POST_SLUG}`,
  title: "How Mobile Tyre Fitting In Livingston Saves Time And Improves Road Safety | SFR Motors Ltd",
  metaDescription: "Why choosing a mobile tyre fitter in Livingston can save you time and help you get back on the road safely, without a garage visit.",
  breadcrumbLabel: "Blog",
  extraSchema: blogArticleSchema,
  bodyHtml: `<section class="sfr-legal" aria-labelledby="sfr-legal-h1">
  <div class="sfr-legal__inner">
    <div class="sfr-legal__eyebrow">Blog</div>
    <h1 class="sfr-legal__title" id="sfr-legal-h1">How Mobile Tyre Fitting In Livingston Saves Time And Improves Road Safety</h1>
    <p class="sfr-legal__updated">By SFR Motors Ltd</p>
    <div class="sfr-legal__body">
      <p>A tyre problem rarely happens at a convenient time. Whether it's a slow puncture noticed on the school run or a tread you've been meaning to check for weeks, the usual routine — drive to a garage, wait, hope they can fit you in — costs time most people in Livingston don't have to spare. Mobile tyre fitting exists to remove that trade-off.</p>

      <h2>Why driving to a garage isn't always the safer option</h2>
      <p>If a tyre is already low, damaged or losing pressure, driving it to a garage — even a short distance — adds risk that a mobile callout avoids entirely. A mobile fitter comes to wherever the vehicle already is: your driveway, a work car park, or a safe spot near where the problem was noticed, so the vehicle doesn't need to be driven any further than necessary on a tyre that isn't right.</p>

      <h2>Time saved adds up</h2>
      <p>A typical garage visit means driving there, waiting for a bay, waiting for the work, then driving back — often the best part of a morning or afternoon. A mobile fitting appointment happens wherever you already are, so you can carry on with work, the school run, or whatever else is on that day while it's done.</p>

      <h2>What this looks like for Livingston drivers</h2>
      <p>We attend homes, workplaces and roadside locations across Livingston for tyre fitting, replacement, puncture repair and emergency callouts, 24/7. If you're not sure whether a tyre needs repairing or replacing, we can assess it on-site and give you an honest answer before doing any work.</p>

      <h2>Getting a mobile tyre fitter in Livingston</h2>
      <p>Call <a href="tel:01312020289">0131 202 0289</a>, message us on <a href="https://wa.me/447448427154" target="_blank" rel="noopener">WhatsApp</a>, or use the <a href="/contact-us/#quote-form">quote form</a> — see our <a href="/mobile-tyre-fitting-livingston/">Livingston coverage page</a> for more on the areas we attend.</p>
    </div>
  </div>
</section>`,
});

for (const p of pages) {
  const outDir = path.join(SITE_DIR, p.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), shell(p));
  console.log(`  generated site/${p.slug}/index.html`);
}
