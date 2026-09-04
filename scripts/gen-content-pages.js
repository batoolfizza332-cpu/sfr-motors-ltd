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
const { shell, DOMAIN } = require("./lib/page-shell.js");

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
      <p>We stock a spread of tyres across premium, mid-range and value price points, so you can choose what suits your vehicle, driving and budget — not just whatever happens to be on the shelf. If you have a specific brand or spec in mind, let us know when you get in touch and we'll confirm availability before we arrive. Not sure whether premium or budget is the right call? See our guide on <a href="/premium-or-budget-which-tyres-keep-you-safer/">how to compare tyres safely</a>.</p>

      <h2>Car, van, caravan and trailer sizes</h2>
      <p>Our vans carry common sizes for cars and light commercials, plus specialist sizes for caravans and trailers — see our <a href="/van-tyre-replacement-services/">van tyre replacement</a> and <a href="/mobile-trailer-and-caravan-tyre-fitting/">caravan &amp; trailer tyre fitting</a> pages for more on those.</p>

      <h2>Not sure which tyre you need?</h2>
      <p>Tell us your vehicle's registration or the size on your tyre's sidewall when you get in touch, and we'll confirm exactly what's needed and a price before we set off — no guesswork, no hidden charges. Curious about tread patterns? See our guide on <a href="/asymmetric-and-directional-tyres-difference/">asymmetric vs directional tyres</a>. Thinking about a different size altogether? Try our <a href="/tyre-size-calculator/">tyre size calculator</a> to compare the difference before you decide. New to choosing tyres altogether? See our <a href="/how-to-choose-the-best-tyres-for-my-car-expert-buying-guide/">guide to choosing the right tyres for your car</a>.</p>

      <h2>How to get a price</h2>
      <p>Call <a href="tel:01312020289">0131 202 0289</a>, message us on <a href="https://wa.me/447448427154" target="_blank" rel="noopener">WhatsApp</a>, or use the <a href="/contact-us/#quote-form">quote form</a> and we'll get back to you with pricing for your vehicle.</p>`,
  }),
});

// ---------------------------------------------------------------- Blog index
const BLOG_POST_SLUG = "how-mobile-tyre-fitting-in-livingston-saves-time-and-improves-road-safety";

// Articles recreated by scripts/gen-articles.js, listed here too so the
// blog index links to every one of them (not just carries them in the
// sitemap) — see that script for why each exists and lives at this exact
// root-level slug rather than under /blog/.
const OTHER_ARTICLES = [
  { slug: "mobile-tyre-fitting-guide", title: "Mobile Tyre Fitting Edinburgh: A Complete Guide", excerpt: "What mobile tyre fitting is, how booking works, and when it's the right choice over a garage visit." },
  { slug: "tyres-bathgate-guide", title: "Choosing The Right Van Tyres: A Bathgate Guide", excerpt: "How to tell when van tyres need replacing, and what to check when choosing new ones." },
  { slug: "mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation", title: "Mobile Tyre Fitting vs Recovery: What's Best For Your Situation?", excerpt: "A flat tyre isn't always a recovery job — how to tell which one you actually need." },
  { slug: "mobile-tyre-repair-edinburgh-west-lothian", title: "Mobile Tyre Repair In Edinburgh & West Lothian: What To Look For", excerpt: "What makes a mobile tyre repair service reliable — arrival times, repair standards and honest pricing." },
  { slug: "tyre-puncture-repair-near-me-west-lothian", title: "Finding Reliable Puncture Repair Near You In West Lothian", excerpt: "What to check before booking a 'puncture repair near me' search result." },
  { slug: "best-mobile-tyre-fitters-bathgate", title: "What Makes A Trustworthy Mobile Tyre Fitter In Bathgate", excerpt: "What to look for when choosing a mobile tyre fitter — response times, pricing, and honesty about the work." },
  { slug: "tyre-fitting-edinburgh-expert-technical-aspects-you-must-know", title: "Tyre Fitting In Edinburgh: Technical Aspects You Must Know", excerpt: "Load ratings, torque settings, balancing and TPMS resets — the technical side of a proper fitting job." },
  { slug: "better-tyres-better-drive", title: "Better Tyres, Better Drive: Why Tyre Condition Matters", excerpt: "How tyre condition affects safety, fuel efficiency and handling — and when it's time to replace." },
  { slug: "how-to-change-a-tyre", title: "How To Change A Tyre: A West Lothian Driver's Guide", excerpt: "A step-by-step guide to changing a flat tyre safely, and when to call a mobile fitter instead." },
  { slug: "locking-wheel-nut-removal", title: "Locking Wheel Nut Removal: Your Options Explained", excerpt: "Lost your locking wheel nut key? Here's how removal actually works, and what to expect." },
  { slug: "emergency-tyre-replacement", title: "Emergency Tyre Replacement vs Garage Tyre Fitting", excerpt: "What actually counts as a tyre emergency, and how emergency mobile tyre replacement compares to booking in at a garage." },
  { slug: "the-best-tyres-for-your-ford-on-edinburghs-roads", title: "The Best Tyres For Your Ford On Edinburgh's Roads", excerpt: "What to weigh up when choosing tyres for a Ford in Edinburgh — from city-run Fiestas to Transit vans." },
  { slug: "11-benefits-of-emergency-mobile-tyre-fitting", title: "11 Benefits of Emergency Mobile Tyre Fitting", excerpt: "Eleven practical reasons calling a mobile tyre fitter beats driving on a damaged tyre or waiting for recovery." },
  { slug: "7-warning-signs-your-tyres-need-immediate-professional-attention", title: "7 Warning Signs Your Tyres Need Immediate Professional Attention", excerpt: "Seven tyre warning signs worth acting on, and why only a physical inspection can confirm what's needed." },
  { slug: "emergency-wheel-nut-removal-what-to-do-if-youve-lost-the-key", title: "Emergency Wheel Nut Removal: What To Do If You've Lost The Key", excerpt: "Why forcing a locking wheel nut off yourself risks damage, and when professional removal is the safer option." },
  { slug: "why-tyre-safety-is-more-important-than-most-drivers-realize", title: "Why Tyre Safety Is More Important Than Most Drivers Realise", excerpt: "Why tyre condition affects braking, grip and control more than most drivers expect." },
  { slug: "asymmetric-and-directional-tyres-difference", title: "Asymmetric vs Directional Tyres: What's The Difference?", excerpt: "What asymmetric and directional tread patterns actually do, and how to tell which one is fitted to your car." },
  { slug: "how-quality-tyres-improve-safety-and-driving-performance", title: "How Quality Tyres Improve Safety and Driving Performance", excerpt: "How tyre condition affects braking, handling and fuel efficiency — and why it's worth paying attention to." },
  { slug: "how-to-avoid-common-tyre-problems-and-stay-safe-on-the-road", title: "How To Avoid Common Tyre Problems And Stay Safe On The Road", excerpt: "Practical tyre maintenance habits that help you avoid common problems and stay safe." },
  { slug: "what-is-mobile-tyre-fitting", title: "What Is Mobile Tyre Fitting?", excerpt: "What mobile tyre fitting actually means, how it differs from a garage visit, and what it typically covers." },
  { slug: "what-tools-do-mobile-tyre-fitters-use", title: "What Tools Do Mobile Tyre Fitters Use?", excerpt: "An inside look at the equipment a mobile tyre fitting van typically carries, from fitting kit to safety gear." },
  { slug: "professional-mobile-tyre-services-on-drivers-linlithgow", title: "Professional Mobile Tyre Services for Linlithgow Drivers", excerpt: "Why regular tyre maintenance matters, and what commercial van drivers in Linlithgow should know about tyre care." },
  { slug: "the-best-tyres-for-edinburgh-west-lothian-roads", title: "How To Choose The Right Tyres For Edinburgh & West Lothian Driving", excerpt: "What actually determines the right tyre for your car — vehicle requirements, size, season and how you drive." },
  { slug: "tyre-services-west-lothian", title: "Common Causes of a Slow Tyre Leak", excerpt: "Why a tyre might be slowly losing air, and why a leak always needs a proper inspection rather than a guess." },
  { slug: "your-guide-to-safe-tyre-services-in-harthill", title: "Your Guide to Safe Tyre Care for Harthill Drivers", excerpt: "Why professional tyre care matters, and how punctures and locking wheel nuts are safely handled." },
  { slug: "tyre-size-calculator", title: "Tyre Size Calculator", excerpt: "Compare two tyre sizes and see the difference in diameter, circumference and estimated speedometer reading." },
  { slug: "tyre-lifespan", title: "How Long Should Tyres Last?", excerpt: "What actually determines how long a tyre lasts, without relying on a single mileage figure." },
  { slug: "why-professional-mobile-tyre-services-are-essential-for-modern-drivers", title: "Why Professional Mobile Tyre Services Matter", excerpt: "Why professional tyre fitting and inspection matters for safety, not just convenience." },
  { slug: "locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk", title: "Locking Wheel Nut Removal: Industry Practice And Wheel Damage Risk", excerpt: "What professional locking wheel nut removal actually involves, and what's worth asking before work begins." },
  { slug: "what-mobile-fitters-check-before-changing-a-tyre-on-a-hill", title: "Changing A Tyre On A Slope: Why We Check First", excerpt: "Why we won't lift a vehicle on an unsafe slope, and what we assess before starting work." },
  { slug: "how-to-extend-tyre-life-and-avoid-unexpected-roadside-breakdowns", title: "Everyday Habits That Help Your Tyres Last", excerpt: "Simple maintenance habits that help you avoid unexpected tyre problems on the road." },
  { slug: "mobile-tyre-fitting-livingston-tyre-problems", title: "Common Tyre Problems Livingston Drivers Face", excerpt: "The tyre problems we see most often in Livingston, and how to tell when it needs a proper look." },
  { slug: "tyre-blowout-causes-prevention", title: "Tyre Blowouts: Causes, Prevention And What To Do", excerpt: "What causes a tyre blowout, how to reduce the risk, and the safest way to respond if one happens." },
  { slug: "preparing-your-car-tyres-for-winter-driving-in-livingston", title: "Preparing Your Tyres For Winter Driving In Livingston", excerpt: "A pre-winter tyre checklist for Livingston drivers, and what to do if you're caught out." },
  { slug: "how-to-choose-the-best-tyres-for-my-car-expert-buying-guide", title: "How To Choose The Right Tyres For Your Car", excerpt: "Understanding tyre size, load index, speed rating, seasonal options and the tyre label." },
  { slug: "premium-or-budget-which-tyres-keep-you-safer", title: "Premium Or Budget Tyres: How To Compare Them Safely", excerpt: "Price alone doesn't tell you which tyre is safer — how to actually compare them." },
  { slug: "puncture-repairs-whats-actually-being-done-to-your-tyre", title: "Puncture Repairs: What's Actually Involved", excerpt: "Why a proper repair means taking the tyre off the wheel, and why not every puncture can be safely repaired." },
  { slug: "mobile-tyre-fitter-near-me-myths", title: "Mobile Tyre Fitting Myths, Answered", excerpt: "Common myths about mobile tyre fitting — cost, quality, speed and more — addressed factually." },
  { slug: "michelin-radial-tire-history-innovation", title: "Michelin's Radial Tyre: A Brief History", excerpt: "How Michelin's 1946 radial tyre patent changed tyre construction." },
  { slug: "pirelli-silent-tyres-uk", title: "Pirelli PNCS: What The Noise-Reduction Technology Actually Does", excerpt: "What Pirelli's PNCS technology is, and the noise reduction Pirelli reports." },
  { slug: "tyre-care-and-flat-tyre-help-in-linlithgow", title: "Tyre Care And Flat Tyre Help In Linlithgow", excerpt: "Looking after your tyres on Linlithgow's roads, and what to do safely if you get a flat." },
  { slug: "tyres-bathgate-technical-breakdown", title: "Reading Your Tyre's Sidewall: A Bathgate Guide", excerpt: "How to read a tyre size marking, what load and speed ratings mean, and the checks worth doing." },
  { slug: "why-tyres-fail-mobile-tyre-fitter-falkirk", title: "Why Tyres Fail: Common Causes Explained", excerpt: "The most common reasons tyres fail, and how to spot the early signs." },
  { slug: "which-is-the-best-mobile-tyre-fitting-service-provider-in-the-uk", title: "What To Look For When Choosing A Mobile Tyre Fitting Service", excerpt: "A practical checklist for assessing any mobile tyre fitting provider." },
  { slug: "how-much-does-mobile-tyre-fitting-cost", title: "What Affects The Cost Of Mobile Tyre Fitting", excerpt: "What actually determines the cost of a mobile tyre fitting callout, explained without invented prices." },
];
const BLOG_ARTICLE_ENTRIES = OTHER_ARTICLES.map(
  (a) => `      <article class="sfr-bloglist__item">
        <span class="sfr-bloglist__date">Blog post</span>
        <h2 class="sfr-bloglist__title"><a href="/${a.slug}/">${a.title}</a></h2>
        <p class="sfr-bloglist__excerpt">${a.excerpt}</p>
        <a class="sfr-bloglist__link" href="/${a.slug}/">Read more &rarr;</a>
      </article>`
).join("\n");

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
${BLOG_ARTICLE_ENTRIES}
    </div>
    <p style="margin-top:28px;font-size:13.5px;color:var(--sfr-sub);">Looking for something specific? <a href="/contact-us/" style="color:var(--sfr-orange);">get in touch</a>.</p>
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
