#!/usr/bin/env node
// Phase 3B: recreates the informational/guide content discovered on the
// live site during URL-inventory verification, each at its EXACT original
// root-level slug (matching Task 1's exact-URL preference — these need no
// redirect at all once recreated here). Two "Top 7"/"best" listicles about
// locking wheel nut removal are deliberately consolidated into one piece
// (see infra/redirects.json) rather than recreated as three near-duplicate
// articles — that would just be doorway-page cannibalization under a new
// name.
//
// Content here is freshly written from the page's known title/topic, not
// scraped — this session never had read access to the live page bodies
// (egress to sfrmotors.co.uk is blocked in this environment), only titles
// via search-index sampling. Generic industry knowledge (tyre safety,
// tread depth, how mobile fitting works) is stated as generic; nothing
// claims to be a specific, unverified fact about SFR Motors' own
// equipment, stock or pricing.
//
// Phase 3B correction: also recreates two further live URLs found during
// the follow-up verification pass (external search, since egress to
// sfrmotors.co.uk is blocked here) that the first Phase 3B pass missed
// entirely — /emergency-tyre-replacement/ and
// /the-best-tyres-for-your-ford-on-edinburghs-roads/. Same rule as above:
// freshly written from the known title/topic, no scraped content, no
// invented prices, qualifications, response times or stats.
//
// Run once: `node scripts/gen-articles.js`.

"use strict";

const fs = require("fs");
const path = require("path");
const { shell, DOMAIN } = require("./lib/page-shell.js");

const SITE_DIR = path.join(__dirname, "..", "site");

function article({ eyebrow = "Blog", title, byline = "By SFR Motors Ltd", bodyHtml }) {
  return `<section class="sfr-legal" aria-labelledby="sfr-legal-h1">
  <div class="sfr-legal__inner">
    <div class="sfr-legal__eyebrow">${eyebrow}</div>
    <h1 class="sfr-legal__title" id="sfr-legal-h1">${title}</h1>
    <p class="sfr-legal__updated">${byline}</p>
    <div class="sfr-legal__body">
${bodyHtml}
    </div>
  </div>
</section>`;
}

function articleSchema(slug, headline) {
  return `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${headline}",
  "author": { "@type": "Organization", "name": "SFR Motors Ltd" },
  "publisher": {
    "@type": "Organization",
    "name": "SFR Motors Ltd",
    "logo": { "@type": "ImageObject", "url": "https://sfrmotors.co.uk/assets/img/logo.jpg" }
  },
  "mainEntityOfPage": "${DOMAIN}/${slug}/",
  "image": "https://sfrmotors.co.uk/assets/img/og-image.jpg"
}
</script>`;
}

function faqSchema(qas) {
  return `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
${qas.map((qa) => `    {
      "@type": "Question",
      "name": "${qa.q}",
      "acceptedAnswer": { "@type": "Answer", "text": "${qa.a}" }
    }`).join(",\n")}
  ]
}
</script>`;
}

function faqHtml(qas, groupName, headingId, faqTitle) {
  return `
<section class="sfr-faq" aria-labelledby="${headingId}">
  <div class="sfr-faq__inner">
    <div class="sfr-faq__head">
      <div class="sfr-faq__eyebrow">FAQs</div>
      <h2 class="sfr-faq__title" id="${headingId}">${faqTitle}</h2>
    </div>

    <div class="sfr-faq__list">
${qas.map((qa) => `
      <details class="sfr-faq__item" name="${groupName}">
        <summary class="sfr-faq__summary">
          <span class="sfr-faq__q">${qa.q}</span>
          <span class="sfr-faq__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
        </summary>
        <div class="sfr-faq__panel"><div class="sfr-faq__panel-inner">
          <p>${qa.a}</p>
        </div></div>
      </details>`).join("\n")}
    </div>
  </div>
</section>`;
}

const pages = [
  {
    slug: "mobile-tyre-fitting-guide",
    title: "Mobile Tyre Fitting Edinburgh: A Complete Guide | SFR Motors Ltd",
    metaDescription: "What mobile tyre fitting is, how booking works, and when it's the right choice over a garage visit — a complete guide for Edinburgh drivers.",
    breadcrumbLabel: "Blog",
    headline: "Mobile Tyre Fitting Edinburgh: A Complete Guide",
    bodyHtml: `      <p>If you've never used a mobile tyre fitter before, it's a simpler process than most people expect. Here's what actually happens, from booking to drive-away.</p>

      <h2>What mobile tyre fitting is</h2>
      <p>Instead of driving to a garage and waiting for a bay, a mobile tyre fitter brings the equipment to you — your home, workplace, or wherever your vehicle is safely parked. New tyres, replacements, punctures and locking wheel nut issues can all typically be handled on-site.</p>

      <h2>How booking works</h2>
      <p>You get in touch — by phone, WhatsApp, or an online quote form — with your vehicle details, tyre size (or registration), and location. A price is confirmed before anyone sets off, and you're given a realistic arrival window.</p>

      <h2>What to expect on the day</h2>
      <p>A fitter arrives with a fully equipped van, assesses the tyre, and carries out the work at your location. For a straightforward replacement or repair, this is usually quicker than the round trip to a garage would have been.</p>

      <h2>When mobile fitting is the right call</h2>
      <p>It's a strong fit for punctures, worn tyres found at inconvenient times, and situations where getting to a garage isn't practical. If the vehicle has a fault beyond the tyre itself, a garage or recovery service may still be the better option.</p>

      <h2>Mobile tyre fitting in Edinburgh</h2>
      <p>We cover Edinburgh and the surrounding area 24/7 — see our <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh coverage page</a> for details, or our <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> for what's included wherever you're based. New to the idea entirely? See our <a href="/what-is-mobile-tyre-fitting/">plain-English guide to what mobile tyre fitting actually is</a>.</p>`,
  },
  {
    slug: "tyres-bathgate-guide",
    title: "Choosing The Right Van Tyres: A Bathgate Guide | SFR Motors Ltd",
    metaDescription: "How to tell when van tyres need replacing, and what to check when choosing new ones — a guide for Bathgate and West Lothian drivers.",
    breadcrumbLabel: "Blog",
    headline: "Choosing The Right Van Tyres: A Bathgate Guide",
    bodyHtml: `      <p>Van tyres work harder than car tyres — more load, more miles, less forgiveness when they're wrong. Here's what to check.</p>

      <h2>Signs it's time to replace</h2>
      <ul>
        <li><strong>Tread depth below 1.6mm</strong> — the UK legal minimum, checked across the central three-quarters of the tyre.</li>
        <li><strong>Uneven wear</strong> — often a sign of misalignment or incorrect pressure, worth investigating rather than just replacing.</li>
        <li><strong>Cracks or bulges</strong> — a genuine safety risk, and not something to wait on.</li>
        <li><strong>Vibration while driving</strong> — can point to a tyre or balancing issue.</li>
      </ul>

      <h2>Getting the size and rating right</h2>
      <p>Van tyres carry load and speed ratings specific to the vehicle — fitting the wrong spec isn't just a performance issue, it can be a legal and safety one. Your vehicle's handbook or the plate on the driver's door pillar will have the correct spec; if in doubt, quote us your registration and we'll confirm before fitting anything.</p>

      <h2>Single tyre or a full set?</h2>
      <p>A single worn tyre can usually be replaced on its own, but mismatched tread across an axle isn't ideal for handling — we'll give you an honest recommendation rather than upselling a set you don't need.</p>

      <h2>Getting it done without downtime</h2>
      <p>For a trade vehicle, a garage visit means the van is off the road. Mobile fitting at your depot, home or job site avoids that. See our <a href="/van-tyre-replacement-services/">van tyre replacement service</a> for details, or get in touch for a price.</p>`,
  },
  {
    slug: "mobile-tyre-fitting-vs-recovery-whats-best-for-your-situation",
    title: "Mobile Tyre Fitting vs Recovery: What's Best For Your Situation? | SFR Motors Ltd",
    metaDescription: "A flat tyre isn't always a recovery job. Here's how to tell whether you need a mobile tyre fitter or a breakdown recovery service.",
    breadcrumbLabel: "Blog",
    headline: "Mobile Tyre Fitting vs Recovery: What's Best For Your Situation?",
    bodyHtml: `      <p>Stranded with a tyre problem, it's not always obvious whether to call a mobile tyre fitter or a recovery service. The difference comes down to what's actually wrong.</p>

      <h2>When a mobile tyre fitter is the right call</h2>
      <p>If the problem is genuinely just the tyre — a puncture, a blowout, a locked wheel nut, or tread worn past the legal limit — a mobile fitter can usually resolve it on the spot, at your location, without the vehicle needing to move again until it's done.</p>

      <h2>When recovery is the better option</h2>
      <p>If there's a mechanical fault beyond the tyre — a suspension issue, an accident, or something that means the vehicle isn't safe or driveable even with a good tyre fitted — recovery to a garage is the right call, not a tyre fitter.</p>

      <h2>Not sure which you need?</h2>
      <p>Tell us what's happened when you get in touch. If it sounds like something beyond a tyre issue, we'll say so honestly rather than attending a job we can't actually resolve.</p>

      <h2>24/7 either way</h2>
      <p>For genuine tyre emergencies, our <a href="/24-7-mobile-tyre-replacement/">24/7 mobile tyre replacement service</a> covers Bathgate, Edinburgh, West Lothian and the surrounding area.</p>`,
  },
  {
    slug: "mobile-tyre-repair-edinburgh-west-lothian",
    title: "Mobile Tyre Repair In Edinburgh & West Lothian: What To Look For | SFR Motors Ltd",
    metaDescription: "What makes a mobile tyre repair service reliable — arrival times, repair standards and honest pricing — for drivers in Edinburgh and West Lothian.",
    breadcrumbLabel: "Blog",
    headline: "Mobile Tyre Repair In Edinburgh &amp; West Lothian: What To Look For",
    bodyHtml: `      <p>Not every puncture repair service is the same. Here's what's worth checking before you book one.</p>

      <h2>Honest arrival estimates</h2>
      <p>Traffic and distance genuinely affect arrival time — a service that gives a realistic window rather than a blanket promise is being straight with you.</p>

      <h2>Proper repair standards</h2>
      <p>Not every puncture can be safely repaired. A sidewall puncture, for example, generally can't be — it needs replacing, not patching. A reliable fitter will tell you that rather than repair something that shouldn't be.</p>

      <h2>Transparent pricing</h2>
      <p>A price confirmed before work starts, with no surprise add-ons on arrival, is what you should expect.</p>

      <h2>Qualified, insured fitters</h2>
      <p>Mobile tyre work still needs to be done to the same standard as a garage — proper tools, correct torque settings, and a fitter who knows what they're doing.</p>

      <h2>Our coverage</h2>
      <p>We cover <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh</a> and <a href="/mobile-tyre-fitting-west-lothian/">West Lothian</a> 24/7 — see our <a href="/mobile-tyre-puncture-repair/">puncture repair service</a> for what's included.</p>`,
  },
  {
    slug: "tyre-puncture-repair-near-me-west-lothian",
    title: "Finding Reliable Puncture Repair Near You In West Lothian | SFR Motors Ltd",
    metaDescription: "What to check before booking a 'puncture repair near me' search result — and how mobile puncture repair works across West Lothian.",
    breadcrumbLabel: "Blog",
    headline: "Finding Reliable Puncture Repair Near You In West Lothian",
    bodyHtml: `      <p>Searching "puncture repair near me" throws up a lot of options. Here's what actually matters when you're choosing one.</p>

      <h2>Repairable or not?</h2>
      <p>A genuine assessment on-site — not a guess over the phone — tells you whether the puncture can be safely repaired or whether the tyre needs replacing. Anyone offering a firm answer before seeing the tyre is guessing.</p>

      <h2>How quickly they can actually reach you</h2>
      <p>"Near me" only helps if the response time is honest. We'll confirm a realistic arrival window for your specific West Lothian location when you get in touch, rather than a generic promise.</p>

      <h2>What's included in the price</h2>
      <p>Ask whether the quoted price covers the assessment and the repair itself, or whether there's a separate call-out charge — it should be clear before anyone sets off.</p>

      <h2>Getting a puncture fixed in West Lothian</h2>
      <p>We cover Bathgate and the wider <a href="/mobile-tyre-fitting-west-lothian/">West Lothian area</a> 24/7 — see our <a href="/mobile-tyre-puncture-repair/">puncture repair service</a> or get in touch with your location for a price.</p>`,
  },
  {
    slug: "best-mobile-tyre-fitters-bathgate",
    title: "What Makes A Trustworthy Mobile Tyre Fitter In Bathgate | SFR Motors Ltd",
    metaDescription: "What to look for when choosing a mobile tyre fitter in Bathgate — response times, pricing, and how the work is actually carried out.",
    breadcrumbLabel: "Blog",
    headline: "What Makes A Trustworthy Mobile Tyre Fitter In Bathgate",
    bodyHtml: `      <p>Rather than a ranked list of names, here's what's actually worth checking when you're picking a mobile tyre fitter in Bathgate.</p>

      <h2>Reviews you can verify</h2>
      <p>Genuine Google reviews, tied to a real business profile, are worth far more than star ratings you can't trace back to anything.</p>

      <h2>A price before the work starts</h2>
      <p>You should know what you're paying before the fitter arrives, not be told a different number once they're on-site.</p>

      <h2>Honesty about what's needed</h2>
      <p>A trustworthy fitter tells you when a repair is possible instead of automatically selling a replacement, and says so plainly if a job is beyond a straightforward tyre fix.</p>

      <h2>Real coverage, not a stretched radius</h2>
      <p>Some services list huge coverage areas but take much longer to actually reach the edges of them. A fitter based locally to Bathgate, like we are, tends to have more realistic arrival times for local jobs.</p>

      <h2>Get a quote</h2>
      <p>See our <a href="/mobile-tyre-fitting-bathgate/">Bathgate coverage page</a> for what we offer, or get in touch for a price. For the same checklist applied more broadly, see our guide on <a href="/which-is-the-best-mobile-tyre-fitting-service-provider-in-the-uk/">what to look for when choosing a mobile tyre fitting service</a>.</p>`,
  },
  {
    slug: "tyre-fitting-edinburgh-expert-technical-aspects-you-must-know",
    title: "Tyre Fitting In Edinburgh: Technical Aspects You Must Know | SFR Motors Ltd",
    metaDescription: "Load ratings, torque settings, balancing and TPMS resets — the technical side of a proper tyre fitting job, explained for Edinburgh drivers.",
    breadcrumbLabel: "Blog",
    headline: "Tyre Fitting In Edinburgh: Technical Aspects You Must Know",
    bodyHtml: `      <p>A tyre fitting job is more than bolting on a new tyre. Here's what should actually happen for it to be done properly.</p>

      <p>If you're curious where modern tyre construction itself comes from, see our brief guide on <a href="/michelin-radial-tire-history-innovation/">Michelin's radial tyre history</a>.</p>

      <h2>Load and speed ratings</h2>
      <p>Every tyre carries a load index and speed rating matched to the vehicle. Fitting a tyre below the manufacturer's rating isn't just underperformance — it's a genuine safety issue.</p>

      <h2>Correct torque on the wheel nuts</h2>
      <p>Wheel nuts need tightening to the vehicle manufacturer's specified torque — not just "tight," and not over-tightened either, which can damage the wheel or studs.</p>

      <h2>Wheel balancing</h2>
      <p>An unbalanced wheel causes vibration and uneven wear over time. A proper fitting includes balancing, not just mounting the tyre.</p>

      <h2>TPMS resets</h2>
      <p>Many vehicles need their tyre pressure monitoring system reset or recalibrated after a tyre change — skipping this can leave a false warning light on afterwards. See our <a href="/tyre-pressure-monitoring-system/">TPMS page</a> for more.</p>

      <h2>Getting it fitted properly in Edinburgh</h2>
      <p>All of the above is standard practice for a proper mobile fitting job — see our <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh coverage page</a> or get in touch for a quote.</p>`,
  },
  {
    slug: "better-tyres-better-drive",
    title: "Better Tyres, Better Drive: Why Tyre Condition Matters | SFR Motors Ltd",
    metaDescription: "How tyre condition affects safety, fuel efficiency and handling — and when it's time to replace, for Edinburgh and West Lothian drivers.",
    breadcrumbLabel: "Blog",
    headline: "Better Tyres, Better Drive: Why Tyre Condition Matters",
    bodyHtml: `      <p>Tyres are the only part of the car actually touching the road — their condition affects almost everything about how a vehicle handles.</p>

      <h2>Stopping distance</h2>
      <p>Worn tread significantly increases stopping distance, especially in wet weather — a tyre near the legal minimum performs noticeably worse than a fresh one.</p>

      <h2>Fuel efficiency</h2>
      <p>Under-inflated or badly worn tyres increase rolling resistance, which means the engine works harder and uses more fuel.</p>

      <h2>Handling and control</h2>
      <p>Even tread and correct pressure keep the car predictable in corners and in poor weather — uneven wear undermines that even if the tread depth looks fine at a glance.</p>

      <h2>When to replace</h2>
      <p>Tread depth below 1.6mm, visible cracking or bulging, or noticeable vibration are all signs it's time — see our <a href="/mobile-tyre-replacement/">tyre replacement service</a> or <a href="/our-tyre-range/">tyre range</a> for options. For a fuller look at what determines how long a tyre lasts, see our guide on <a href="/tyre-lifespan/">how long tyres should last</a>.</p>

      <h2>Getting it sorted in Edinburgh</h2>
      <p>We fit at your home, workplace or roadside across <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh</a> and the surrounding area — get in touch for a quote.</p>`,
  },
  {
    slug: "how-to-change-a-tyre",
    title: "How To Change A Tyre: A West Lothian Driver's Guide | SFR Motors Ltd",
    metaDescription: "A step-by-step guide to changing a flat tyre safely, and when to call a mobile tyre fitter instead — for West Lothian drivers.",
    breadcrumbLabel: "Blog",
    headline: "How To Change A Tyre: A West Lothian Driver's Guide",
    bodyHtml: `      <p>Knowing how to change a tyre safely is a genuinely useful skill — but it's not always the right call. Here's both sides.</p>

      <h2>Before you start</h2>
      <p>Pull over somewhere flat and well away from traffic, put the hazard lights on, and apply the handbrake. If you're on a motorway hard shoulder or somewhere that doesn't feel safe to work, it's better to call for help than attempt the change there.</p>

      <h2>The basic steps</h2>
      <ol>
        <li>Loosen the wheel nuts slightly before jacking the car up (much harder once the wheel is off the ground).</li>
        <li>Jack the car up at the correct jacking point — check your handbook.</li>
        <li>Remove the wheel nuts fully and take off the flat tyre.</li>
        <li>Fit the spare, hand-tighten the nuts, then lower the car.</li>
        <li>Fully tighten the nuts in a star pattern once the car is back on the ground.</li>
      </ol>

      <h2>Afterwards</h2>
      <p>A space-saver spare usually has a speed and distance limit — check your handbook, and get the original tyre repaired or replaced properly as soon as you reasonably can.</p>

      <h2>When to call a mobile fitter instead</h2>
      <p>No spare, a locked wheel nut with no key, an unsafe location, or simply not wanting to do it yourself — any of these are good reasons to call us instead. See our <a href="/24-7-mobile-tyre-replacement/">24/7 mobile tyre replacement service</a> covering West Lothian 24/7.</p>`,
  },
  {
    slug: "locking-wheel-nut-removal",
    title: "Locking Wheel Nut Removal: Your Options Explained | SFR Motors Ltd",
    metaDescription: "Lost your locking wheel nut key? Here's how locking wheel nut removal actually works, and what to expect from a mobile callout.",
    breadcrumbLabel: "Blog",
    headline: "Locking Wheel Nut Removal: Your Options Explained",
    bodyHtml: `      <p>A locking wheel nut with a missing key can stop a straightforward tyre job dead. Here's what your options actually are.</p>

      <h2>Why locking wheel nuts exist</h2>
      <p>They're a theft deterrent — each one needs a matching key (a unique adaptor) to remove, which is exactly what makes it a problem when that key goes missing.</p>

      <h2>Specialist removal tools</h2>
      <p>Where the key genuinely can't be found, a specialist removal tool can extract the locking nut without the original key — done properly, this shouldn't damage the wheel.</p>

      <h2>Protecting your alloys</h2>
      <p>This is where experience matters — the wrong technique can damage an alloy wheel. It's worth confirming with whoever you book that damage-free removal is something they actually do regularly, not just occasionally.</p>

      <h2>After removal</h2>
      <p>Once the locking nut is off, you'll usually want a replacement set (with a fresh key kept somewhere memorable) rather than leaving the wheel without one.</p>

      <h2>Getting it done</h2>
      <p>We offer mobile locking wheel nut removal across Bathgate and West Lothian, 24/7 — see our <a href="/mobile-locking-wheel-nut-removal/">locking wheel nut removal service</a> for details. For more on how professional removal actually works and the wheel-damage risk involved, see our <a href="/locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk/">industry practice guide</a>.</p>`,
  },
  {
    slug: "emergency-tyre-replacement",
    title: "Emergency Tyre Replacement vs Garage Tyre Fitting | SFR Motors Ltd",
    metaDescription: "What actually counts as a tyre emergency, and how emergency mobile tyre replacement compares to booking in at a garage.",
    breadcrumbLabel: "Blog",
    headline: "Emergency Tyre Replacement vs Garage Tyre Fitting",
    bodyHtml: `      <p>Not every flat tyre is an emergency, and not every emergency needs the same response. Here's how to tell the difference, and what each option actually involves.</p>

      <h2>What counts as a tyre emergency</h2>
      <p>A blowout, a tyre too damaged to drive on, or a puncture that's left you stranded somewhere unsafe are genuine emergencies — the vehicle can't reasonably move again until the tyre is dealt with. A tyre that's simply worn or due for replacement soon isn't, even if it needs sorting.</p>

      <h2>Why mobile replacement suits a real emergency</h2>
      <p>If the car isn't safe to drive, it shouldn't be driven — including to a garage. Emergency mobile tyre replacement comes to wherever the vehicle actually is, whether that's home, work, or the roadside, so the tyre is dealt with without the vehicle needing to move on a damaged wheel first.</p>

      <h2>When a garage visit is still the better choice</h2>
      <p>If the tyre isn't urgent — you've noticed wear during a routine check, or you want to compare tyre brands and options in person — booking in at a garage on your own schedule is perfectly reasonable. There's no need to treat a non-urgent replacement as an emergency.</p>

      <h2>What to have ready when you call</h2>
      <p>Your location, vehicle registration or tyre size, and a description of what's happened all help us assess the job before anyone sets off, and confirm a price up front.</p>

      <h2>Emergency cover across our area</h2>
      <p>Our <a href="/24-7-mobile-tyre-replacement/">24/7 mobile tyre replacement service</a> covers Bathgate, <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh</a>, <a href="/mobile-tyre-fitting-falkirk/">Falkirk</a> and the surrounding area, 24/7.</p>`,
  },
  {
    slug: "the-best-tyres-for-your-ford-on-edinburghs-roads",
    title: "The Best Tyres For Your Ford On Edinburgh's Roads | SFR Motors Ltd",
    metaDescription: "What to weigh up when choosing tyres for a Ford in Edinburgh — from city-run Fiestas to Transit vans — and how road conditions factor in.",
    breadcrumbLabel: "Blog",
    headline: "The Best Tyres For Your Ford On Edinburgh's Roads",
    bodyHtml: `      <p>Ford covers a lot of ground — a Fiesta doing the school run is a very different proposition to a Transit on a full working day. What suits one doesn't automatically suit the other.</p>

      <h2>Match the tyre to the vehicle, not just the brand</h2>
      <p>The right tyre depends on your specific model's load and speed rating, not on "Ford" as a brand — a Fiesta, Focus, Kuga and Transit all call for different specs. Your vehicle's handbook or the plate on the driver's door pillar has the correct rating; we'll confirm it against your registration before fitting anything.</p>

      <h2>Edinburgh's roads are a mixed test</h2>
      <p>Cobbled and uneven stretches in the city centre, pothole-prone routes on the outskirts, and wet weather for a good part of the year all put tyres under different kinds of strain — good grip and sidewall condition matter as much as tread depth.</p>

      <h2>Wear patterns worth checking</h2>
      <p>Uneven wear across the front tyres is common on front-wheel-drive Fords doing a lot of urban stop-start driving, and is often a sign it's worth checking alignment and pressure rather than just replacing the tyre. If in doubt, ask us to take a look before you buy a replacement.</p>

      <h2>Vans and load-carrying Fords</h2>
      <p>A Transit or Transit Custom carrying regular loads needs tyres rated for that weight — see our <a href="/van-tyre-replacement-services/">van tyre replacement service</a> for what's involved.</p>

      <h2>Getting fitted in Edinburgh</h2>
      <p>See our <a href="/our-tyre-range/">tyre range</a> for what we carry, or our <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh coverage page</a> — get in touch with your registration for a price.</p>`,
  },
  // ---------------------------------------------------------------- Phase 4B Batch B1
  {
    slug: "11-benefits-of-emergency-mobile-tyre-fitting",
    title: "11 Benefits of Emergency Mobile Tyre Fitting | SFR Motors Ltd",
    metaDescription: "Eleven practical reasons calling a mobile tyre fitter beats driving on a damaged tyre or waiting for recovery, for drivers across West Lothian.",
    breadcrumbLabel: "Blog",
    headline: "11 Benefits of Emergency Mobile Tyre Fitting",
    bodyHtml: `      <p>Not every flat tyre calls for the same response, but when it's a genuine emergency, calling a mobile fitter has real advantages over the alternatives. Here's why.</p>

      <h2>1. You're not left driving on a damaged tyre</h2>
      <p>A mobile fitter comes to wherever the vehicle is, so there's no need to nurse a damaged tyre to a garage first.</p>

      <h2>2. No separate recovery or towing to arrange</h2>
      <p>If the tyre itself is the only problem, a mobile fitter can often resolve it on the spot — without a tow truck being called at all.</p>

      <h2>3. It works wherever you actually are</h2>
      <p>Home, work, a car park, or the roadside — the fitter comes to the vehicle rather than the other way round.</p>

      <h2>4. One less thing to arrange during a stressful moment</h2>
      <p>A tyre emergency is disruptive enough without also having to sort out how to get the vehicle somewhere. Mobile fitting removes that step.</p>

      <h2>5. A proper assessment on the spot</h2>
      <p>Rather than guessing whether a tyre is safe to continue on, a fitter can physically inspect it where it is and explain what's actually needed.</p>

      <h2>6. Suitable for a wide range of vehicles</h2>
      <p>Cars, vans and 4x4s can typically all be dealt with by a properly equipped mobile fitter, without needing a specific garage.</p>

      <h2>7. Minimal disruption to your day</h2>
      <p>The vehicle doesn't need to leave where it's parked, so whatever you were doing — working, at home, running errands — is interrupted as little as possible.</p>

      <h2>8. No queuing at a garage</h2>
      <p>There's no waiting room and no queue behind other customers' cars — the fitter deals with your vehicle directly.</p>

      <h2>9. Related issues can be picked up at the same time</h2>
      <p>If something else is found during the callout — a stuck locking wheel nut, for example — it's often possible to deal with it in the same visit rather than booking a second one.</p>

      <h2>10. Less time spent in a vulnerable position</h2>
      <p>Whether that's a roadside verge or a car park after dark, resolving the tyre issue where you are reduces the time spent waiting in a less-than-ideal spot.</p>

      <h2>11. Straightforward to get started</h2>
      <p>Your location and some basic details about the vehicle and the tyre are usually all that's needed to get things moving.</p>

      <h2>Get in touch</h2>
      <p>SFR Motors Ltd operates 24 hours a day across Bathgate, Edinburgh and West Lothian. See our <a href="/24-7-mobile-tyre-replacement/">24/7 mobile tyre replacement service</a> for more, or call us directly.</p>`,
  },
  {
    slug: "7-warning-signs-your-tyres-need-immediate-professional-attention",
    title: "7 Warning Signs Your Tyres Need Immediate Professional Attention | SFR Motors Ltd",
    metaDescription: "Seven tyre warning signs worth acting on, and why only a physical inspection can confirm whether your tyre needs repair or replacement.",
    breadcrumbLabel: "Blog",
    headline: "7 Warning Signs Your Tyres Need Immediate Professional Attention",
    bodyHtml: `      <p>Tyres don't usually fail without warning. Catching these signs early can be the difference between a straightforward repair and being caught out somewhere inconvenient.</p>

      <h2>1. Losing pressure repeatedly</h2>
      <p>A tyre that keeps needing air, even after topping up, can point to a slow puncture, a valve issue, or damage to the wheel itself — worth having checked before it becomes a sudden flat.</p>

      <h2>2. Visible cracks or bulges</h2>
      <p>Cracking or a bulge in the sidewall usually means the tyre's internal structure has been compromised. It's worth having looked at promptly rather than waiting to see if it gets worse.</p>

      <h2>3. Uneven tread wear</h2>
      <p>Wear that's heavier on one side, or patchy across the tyre, often points to an alignment, suspension or pressure issue rather than the tyre itself — and can affect how the vehicle handles.</p>

      <h2>4. Vibration while driving</h2>
      <p>A vibration through the steering wheel or seat can have several causes, from wheel balance to internal tyre damage. It's not something to ignore, even if it seems minor.</p>

      <h2>5. Reduced grip in wet weather</h2>
      <p>If the car feels less planted on wet roads than it used to, worn tread is one possible cause — and it directly affects stopping distance.</p>

      <h2>6. A visible object in the tread</h2>
      <p>A nail, screw or piece of debris lodged in the tyre doesn't always cause an immediate flat. Whether it's safe to leave in place, remove, or repair around depends on where it is and how deep it's gone — not something to judge by eye alone.</p>

      <h2>7. Tyres showing their age</h2>
      <p>Cracking or a slightly perished look to the rubber, even on a tyre with reasonable tread left, can be a sign it's due a closer look.</p>

      <h2>What to do next</h2>
      <p>None of the above tells you for certain whether a tyre needs a repair, a replacement, or nothing at all — that depends on the specific tyre, and we're not able to say from a description alone. A physical, on-site inspection is the only way to know for sure. If you notice any of these signs, it's best to stop in a safe location and get it looked at before continuing your journey.</p>

      <p>See our <a href="/mobile-tyre-puncture-repair/">mobile puncture repair service</a> for suitable repairs, or our <a href="/24-7-mobile-tyre-replacement/">24/7 mobile tyre replacement service</a> if the tyre needs replacing.</p>`,
    faq: [
      { q: "Does noticing one of these signs always mean I need a new tyre?", a: "Not necessarily — some of these signs point to a repairable issue, and others don't need any work at all once inspected. Only a physical inspection can confirm which applies to your tyre." },
      { q: "Is it safe to keep driving if I notice one of these signs?", a: "We can't tell you that from a description alone. If you notice any of the signs above, the safest approach is to stop in a safe location and have the tyre looked at before continuing your journey." },
    ],
    faqTitle: "Tyre Warning Sign Questions",
    faqGroup: "sfr-7ws-faq",
  },
  {
    slug: "emergency-wheel-nut-removal-what-to-do-if-youve-lost-the-key",
    title: "Emergency Wheel Nut Removal: What To Do If You've Lost The Key | SFR Motors Ltd",
    metaDescription: "Lost your locking wheel nut key? What to do next, why forcing it off yourself risks damage, and when professional removal is the safer option.",
    breadcrumbLabel: "Blog",
    headline: "Emergency Wheel Nut Removal: What To Do If You've Lost The Key",
    bodyHtml: `      <p>A locking wheel nut with no key to hand can bring an otherwise simple tyre job to a stop. Here's what's actually worth doing about it.</p>

      <h2>Why locking wheel nuts exist</h2>
      <p>They're a theft deterrent fitted to alloy wheels — each one needs a matching key, a unique adaptor shaped to fit that nut, to come off. Without it, the nut is designed to resist being removed.</p>

      <h2>Why keys go missing</h2>
      <p>It happens more often than you'd think — left in a previous car, lost during a house move, or simply never handed over by a previous owner. It's a common problem, not an unusual one.</p>

      <h2>Why forcing it isn't the answer</h2>
      <p>Using pliers, a hammer, or other makeshift tools to try to remove a locking nut without its key risks rounding off the nut, damaging the alloy wheel, or snapping a wheel stud — turning a straightforward job into a more expensive one. It's not something we'd recommend attempting yourself.</p>

      <h2>How professional removal works</h2>
      <p>A specialist extraction tool, matched to the size and pattern of the nut, is used to remove it without relying on the original key. Done properly, this shouldn't damage the wheel. Whether a particular nut can be removed this way, and how straightforward it will be, depends on the nut itself — something a fitter can only confirm once they've actually seen it.</p>

      <h2>When to get in touch</h2>
      <p>If you can't find your key and need a wheel off — whether that's for a flat tyre, a tyre rotation, or anything else — it's worth arranging professional removal rather than working around the problem yourself.</p>

      <h2>Avoiding it next time</h2>
      <p>Once a new key is issued, keeping it somewhere memorable (rather than loose in the boot) and noting down any code the manufacturer provides can save the same hassle in future.</p>

      <p>See our <a href="/mobile-locking-wheel-nut-removal/">mobile locking wheel nut removal service</a> for details, or get in touch.</p>`,
    faq: [
      { q: "Can I remove a locking wheel nut myself without the key?", a: "We wouldn't recommend it. Forcing the nut with pliers, a hammer or similar tools risks damaging the wheel, the stud or the locking mechanism itself. Specialist extraction tools are designed to remove it without that risk." },
      { q: "What if I can't find my key anywhere?", a: "That's a common situation, not an unusual one. Get in touch and we can talk through removal using specialist tools that don't depend on the original key." },
    ],
    faqTitle: "Locking Wheel Nut Removal Questions",
    faqGroup: "sfr-ewn-faq",
  },
  {
    slug: "why-tyre-safety-is-more-important-than-most-drivers-realize",
    title: "Why Tyre Safety Is More Important Than Most Drivers Realise | SFR Motors Ltd",
    metaDescription: "Why tyre condition affects braking, grip and control more than most drivers expect — practical, non-alarmist safety advice for West Lothian drivers.",
    breadcrumbLabel: "Blog",
    headline: "Why Tyre Safety Is More Important Than Most Drivers Realise",
    bodyHtml: `      <p>Most drivers think about tyres when something's obviously wrong — a puncture, a warning light, a flat. But tyre condition affects far more of how a car behaves than that, most of the time without you noticing.</p>

      <h2>They're the only part of the car touching the road</h2>
      <p>Braking, cornering and simply keeping the car pointing where you steer it all depend on the contact between tyre and road. When that contact is compromised — by low pressure, uneven wear, or damage — every one of those is affected, not just one.</p>

      <h2>Pressure affects more than fuel economy</h2>
      <p>Under- or over-inflated tyres change how a car handles, not just how much fuel it uses. Checking pressure regularly, against the figure in your vehicle's handbook or door-sill sticker, is one of the simplest checks that actually matters.</p>

      <h2>Damage isn't always visible from the outside</h2>
      <p>Hitting a pothole or clipping a kerb can damage a tyre's internal structure without leaving an obvious mark on the outside. If a tyre has taken a hard knock, it's worth having it checked even if nothing looks wrong at a glance.</p>

      <h2>Worn tread matters most when you need it most</h2>
      <p>The difference between good and worn tread is easy to overlook in dry weather, and far more obvious — and more dangerous — the moment the road is wet. Grip and stopping distance both suffer as tread wears down.</p>

      <h2>Why regular checks are worth the two minutes</h2>
      <p>Catching a developing issue during a routine check is far less disruptive than discovering it as a flat tyre on the way somewhere. A quick visual check and a pressure check, done regularly, catch most problems before they become urgent.</p>

      <h2>If something doesn't look or feel right</h2>
      <p>Not sure whether a mark, a vibration or a pressure drop needs attention? A physical inspection is the only way to know for certain — see our <a href="/mobile-tyre-puncture-repair/">puncture repair service</a> if it turns out to be repairable, or our <a href="/mobile-tyre-replacement/">tyre replacement service</a> if a new tyre is what's needed.</p>`,
  },
  // ---------------------------------------------------------------- Phase 4B Batch B2
  {
    slug: "asymmetric-and-directional-tyres-difference",
    title: "Asymmetric vs Directional Tyres: What's The Difference? | SFR Motors Ltd",
    metaDescription: "What asymmetric and directional tread patterns actually do, how they differ, and how to tell which one is fitted to your car.",
    breadcrumbLabel: "Blog",
    headline: "Asymmetric vs Directional Tyres: What's The Difference?",
    bodyHtml: `      <p>Tread patterns aren't just decoration — they're engineered for a specific job. Two of the most common designs, asymmetric and directional, work in different ways. Here's what actually sets them apart.</p>

      <h2>What an asymmetric tyre is</h2>
      <p>An asymmetric tyre has two different tread patterns across its width — one half designed for dry grip and cornering, the other for dispersing water in wet conditions. The tyre is usually marked "Outside" and "Inside" so it's fitted the correct way round.</p>

      <h2>What a directional tyre is</h2>
      <p>A directional tyre has a tread pattern designed to rotate in one direction only, usually shaped like an arrow or a V. This channels water away from the contact patch efficiently, which is why directional patterns are common on tyres aimed at wet-weather performance.</p>

      <h2>How to tell which one you have</h2>
      <p>Both types are marked on the sidewall. An asymmetric tyre will show "Outside"/"Inside"; a directional tyre will usually show a rotation arrow. If you're not sure, check your tyre's sidewall markings or ask us when we're on-site.</p>

      <h2>Why fitting them the right way round matters</h2>
      <p>Fitting either type backwards, or on the wrong side of the car, reduces the grip and water-dispersal benefits they're designed for. It's a detail worth getting right, which is why correct fitting — not just the tyre itself — is part of the job.</p>

      <h2>Choosing between them</h2>
      <p>Neither is automatically the better choice — it depends on the vehicle, the tyre range, and what the manufacturer has designed for that specific tyre. See our <a href="/our-tyre-range/">tyre range</a> for what we carry, or get in touch with your tyre size and we'll talk through the options.</p>`,
  },
  {
    slug: "how-quality-tyres-improve-safety-and-driving-performance",
    title: "How Quality Tyres Improve Safety and Driving Performance | SFR Motors Ltd",
    metaDescription: "How tyre condition affects braking, handling and fuel efficiency — and why it's worth paying attention to, for Falkirk and West Lothian drivers.",
    breadcrumbLabel: "Blog",
    headline: "How Quality Tyres Improve Safety and Driving Performance",
    bodyHtml: `      <p>Tyres get little attention until something goes wrong, but their condition affects far more of how a car behaves day-to-day than most drivers realise.</p>

      <h2>Braking and cornering</h2>
      <p>Worn or damaged tyres reduce the amount of grip available, which affects both stopping distance and how predictably a car handles in corners — particularly in wet conditions.</p>

      <h2>Fuel efficiency</h2>
      <p>Under-inflated or worn tyres increase rolling resistance, meaning the engine works harder to maintain the same speed. Keeping tyres correctly inflated is one of the simplest ways to keep running costs down.</p>

      <h2>Spotting damage before it becomes a problem</h2>
      <p>Potholes, kerbs and road debris are common causes of tyre damage. Some of it, like a bulge or a cut, is visible; some isn't. A physical inspection is the only way to know for certain whether a tyre is still safe or needs attention.</p>

      <h2>When a repair is possible</h2>
      <p>Not every issue means a new tyre. A suitable puncture, assessed and repaired properly, can extend a tyre's working life — while damage outside safe repair guidelines means replacement is the right call. See our <a href="/mobile-tyre-puncture-repair/">puncture repair service</a> for how that assessment works.</p>

      <h2>Getting it looked at in Falkirk</h2>
      <p>We cover Falkirk and the surrounding area — see our <a href="/mobile-tyre-fitting-falkirk/">Falkirk coverage page</a> for details, or get in touch for a quote.</p>`,
  },
  {
    slug: "how-to-avoid-common-tyre-problems-and-stay-safe-on-the-road",
    title: "How To Avoid Common Tyre Problems And Stay Safe On The Road | SFR Motors Ltd",
    metaDescription: "Practical tyre maintenance habits that help you avoid common problems and stay safe — for drivers across Edinburgh and West Lothian.",
    breadcrumbLabel: "Blog",
    headline: "How To Avoid Common Tyre Problems And Stay Safe On The Road",
    bodyHtml: `      <p>Most tyre problems don't appear out of nowhere — they build up gradually, and a few consistent habits go a long way toward avoiding them.</p>

      <h2>Keep an eye on tyre pressure</h2>
      <p>Both under- and over-inflated tyres wear unevenly and affect handling. Checking pressure regularly, against the figure in your vehicle's handbook or door-sill sticker, is one of the simplest habits that actually helps.</p>

      <h2>Check for early damage</h2>
      <p>A small cut, puncture or sidewall crack might look minor, but can develop into a bigger problem if left. Regular visual checks help catch this early, before it turns into a roadside issue.</p>

      <h2>Don't ignore worn tread</h2>
      <p>Reduced tread depth affects grip, particularly in wet weather, and increases stopping distance. If tread looks low, it's worth having it checked rather than waiting to see how it performs.</p>

      <h2>Rotate tyres to even out wear</h2>
      <p>Front and rear tyres tend to wear differently depending on the vehicle, and evening this out through rotation helps them last more consistently. Ask us about this at your next visit if you're not sure when yours was last done.</p>

      <h2>Watch for locking wheel nut issues</h2>
      <p>A locking wheel nut that's seized or missing its key can turn a routine tyre job into a bigger one. If yours is giving trouble, our <a href="/mobile-locking-wheel-nut-removal/">locking wheel nut removal service</a> can help without risking damage to the wheel.</p>

      <h2>Get it looked at when something's off</h2>
      <p>Vibration, pulling to one side, or a tyre that keeps losing pressure are all worth acting on rather than waiting out. See our <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh</a> or <a href="/mobile-tyre-fitting-west-lothian/">West Lothian</a> coverage pages, or get in touch.</p>`,
  },
  {
    slug: "what-is-mobile-tyre-fitting",
    title: "What Is Mobile Tyre Fitting? | SFR Motors Ltd",
    metaDescription: "What mobile tyre fitting actually means, how it differs from a garage visit, and the kinds of jobs it typically covers.",
    breadcrumbLabel: "Blog",
    headline: "What Is Mobile Tyre Fitting?",
    bodyHtml: `      <p>"Mobile tyre fitting" is a term used a lot, but it's worth being clear about what it actually means — and how it's different from booking in at a garage.</p>

      <h2>The basic idea</h2>
      <p>Instead of driving to a garage and waiting for a bay, a mobile tyre fitter brings a fully equipped van to wherever your vehicle is — your home, workplace, or the roadside — and carries out the work there. No drop-off, no waiting room.</p>

      <h2>How it differs from a garage visit</h2>
      <p>A garage needs you to bring the vehicle to a fixed location and wait, or arrange to come back later. Mobile fitting reverses that — the equipment and the fitter come to you, so the vehicle doesn't need to move on a damaged tyre, and your day isn't built around a garage appointment.</p>

      <h2>What it typically covers</h2>
      <p>Most mobile tyre fitters handle new tyre fitting, punctures, and locking wheel nut issues, and many also carry out basic checks like tyre pressure and wheel balancing while they're there. What's included can vary between providers, so it's worth confirming before booking.</p>

      <h2>Who it suits</h2>
      <p>It's a strong fit when getting to a garage isn't practical — a flat discovered at home before work, a puncture in a car park, or simply not wanting to lose half a day to a waiting room. If the vehicle has a fault beyond the tyre itself, a garage or recovery service may still be the better option.</p>

      <h2>What to expect from a provider</h2>
      <p>A proper mobile tyre fitter should confirm a price before starting work, carry out any fitting to the same standard as a garage — including balancing and torquing wheel nuts correctly — and explain honestly whether a tyre needs repairing or replacing rather than assuming the more expensive option.</p>

      <h2>Booking one in Bathgate and West Lothian</h2>
      <p>For a full walkthrough of how booking and the visit itself actually works, see our <a href="/mobile-tyre-fitting-guide/">complete mobile tyre fitting guide</a> — or see our <a href="/mobile-tyre-fitting-bathgate/">Bathgate coverage page</a> and <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> to get a quote.</p>`,
  },
  {
    slug: "what-tools-do-mobile-tyre-fitters-use",
    title: "What Tools Do Mobile Tyre Fitters Use? | SFR Motors Ltd",
    metaDescription: "An inside look at the equipment a mobile tyre fitting van typically carries — fitting, repair, safety and diagnostic tools, explained at a glance.",
    breadcrumbLabel: "Blog",
    headline: "What Tools Do Mobile Tyre Fitters Use?",
    bodyHtml: `      <p>Ever wondered what's actually inside a mobile tyre fitting van? Every fitter's setup differs slightly, but here's a look at the kind of equipment a well-equipped one typically carries, grouped by what it's for.</p>

      <h2>Core fitting equipment</h2>
      <p>A portable tyre changer removes the old tyre from the wheel rim and seats the new one without damaging it, and a wheel balancer checks the wheel spins evenly afterwards. An impact wrench and a torque wrench handle two different jobs — one removes wheel nuts quickly, the other does the final tightening to the exact figure the vehicle manufacturer specifies.</p>

      <h2>Lifting and stability equipment</h2>
      <p>Working on a tyre away from a workshop means the vehicle needs to be safely and securely supported first. Vans typically carry jacks rated for the vehicles they work on, and this is specialist equipment used by trained fitters — not something to attempt without the right training and gear.</p>

      <h2>Inflation and pressure equipment</h2>
      <p>Air compressors and tyre inflators bring a new tyre up to the correct pressure, usually alongside a digital gauge for accuracy. Correct pressure matters for safety, handling and fuel efficiency alike.</p>

      <h2>Repair equipment</h2>
      <p>Not every job needs a full replacement. Plug and patch kits, along with tools to properly assess a puncture — its size, position and depth — let a fitter carry out a suitable repair on the spot where the damage falls within safe repair guidelines.</p>

      <h2>Locking wheel nut tools</h2>
      <p>Specialist extraction tools, matched to the nut, allow a locking wheel nut to be removed without relying on the original key. See our <a href="/emergency-wheel-nut-removal-what-to-do-if-youve-lost-the-key/">guide on lost locking wheel nut keys</a> for more on how that works and why it's not a DIY job.</p>

      <h2>Diagnostic tools</h2>
      <p>Many modern vehicles need their tyre pressure monitoring system (TPMS) checked or reset after a tyre change. Some fitters also carry basic diagnostic tools to check for related issues, such as wheel alignment problems that affect tyre wear.</p>

      <h2>Safety equipment</h2>
      <p>Working roadside or in a car park comes with its own risks. Hi-vis clothing, warning cones, wheel chocks to stop the vehicle moving during the job, and portable lighting for after-dark callouts are standard kit for any fitter working away from a workshop.</p>

      <h2>What this means for you</h2>
      <p>Exactly what's on board varies between providers and vehicles — not every fitter carries identical equipment, and the right kit for a family car isn't necessarily what's needed for a van or a caravan. What matters is that the equipment is appropriate for the job and used by someone trained to use it properly. See our <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> for what's included when you book with us.</p>`,
  },
  // ---------------------------------------------------------------- Phase 4B Batch B3
  {
    slug: "professional-mobile-tyre-services-on-drivers-linlithgow",
    title: "Professional Mobile Tyre Services for Linlithgow Drivers | SFR Motors Ltd",
    metaDescription: "Why regular tyre maintenance matters, how punctures are properly assessed, and what commercial van drivers in Linlithgow should know about tyre care.",
    breadcrumbLabel: "Blog",
    headline: "Professional Mobile Tyre Services for Linlithgow Drivers",
    bodyHtml: `      <p>Keeping on top of tyre condition matters for every driver, but it's easy to let it slip until something goes wrong. Here's what's worth knowing — whether you're driving a car or running a van for work.</p>

      <h2>Why regular tyre checks matter</h2>
      <p>Tyres affect braking, grip and fuel efficiency, and small issues rarely announce themselves clearly. Cuts, bulges, low pressure and vibration while driving are all worth investigating rather than waiting to see if they get worse — catching a problem early is usually cheaper and safer than dealing with it after a breakdown.</p>

      <h2>What happens with a puncture</h2>
      <p>Not every puncture means a new tyre. The safe response depends on where the damage is, how large it is, and how deep it goes — details that only a physical inspection can properly assess. A puncture that seems minor at first can weaken the tyre further if driven on, so it's worth having it looked at rather than continuing to drive and hoping it holds.</p>

      <h2>Tyres on commercial vans</h2>
      <p>Vans used for work carry more load and cover more miles than the average car, which puts extra demand on their tyres. Correctly rated tyres matter for safety, fuel economy and load stability, and regular checks help avoid a van being taken off the road unexpectedly during a working day.</p>

      <h2>Getting a professional opinion</h2>
      <p>If you're not sure whether a tyre needs attention, a professional inspection is the only reliable way to know — not a guess based on how it looks or feels while driving. See our <a href="/mobile-tyre-fitting-linlithgow/">mobile tyre fitting in Linlithgow</a> page to arrange a visit, or our <a href="/van-tyre-replacement-services/">van tyre replacement service</a> for commercial vehicles.</p>`,
  },
  {
    slug: "the-best-tyres-for-edinburgh-west-lothian-roads",
    title: "How To Choose The Right Tyres For Edinburgh & West Lothian Driving | SFR Motors Ltd",
    metaDescription: "What actually determines the right tyre for your car — vehicle requirements, size, load and speed rating, season, and how you drive.",
    breadcrumbLabel: "Blog",
    headline: "How To Choose The Right Tyres For Edinburgh & West Lothian Driving",
    bodyHtml: `      <p>There's no single answer to "what tyre should I choose" — the right tyre depends on your vehicle, how you drive, and what you need from it. Here's what actually goes into the decision.</p>

      <h2>Start with your vehicle's own requirements</h2>
      <p>Every vehicle has a manufacturer-specified tyre size, load rating and speed rating, found in the handbook or on the plate inside the driver's door. Fitting anything below that specification isn't a matter of preference — it's a genuine safety issue, so this is always the starting point, not an afterthought.</p>

      <h2>Matching tyres to how you actually use the vehicle</h2>
      <p>A car doing mostly short urban trips has different demands than one covering long motorway journeys regularly, and a van carrying loads is different again. Usage affects which tyre characteristics — wear resistance, load capacity, noise, fuel efficiency — matter most for you.</p>

      <h2>Seasonal considerations</h2>
      <p>Scotland's weather varies through the year, and some drivers choose winter or all-season tyres for extra grip in cold, wet or icy conditions, while others stick with summer tyres year-round. Whether it's worth switching depends on your own driving pattern and where you typically drive, not a single rule that suits everyone.</p>

      <h2>Budget, premium and everything in between</h2>
      <p>Tyres span a wide price range, and the right choice depends on your budget and priorities as much as the vehicle. We'll talk through the options that fit your specification rather than steering you toward one tier by default.</p>

      <h2>Getting the right fit for you</h2>
      <p>There's no single fixed choice here — the right tyre is the one that matches your vehicle's specification, your driving and your budget. Tell us your registration or tyre size and we'll talk through suitable options — see our <a href="/our-tyre-range/">tyre range</a> for what we carry, or our <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh coverage page</a> to arrange a fitting.</p>`,
  },
  {
    slug: "tyre-services-west-lothian",
    title: "Common Causes of a Slow Tyre Leak | SFR Motors Ltd",
    metaDescription: "Why a tyre might be slowly losing air — several possible causes, and why a leak always needs a proper inspection rather than a guess.",
    breadcrumbLabel: "Blog",
    headline: "Common Causes of a Slow Tyre Leak",
    bodyHtml: `      <p>A tyre that keeps losing air without an obvious flat can be one of several different things — and telling them apart usually needs a proper look, not a guess.</p>

      <h2>Punctures from nails or debris</h2>
      <p>Sharp objects like nails, screws or glass are a common cause of a slow leak, and the puncture isn't always obvious just from looking at the tyre.</p>

      <h2>Damaged or worn valve stems</h2>
      <p>Valve stems wear out over time, and a crack or perished seal can let air escape gradually without anything else being wrong with the tyre.</p>

      <h2>Bead seal issues</h2>
      <p>The bead is where the tyre meets the rim, and corrosion or an imperfect seal there can cause a slow, sometimes hard-to-spot leak.</p>

      <h2>Corroded or damaged rims</h2>
      <p>Potholes and kerb strikes can bend or corrode a rim, creating tiny gaps that let air escape slowly over time.</p>

      <h2>Temperature changes</h2>
      <p>Tyre pressure naturally drops as the temperature falls, which can look like a leak during colder spells even when the tyre itself is fine — worth ruling out before assuming there's damage.</p>

      <h2>Sidewall damage</h2>
      <p>Kerb strikes and road debris can damage a tyre's sidewall in ways that aren't always visible, and this can be a more serious safety issue than a tread-area puncture.</p>

      <h2>An ageing tyre</h2>
      <p>Rubber degrades over time, and an older tyre can start to lose air more easily even without an obvious injury.</p>

      <h2>A faulty TPMS sensor</h2>
      <p>Where a vehicle has a tyre pressure monitoring system, a faulty sensor can itself cause a small leak around its seal, separate from anything wrong with the tyre.</p>

      <h2>Why it needs a proper look</h2>
      <p>Because a slow leak can come from several different causes — some straightforward to fix, others needing more than a repair — we can't tell you which applies to your tyre without inspecting it. If you're noticing repeated low pressure, uneven wear, or a dashboard warning light, it's worth getting it checked rather than continuing to top up and hope it holds.</p>

      <p>See our <a href="/mobile-tyre-puncture-repair/">puncture repair service</a> for suitable repairs, or our <a href="/mobile-tyre-fitting-west-lothian/">West Lothian coverage page</a> to arrange a visit.</p>`,
  },
  {
    slug: "your-guide-to-safe-tyre-services-in-harthill",
    title: "Your Guide to Safe Tyre Care for Harthill Drivers | SFR Motors Ltd",
    metaDescription: "Why professional tyre care matters, how punctures and locking wheel nuts are safely handled, and what to look out for before a tyre becomes a problem.",
    breadcrumbLabel: "Blog",
    headline: "Your Guide to Safe Tyre Care for Harthill Drivers",
    bodyHtml: `      <p>Tyre problems rarely pick a convenient moment. Here's a practical look at what keeps them safe, how punctures are properly assessed, and what to know about locking wheel nuts.</p>

      <h2>Why tyre condition matters</h2>
      <p>Tyres are one of the most safety-critical parts of any vehicle — condition affects braking, fuel use and steering control. Checking regularly for vibration, uneven wear or pressure loss helps catch a developing problem before it becomes a bigger one.</p>

      <h2>Assessing a puncture properly</h2>
      <p>A puncture doesn't always mean a new tyre. Continuing to drive on one can weaken the tyre's structure further and make a repair less likely to be possible, so it's worth having it looked at rather than waiting. A professional inspection is the only way to know whether a repair is safe or whether replacement is the better option.</p>

      <h2>Locking wheel nuts: a note on safety</h2>
      <p>Locking wheel nuts protect against wheel theft, but they can be difficult to remove if the key is lost, damaged or worn. Forcing them with unauthorised tools risks damaging the wheel, the stud, or the locking mechanism itself — specialist extraction tools, used correctly, avoid that risk. See our <a href="/emergency-wheel-nut-removal-what-to-do-if-youve-lost-the-key/">guide on lost locking wheel nut keys</a> for more.</p>

      <h2>Why professional care is worth it</h2>
      <p>Skilled fitting, done properly, reduces the likelihood of problems coming back and keeps a vehicle roadworthy without unnecessary cost. Regular checks and prompt attention when something's off go a long way toward avoiding a breakdown altogether.</p>

      <h2>Getting it looked at in Harthill</h2>
      <p>See our <a href="/mobile-tyre-fitting-harthill/">Harthill coverage page</a> to arrange a visit, or get in touch with your vehicle details for advice.</p>`,
  },
  // ---------------------------------------------------------------- Phase 4B Batch C
  {
    slug: "tyre-lifespan",
    title: "How Long Should Tyres Last? A Safety-Focused Guide | SFR Motors Ltd",
    metaDescription: "What actually determines how long a tyre lasts, and how to tell when it's time to replace — without relying on a single mileage figure.",
    breadcrumbLabel: "Blog",
    headline: "How Long Should Tyres Last?",
    bodyHtml: `      <p>"How long should my tyres last?" doesn't have a single number for an answer — and treating it as though it does can be misleading. Tyre life depends on a combination of factors specific to your vehicle and how it's driven, not a fixed mileage that applies to everyone.</p>

      <h2>Why there's no single figure</h2>
      <p>Tyre life varies with the vehicle itself, the tyre type fitted, the drivetrain (front, rear or all-wheel drive puts different demands on different tyres), the load it regularly carries, tyre pressure, wheel alignment, the road conditions it covers, any damage it picks up along the way, how well it's maintained, and driving style. Two identical cars can wear through tyres at noticeably different rates depending on these factors alone — which is why a single "expect X miles" figure, even a well-intentioned one, doesn't hold up in practice.</p>

      <h2>What actually shortens tyre life</h2>
      <p>Under- or over-inflated tyres wear unevenly and faster than correctly inflated ones. Poor wheel alignment causes uneven wear, often concentrated on one side or edge of the tyre. An aggressive driving style — harsh braking, rapid acceleration and hard cornering — increases wear noticeably compared with smooth, steady driving. Carrying heavy loads regularly adds strain. Rough or pothole-damaged road conditions can cause both accelerated wear and physical damage, and any damage a tyre picks up can shorten its safe working life regardless of how much tread is left. Routine maintenance — checking pressure, watching for uneven wear, keeping alignment in check — catches most of this early. None of these affect every vehicle equally, which is exactly why following your own vehicle and tyre manufacturer's guidance matters more than a general rule of thumb.</p>

      <h2>Age matters as well as mileage</h2>
      <p>Tyre rubber changes over time regardless of how many miles have been driven, so even a tyre with plenty of tread left can be due attention if it's old, has been stored badly, or shows cracking on the sidewall. A visual check for cracking, perishing or bulges is worth doing alongside checking tread depth — age-related deterioration isn't something mileage alone tells you about.</p>

      <h2>The UK legal tread depth requirement</h2>
      <p>By law, car tyres must have at least 1.6mm of tread depth across the central three-quarters of the tyre, around its entire circumference. This is a legal minimum, not a target — many tyres are less effective in wet conditions well before they reach 1.6mm, and grip in the rain and braking performance both decline as tread wears down. Replacing a tyre before it reaches the legal minimum, rather than waiting until it does, is generally the safer approach.</p>

      <h2>When to replace, not repair</h2>
      <p>Whether a tyre should be repaired or replaced depends on its condition, the location and size of any damage, its age, and whether it still meets the legal tread requirement — not a fixed rule that applies to every tyre the same way. Cracks, bulges, sidewall damage or uneven wear are all reasons to have a tyre looked at rather than waiting to see how it performs. A physical inspection is the only reliable way to know whether a specific tyre needs replacing; we're not able to make that call from a description alone.</p>

      <h2>Getting an honest assessment</h2>
      <p>If you're not sure whether your tyres need attention, we'll assess them on-site and explain honestly what's needed rather than assuming the more expensive option. See our <a href="/mobile-tyre-replacement/">tyre replacement service</a> for details, or our <a href="/mobile-tyre-puncture-repair/">puncture repair service</a> if the damage turns out to be repairable.</p>`,
  },
  {
    slug: "why-professional-mobile-tyre-services-are-essential-for-modern-drivers",
    title: "Why Professional Mobile Tyre Services Matter | SFR Motors Ltd",
    metaDescription: "Why professional tyre fitting and inspection matters for safety, not just convenience — and what to expect from a properly done job.",
    breadcrumbLabel: "Blog",
    headline: "Why Professional Mobile Tyre Services Matter",
    bodyHtml: `      <p>Mobile tyre fitting is often talked about purely in terms of convenience — no garage trip, no waiting room. That's true, but it's not the whole picture. Done properly, professional tyre service is also a safety matter, not just a time-saver.</p>

      <h2>Tyres affect more than most drivers realise</h2>
      <p>Tyre condition affects braking distance, grip, steering response and fuel efficiency — not just ride comfort. A tyre that's worn, under-inflated, or has sidewall damage can extend stopping distances and reduce grip, particularly in wet weather, well before it looks obviously unsafe.</p>

      <h2>What "properly fitted" actually involves</h2>
      <p>Fitting a tyre correctly means more than mounting it on the rim — it includes balancing the wheel, tightening to the vehicle manufacturer's specified torque rather than just "tight," and checking for anything else that could affect how the tyre performs once it's back on the road. Skipping any of these doesn't always show up immediately, but it can affect handling, wear and safety over time.</p>

      <h2>Why an honest assessment matters</h2>
      <p>Not every damaged tyre needs replacing, and not every worn tyre is beyond a repair — but telling the difference requires an actual inspection, not a guess. A proper assessment looks at where the damage is, how deep it goes, and whether it falls within safe repair guidelines, and explains the result honestly rather than defaulting to whichever option costs more.</p>

      <h2>Locking wheel nuts and the same principle</h2>
      <p>The same reasoning applies to jobs like locking wheel nut removal — using the wrong tool or technique risks damaging the wheel, the stud, or the locking mechanism itself. Specialist tools and experience reduce that risk considerably compared with an improvised attempt. See our <a href="/emergency-wheel-nut-removal-what-to-do-if-youve-lost-the-key/">guide on lost locking wheel nut keys</a> for more.</p>

      <h2>Getting it done properly</h2>
      <p>SFR Motors Ltd &mdash; Secure. Fast. Reliable. &mdash; carries out mobile tyre fitting, repair and replacement to the same standard you'd expect from a workshop, wherever your vehicle is. See our <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> for what's included, or get in touch for a quote.</p>`,
  },
  {
    slug: "locking-wheel-nut-removal-industry-practice-disclaimer-requirements-and-wheel-damage-risk",
    title: "Locking Wheel Nut Removal: Industry Practice And Wheel Damage Risk | SFR Motors Ltd",
    metaDescription: "What professional locking wheel nut removal actually involves, the wheel-damage risk involved, and what's worth asking before work begins.",
    breadcrumbLabel: "Blog",
    headline: "Locking Wheel Nut Removal: Industry Practice And Wheel Damage Risk",
    bodyHtml: `      <p>Losing a locking wheel nut key isn't unusual, and it's rarely as serious a problem as it feels in the moment. Here's a realistic look at how professional removal actually works, the risk involved, and what's worth asking before any work begins.</p>

      <h2>Why keys go missing</h2>
      <p>It happens for a range of ordinary reasons &mdash; the adaptor gets left with a previous fitter, lost during a service, misplaced somewhere at home, or the nut itself becomes worn or corroded and stops responding to the key that should fit it. None of these are unusual, and mobile tyre operators deal with this regularly.</p>

      <h2>How professional removal works, in general terms</h2>
      <p>Specialist extraction tools are designed to grip the locking nut itself rather than the surrounding wheel. Different tools suit different situations &mdash; a nut that's simply lost its key is usually more straightforward to deal with than one that's also seized or corroded, which can need a different approach and carries more risk of the nut itself being damaged in the process. We won't go into the specific techniques here, since the right method depends on the individual nut, wheel and vehicle, and that judgement is exactly what a trained technician is for &mdash; not something to attempt yourself.</p>

      <h2>Does removal risk damaging the wheel?</h2>
      <p>Used correctly, specialist tools are built to work on the nut without contacting the wheel face. The main risk comes from the nut itself being recessed, worn, or an unusual fit &mdash; situations that can call for a more involved approach and carry a higher chance of the nut needing to be destroyed to get it off. This is a genuine part of the job, not a reason to avoid getting it looked at professionally &mdash; driving around with a nut you can't remove is a bigger problem than the small risk involved in dealing with it properly.</p>

      <h2>Why DIY removal isn't a good idea</h2>
      <p>Generic sockets, force, or improvised tools bought for a one-off job don't have the same fit or control as the tools a fitter uses regularly, and a mismatch between tool and nut is where wheel damage is most likely to happen. If you can't find your key, it's worth calling a professional rather than trying to force it off yourself.</p>

      <h2>What to expect, and what's worth asking</h2>
      <p>No professional service can guarantee a locking nut will come off without being damaged in every case &mdash; that's simply the nature of the job, not a reason to be wary of the service itself. Before any work starts, it's reasonable to ask what approach the technician plans to use, what the risk is for your specific wheel, and whether you'll need a replacement nut afterwards &mdash; most vehicles will need a standard nut fitted in its place unless you've sourced a replacement locking set in advance. A technician should explain this before starting, and confirm you're happy to go ahead once you understand the risk, not begin without your agreement.</p>

      <h2>Getting it sorted</h2>
      <p>See our <a href="/mobile-locking-wheel-nut-removal/">mobile locking wheel nut removal service</a> for details, or get in touch with your vehicle details and we'll talk through what's involved.</p>`,
    faq: [
      { q: "Can removal be guaranteed not to damage the nut itself?", a: "No — in some cases, particularly where a nut is seized or corroded, it may need to be destroyed to come off safely. The wheel itself is designed to be protected during this process." },
      { q: "Will I get a locking wheel nut back afterwards?", a: "Not necessarily. Most vehicles will be fitted with a standard nut in its place unless you've sourced a replacement locking set in advance." },
      { q: "Is it safe to try removing a locking wheel nut myself?", a: "We wouldn't recommend it. A mismatch between a generic tool and your specific nut is where wheel damage is most likely to happen — it's best left to a technician with the right equipment." },
    ],
    faqTitle: "Locking Wheel Nut Removal Questions",
    faqGroup: "sfr-lwn-industry-faq",
  },
  // ---------------------------------------------------------------- Phase 4B Batch D1
  {
    slug: "what-mobile-fitters-check-before-changing-a-tyre-on-a-hill",
    title: "Changing A Tyre On A Slope: Why We Check First | SFR Motors Ltd",
    metaDescription: "Why we won't lift a vehicle on an unsafe slope, what we assess before starting work, and what to do if you're stuck somewhere uneven.",
    breadcrumbLabel: "Blog",
    headline: "Changing A Tyre On A Slope: Why We Check First",
    bodyHtml: `      <p>Not every roadside is flat, and not every flat tyre happens somewhere convenient. Before we lift a vehicle anywhere, we check whether the location is actually safe to work in &mdash; here's why that matters and what we're looking at.</p>

      <h2>Why a slope changes things</h2>
      <p>A jack is designed to take weight straight down. On level ground that's exactly what happens. On a slope, part of the vehicle's weight pushes sideways instead, and every jack has a limit to how much side-load it can safely take. This isn't about the jack being poor quality &mdash; it's a physical limit that applies to any jack, and going past it is how a vehicle comes off a jack unexpectedly.</p>

      <h2>What we assess before starting</h2>
      <p>We look at the angle of the ground, the surface underneath (firm tarmac behaves very differently to loose gravel or wet grass), which way the vehicle is pointing, the condition of the jacking point itself, and the vehicle type &mdash; a taller vehicle with a higher centre of gravity is less forgiving on a slope than a low saloon. Taken together, these tell us whether it's safe to lift the vehicle where it's stopped.</p>

      <h2>If the location isn't safe to work in</h2>
      <p>Sometimes a vehicle can be moved a short distance to level ground safely &mdash; for example, if there's still some air in the tyre. In that situation, we may ask you to move it carefully while we follow. If it can't be moved safely, we won't attempt the job where it's parked. We'll explain why and talk through the safest next step, which may mean waiting for us to arrange a safer approach, or recommending recovery if the vehicle genuinely can't be worked on where it is.</p>

      <h2>What to do if you're stuck somewhere uneven</h2>
      <p>Stay in the vehicle if it's safe to do so, and if you do need to get out, keep to the uphill or verge side, away from moving traffic. Put your hazard lights on so you're visible to other drivers. Then get in touch and tell us it's on a slope &mdash; we'll ask a few questions about the angle and surface so we know what to expect before anyone sets off.</p>

      <h2>Getting help</h2>
      <p>See our <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> for how a routine callout works, or our <a href="/24-7-mobile-tyre-replacement/">24/7 mobile tyre replacement</a> page if you need help right now.</p>`,
  },
  {
    slug: "how-to-extend-tyre-life-and-avoid-unexpected-roadside-breakdowns",
    title: "Everyday Habits That Help Your Tyres Last | SFR Motors Ltd",
    metaDescription: "Simple maintenance habits — pressure, inspection, alignment, load and driving style — that help you avoid unexpected tyre problems on the road.",
    breadcrumbLabel: "Blog",
    headline: "Everyday Habits That Help Your Tyres Last",
    bodyHtml: `      <p>Plenty of tyre problems that end up as a roadside breakdown started out as something small and missable. None of the habits below take long, and together they catch most of the common causes before they turn into a flat tyre at the worst possible time.</p>

      <h2>Check pressure regularly, not just when something feels off</h2>
      <p>Under- and over-inflated tyres both wear faster and unevenly, and low pressure in particular increases the risk of overheating and structural damage. A monthly check, done cold, is enough to catch a slow drop before it becomes a problem &mdash; your vehicle's handbook or the sticker inside the driver's door will have the correct figure for your car.</p>

      <h2>Look for damage, not just tread depth</h2>
      <p>Tread depth matters, but so does the condition of the tyre itself. Cracking, bulges, cuts or anything embedded in the tread are all worth having looked at, even if there's plenty of tread left &mdash; a tyre can be structurally compromised well before it looks worn.</p>

      <h2>Keep an eye on alignment</h2>
      <p>If a vehicle pulls to one side, or you notice a tyre wearing unevenly across its width, it's usually a sign the alignment needs checking. Left alone, poor alignment wears tyres unevenly and can shorten their working life considerably.</p>

      <h2>Mind what you're carrying</h2>
      <p>Every tyre has a weight it's rated to carry, and regularly loading a vehicle beyond that adds strain that shows up as faster wear and a higher risk of failure. Your vehicle's manual will have the recommended load limits.</p>

      <h2>Driving style makes a real difference</h2>
      <p>Harsh braking, rapid acceleration and hard cornering all put more stress on tyres than smooth, steady driving. It's not about driving unnaturally cautiously &mdash; just being aware that an aggressive style wears tyres down faster than it needs to.</p>

      <h2>Follow your manufacturer's guidance</h2>
      <p>Your vehicle and tyre manufacturers' own recommendations &mdash; on pressure, rotation intervals and general care &mdash; are worth following rather than a generic rule of thumb, since they're specific to your actual vehicle and tyres.</p>

      <h2>Don't ignore a slow puncture</h2>
      <p>A tyre that's slowly losing air is worth getting looked at promptly rather than continuing to top it up. See our <a href="/mobile-tyre-puncture-repair/">puncture repair service</a> if that's what you're dealing with.</p>

      <h2>Want to understand what actually determines how long a tyre lasts?</h2>
      <p>This page is about the everyday habits that help. For a fuller look at the factors behind tyre lifespan itself, see our guide on <a href="/tyre-lifespan/">how long tyres should last</a>, or our piece on <a href="/better-tyres-better-drive/">why tyre condition matters</a> for the safety side of things.</p>`,
  },
  {
    slug: "mobile-tyre-fitting-livingston-tyre-problems",
    title: "Common Tyre Problems Livingston Drivers Face | SFR Motors Ltd",
    metaDescription: "The tyre problems we see most often in Livingston — punctures, uneven wear, low tread and pressure issues — and how to tell when it needs a proper look.",
    breadcrumbLabel: "Blog",
    headline: "Common Tyre Problems Livingston Drivers Face",
    bodyHtml: `      <p>Livingston's mix of distributor roads, roundabouts and retail park car parks throws up a fairly consistent set of tyre problems. Here's what we see most often, and how to tell whether something needs attention.</p>

      <h2>Punctures from road debris</h2>
      <p>Nails, glass and general debris on busier roads and car parks are a common cause of a slow leak or a sudden flat. A pressure warning light, a car pulling slightly to one side, or something visibly stuck in the tread are all signs worth acting on rather than waiting out.</p>

      <h2>Uneven wear</h2>
      <p>Stop-start traffic and frequent roundabouts can accelerate uneven wear, often linked to alignment, pressure or suspension issues. Uneven wear reduces grip and shortens a tyre's working life, so it's worth having the cause identified rather than just replacing the tyre and expecting a different result.</p>

      <h2>Low tread depth</h2>
      <p>By law, tyres need at least 1.6mm of tread across the central three-quarters of the tyre, all the way round &mdash; this is a legal minimum, not a target, and grip in wet conditions declines before tread reaches that point. The 20p coin test (insert a 20p coin into the main grooves; if the outer band is visible, it's worth getting checked) is a quick way to get a rough sense of where you stand, though a proper measurement needs a tread depth gauge.</p>

      <h2>Sidewall damage</h2>
      <p>Kerb strikes around retail parks and residential streets, along with potholes on some of the older West Lothian roads, can cause bulges, cracks or cuts in a tyre's sidewall. Sidewall damage isn't repairable &mdash; if you notice any of these signs, the tyre needs replacing rather than patching.</p>

      <h2>Pressure problems</h2>
      <p>Cold mornings cause tyre pressure to drop, and it's easy to over-correct using a petrol station pump that isn't accurately calibrated. Incorrect pressure affects fuel efficiency, wear and the risk of a blowout, so a regular check against your vehicle's recommended figure is worth doing.</p>

      <h2>When it needs a professional look</h2>
      <p>We can't tell whether a specific tyre is repairable or needs replacing without seeing it &mdash; the location, size and depth of any damage all affect that decision, and it isn't something we can judge from a description alone. If you're dealing with any of the above, see our <a href="/mobile-tyre-fitting-livingston/">Livingston coverage page</a> to arrange a visit.</p>`,
  },
  {
    slug: "tyre-blowout-causes-prevention",
    title: "Tyre Blowouts: Causes, Prevention And What To Do | SFR Motors Ltd",
    metaDescription: "What causes a tyre blowout, practical steps to reduce the risk, and the safest way to respond if one happens while you're driving.",
    breadcrumbLabel: "Blog",
    headline: "Tyre Blowouts: Causes, Prevention And What To Do",
    bodyHtml: `      <p>A tyre blowout &mdash; a sudden, complete loss of pressure rather than a slow leak &mdash; is rare, but it's unsettling enough that it's worth knowing both what causes one and how to respond safely if it happens.</p>

      <h2>What causes a blowout</h2>
      <p>Under-inflation is one of the most common causes: running low on air lets a tyre flex more than it's designed to, generating heat that weakens its structure. Overloading a vehicle beyond its tyres' rated capacity has a similar effect. Worn tyres with little tread left are more vulnerable to failure, as are tyres damaged by sharp debris or potholes. Extreme heat accelerates all of these; a manufacturing defect, while less common, can also be a factor.</p>

      <h2>Reducing the risk</h2>
      <p>Checking tyre pressure regularly, keeping within your vehicle's rated load limits, and visually inspecting tyres for cracks, bulges or embedded debris before a long journey all reduce the chances of a blowout. Following your tyre and vehicle manufacturer's own guidance on rotation and maintenance is worth doing rather than relying on a generic mileage figure, since the right interval varies by vehicle and driving.</p>

      <h2>If it happens while you're driving</h2>
      <p>Try to keep control of the vehicle. Grip the steering wheel firmly and allow it to roll to a stop, moving towards the side of the road rather than stopping in a live traffic lane. If you're left with a flat tyre, stop as soon as it's safe to do so. Only change the tyre yourself if you can do it without putting yourself or anyone else at risk &mdash; on a motorway, or anywhere that doesn't feel safe, call for breakdown assistance instead.</p>

      <h2>Getting a replacement afterwards</h2>
      <p>A tyre that's blown out needs replacing, not repairing. See our <a href="/24-7-mobile-tyre-replacement/">24/7 mobile tyre replacement</a> page to arrange a callout.</p>`,
  },
  {
    slug: "preparing-your-car-tyres-for-winter-driving-in-livingston",
    title: "Preparing Your Tyres For Winter Driving In Livingston | SFR Motors Ltd",
    metaDescription: "A pre-winter tyre checklist for Livingston drivers — pressure, tread and condition checks, and what to do if you're caught out.",
    breadcrumbLabel: "Blog",
    headline: "Preparing Your Tyres For Winter Driving In Livingston",
    bodyHtml: `      <p>Cold, wet weather and Livingston's roundabouts and distributor roads are a demanding combination for tyres. A few checks before winter sets in go a long way toward avoiding a problem once the weather turns.</p>

      <h2>Check pressure as the temperature drops</h2>
      <p>Tyre pressure falls as the temperature does, so it's worth checking monthly through the colder months rather than assuming it's still correct from earlier in the year. Your vehicle's handbook or the sticker inside the driver's door will have the right figure &mdash; under-inflation costs you both grip and fuel efficiency.</p>

      <h2>Check tread depth properly</h2>
      <p>By law, tyres need at least 1.6mm of tread across the central three-quarters, all the way round &mdash; that's a legal minimum, not a target, and wet-weather grip declines before a tyre reaches it. The 20p coin test (insert a 20p coin into the main grooves; if the outer band is visible, get it checked) gives a rough indication, though a tread depth gauge is the accurate way to measure it.</p>

      <h2>Look for damage before it worsens</h2>
      <p>Hitting a kerb or a pothole in Livingston's residential areas or retail park car parks can cause a bulge or a cut in the sidewall that isn't always obvious at a glance. A quick visual check before winter, and after any kerb strike, is worth doing &mdash; sidewall damage isn't repairable and needs a replacement.</p>

      <h2>A note on seasonal tyres</h2>
      <p>Winter and all-season tyres aren't a legal requirement in Scotland, but they're designed to stay more flexible in cold temperatures than a standard summer tyre, which can help with grip in icy or snowy conditions. Whether it's worth it for you depends on how and where you drive &mdash; it's a personal decision, not something we'd tell you is essential.</p>

      <h2>If you're caught out</h2>
      <p>If a tyre fails while you're out, get to a safe position away from moving traffic where you can, and put your hazard lights on. If you have breakdown cover through the AA, RAC, Green Flag or another provider, that's one route to getting help &mdash; we're not affiliated with any of them, just noting they're an option. Otherwise, get in touch with us directly and we'll come to you. See our <a href="/mobile-tyre-fitting-livingston/">Livingston coverage page</a> for how that works, or our guide to <a href="/mobile-tyre-fitting-livingston-tyre-problems/">common tyre problems Livingston drivers face</a> if you're trying to work out what's going on before you call.</p>`,
  },
  {
    slug: "how-to-choose-the-best-tyres-for-my-car-expert-buying-guide",
    title: "How To Choose The Right Tyres For Your Car | SFR Motors Ltd",
    metaDescription: "Understanding tyre size, load index, speed rating, seasonal options and the EU tyre label — what actually matters when choosing new tyres.",
    breadcrumbLabel: "Blog",
    headline: "How To Choose The Right Tyres For Your Car",
    bodyHtml: `      <p>Choosing tyres doesn't have to mean guessing between whatever's cheapest and whatever sounds most impressive. A handful of details on the tyre itself, and a clear sense of how you actually drive, cover most of what matters.</p>

      <h2>Reading the sidewall</h2>
      <p>A marking like 205/55 R16 91V isn't random: 205 is the tyre's width in millimetres, 55 is the sidewall height as a percentage of that width, R16 means radial construction on a 16-inch rim, and 91V is the load index and speed rating together. Matching these to your vehicle's specification &mdash; found in the handbook or on the door-jamb sticker &mdash; is the starting point, and it's not somewhere to guess or downgrade to save money.</p>

      <h2>Matching your vehicle and how you drive</h2>
      <p>Beyond the size itself, it's worth thinking honestly about your driving: mostly short local trips, regular motorway miles, a heavier vehicle that's often loaded, or a car that sees genuinely poor weather. None of these mean you need the most expensive option available &mdash; they just narrow down which characteristics actually matter for your situation.</p>

      <h2>Seasonal options</h2>
      <p>Summer tyres are the default for most of the year and perform well in dry and wet conditions above around 7°C. Winter tyres use a softer compound that stays flexible in the cold, improving grip on icy or snowy roads, but they wear faster and grip less well once temperatures rise. All-season tyres are a compromise between the two, suited to drivers who'd rather not swap tyres twice a year but don't face extreme conditions either way.</p>

      <h2>Understanding the tyre label</h2>
      <p>Every tyre sold in the UK carries a label rating fuel efficiency, wet-weather grip and external noise. It's worth checking alongside the price rather than instead of it &mdash; two tyres at a similar cost can have meaningfully different wet-grip ratings, and that's the rating most directly tied to stopping distance in the rain.</p>

      <h2>Tread depth and knowing when to replace</h2>
      <p>The UK legal minimum is 1.6mm of tread across the central three-quarters of the tyre, all the way round. Meeting that minimum doesn't automatically mean a tyre is otherwise safe &mdash; condition, damage, pressure and your vehicle and tyre manufacturer's own guidance all matter too, and wet-weather grip can decline before a tyre reaches the legal limit. For more on what affects how long a tyre lasts in the first place, see our guide on <a href="/tyre-lifespan/">tyre lifespan</a>.</p>

      <h2>A note on brands and budget</h2>
      <p>Well-known manufacturers such as Michelin, Bridgestone and Continental sit at the premium end, with brands like Falken, Kumho and Toyo generally positioned as solid mid-range options. This isn't a claim that one tier is always better for every driver &mdash; it's a starting point for narrowing down options, and budget genuinely varies by household. Whatever tier you're considering, checking the label ratings above still applies.</p>

      <h2>Getting fitted properly</h2>
      <p>Once you've settled on a size and type, correct fitting &mdash; balancing, torque and a check of the valve &mdash; matters as much as the tyre itself. See our <a href="/our-tyre-range/">tyre range</a> for what we carry, or get in touch with your registration or tyre size for a price.</p>`,
  },
  // ---------------------------------------------------------------- Phase 4B Batch D2
  {
    slug: "premium-or-budget-which-tyres-keep-you-safer",
    title: "Premium Or Budget Tyres: How To Compare Them Safely | SFR Motors Ltd",
    metaDescription: "Premium and budget tyres aren't the same, but price alone doesn't tell you which is safer. How to actually compare tyres before you buy.",
    breadcrumbLabel: "Blog",
    headline: "Premium Or Budget Tyres: How To Compare Them Safely",
    bodyHtml: `      <p>"Premium or budget?" is a common question when it's time for new tyres, but price tier alone isn't a reliable way to judge safety. Here's what's actually worth comparing.</p>

      <h2>Price isn't a safety guarantee on its own</h2>
      <p>A higher price doesn't automatically mean a safer tyre, and a lower price doesn't automatically mean a worse one. Both premium and budget ranges include tyres that meet the same UK legal and safety requirements &mdash; the differences that matter are found in the specifics, not the price bracket alone.</p>

      <h2>Start with suitability, not price</h2>
      <p>The right tyre is one that matches your vehicle's specification &mdash; size, load index and speed rating &mdash; and suits how you actually drive. A tyre that's wrong for your vehicle or driving pattern isn't made safer by being expensive, and a well-matched budget tyre can outperform a poorly matched premium one for your specific car.</p>

      <h2>Check the tyre label</h2>
      <p>Every tyre sold in the UK carries a label rating fuel efficiency, wet-weather grip and external noise. This is the most direct, comparable way to judge a specific tyre's performance &mdash; including wet-grip, which is closely tied to braking distance in the rain &mdash; rather than assuming a price tier tells you the same thing. Two tyres at a similar price can carry meaningfully different label ratings, so it's worth checking rather than skipping.</p>

      <h2>Condition matters more than price tier</h2>
      <p>A well-maintained tyre in good condition, whatever its price point, generally performs better than a neglected one from any tier. By law, tyres need at least 1.6mm of tread across the central three-quarters of the tyre, all the way round &mdash; but that's a legal minimum, not a guarantee a tyre is otherwise safe. Damage, age, pressure and your vehicle and tyre manufacturer's own guidance all matter alongside tread depth.</p>

      <h2>What can genuinely differ between tiers</h2>
      <p>Premium ranges typically involve more research and development investment, which can show up as more consistent wet-grip performance, quieter running or longer wear life &mdash; but this varies by specific tyre and isn't a rule that applies evenly across every premium or budget product. Rather than assuming, the label ratings above are the fair way to compare two specific tyres against each other.</p>

      <h2>Making the decision</h2>
      <p>If you drive high annual mileage, mostly motorway miles, or in poor weather regularly, it may be worth prioritising a tyre with strong wet-grip and durability ratings regardless of tier. For lower-mileage, mostly local driving, a well-rated budget or mid-range tyre in good condition is a reasonable choice. See our <a href="/our-tyre-range/">tyre range</a> for what we carry across price points, or get in touch with your vehicle details and we'll talk through suitable options.</p>`,
  },
  {
    slug: "puncture-repairs-whats-actually-being-done-to-your-tyre",
    title: "Puncture Repairs: What's Actually Involved | SFR Motors Ltd",
    metaDescription: "Why a proper puncture repair means taking the tyre off the wheel for inspection, and why not every puncture can be safely repaired.",
    breadcrumbLabel: "Blog",
    headline: "Puncture Repairs: What's Actually Involved",
    bodyHtml: `      <p>Not every puncture fix is the same, and it helps to know roughly what's involved before you book one in &mdash; both to understand what you're paying for, and to know when a repair genuinely isn't the safe option.</p>

      <h2>Why the tyre comes off the wheel</h2>
      <p>A proper repair means removing the tyre from the wheel completely, not just plugging the hole from outside. That's because a puncture can affect more than the visible entry point &mdash; the inner liner and surrounding structure need to be checked too, and none of that is visible while the tyre is still mounted. Anyone offering to fix a puncture without taking the tyre off the wheel is working without seeing the full picture.</p>

      <h2>What a professional assessment actually checks</h2>
      <p>Once the tyre is off, a proper inspection looks at where the damage is, how large it is, whether the inner liner has been affected, and whether the tyre shows any sign of having been driven on while flat &mdash; something that can cause internal damage that isn't visible from outside. Previous repairs nearby also matter, since a tyre can only safely be repaired so many times.</p>

      <h2>Why not every puncture can be safely repaired</h2>
      <p>Some punctures aren't repairable, whatever method is used. Damage too close to the sidewall, a hole that's too large, a tyre that's been driven on while flat, multiple punctures close together, or a tyre that's already worn low are all reasons a repair may not be the safe option &mdash; and any damage to the sidewall itself isn't repairable at all. A proper assessment tells you honestly which situation you're in, rather than defaulting to whichever answer is quicker.</p>

      <h2>What it costs</h2>
      <p>Cost depends on the type of repair needed and the work involved in checking the tyre properly &mdash; get in touch with your tyre size and the damage you can see, and we'll confirm a price before any work starts.</p>

      <h2>Getting it looked at</h2>
      <p>See our <a href="/mobile-tyre-puncture-repair/">mobile puncture repair service</a> for how a callout works, or get in touch if you're not sure whether your tyre is a repair or a replacement &mdash; we'll assess it on-site and explain honestly what's needed.</p>`,
  },
  {
    slug: "mobile-tyre-fitter-near-me-myths",
    title: "Mobile Tyre Fitting Myths, Answered | SFR Motors Ltd",
    metaDescription: "Common myths about mobile tyre fitting — cost, quality, speed and more — addressed factually, without the hype.",
    breadcrumbLabel: "Blog",
    headline: "Mobile Tyre Fitting Myths, Answered",
    bodyHtml: `      <p>Mobile tyre fitting has been around long enough that most of the myths about it are out of date. Here's a straightforward look at the ones we hear most often.</p>

      <h2>Myth: it costs more than a garage</h2>
      <p>Not necessarily. Once you factor in towing, lost time, or arranging a lift to and from a garage, mobile fitting is often comparable in overall cost &mdash; and you avoid the inconvenience of getting to a fixed location in the first place.</p>

      <h2>Myth: mobile fitters use lower-quality tyres</h2>
      <p>A reputable mobile fitter carries the same branded tyres you'd find at a garage, across a range of price points. There's no inherent reason a tyre fitted at the roadside is any different from one fitted on a garage forecourt.</p>

      <h2>Myth: it's slower than a garage visit</h2>
      <p>Modern mobile fitting vans carry the same fitting and balancing equipment as a workshop bay. The time to complete a fitting is broadly similar &mdash; the difference is you're not also spending time travelling to and from a garage.</p>

      <h2>Myth: it's only for emergencies</h2>
      <p>Emergency callouts are one part of the service, but plenty of customers book mobile fitting for routine replacements, seasonal tyre changes, or scheduled maintenance, simply because it saves the trip to a garage.</p>

      <h2>Myth: a lost locking wheel nut key means a tow</h2>
      <p>Specialist extraction tools exist for exactly this situation. See our <a href="/emergency-wheel-nut-removal-what-to-do-if-youve-lost-the-key/">guide on lost locking wheel nut keys</a> for how it's actually handled.</p>

      <h2>Myth: DIY repair is just as good</h2>
      <p>A roadside sealant or plug kit can be a temporary get-you-home measure, but it isn't a substitute for a proper repair &mdash; which needs the tyre off the wheel and inspected. See our guide on <a href="/puncture-repairs-whats-actually-being-done-to-your-tyre/">what a proper puncture repair actually involves</a>.</p>

      <h2>Myth: mobile fitters aren't as qualified</h2>
      <p>Mobile fitting requires the same competence as garage-based fitting &mdash; balancing, correct torque, and an honest assessment of what a tyre actually needs. The setting doesn't change the skill required.</p>

      <h2>Myth: it doesn't work in bad weather</h2>
      <p>Mobile fitters carry weatherproof equipment and lighting specifically because UK weather is unpredictable. A booking isn't usually affected by rain or cold, though a technician will always prioritise safety over pushing ahead with a job in genuinely unsafe conditions.</p>

      <h2>Where we cover</h2>
      <p>SFR Motors Ltd covers Bathgate, Edinburgh, West Lothian and Falkirk. If you're not sure whether your location is included, get in touch and we'll confirm before you book anything in.</p>`,
  },
  {
    slug: "michelin-radial-tire-history-innovation",
    title: "Michelin's Radial Tyre: A Brief History | SFR Motors Ltd",
    metaDescription: "How Michelin's 1946 radial tyre patent changed tyre construction — a brief, factual history.",
    breadcrumbLabel: "Blog",
    headline: "Michelin's Radial Tyre: A Brief History",
    bodyHtml: `      <p>Most drivers have never given radial construction a second thought, but it's the reason modern tyres perform the way they do. Here's a brief, factual look at where it came from.</p>

      <h2>The 1946 patent</h2>
      <p>On 4 June 1946, Michelin registered a patent in Paris for a new tyre construction method: the steel-belted radial. The patent was filed in the name of Pierre-Marcel Bourdon, Michelin's Technical Director at the time. It was a significant departure from the cross-ply tyres that dominated the market, and it took a few more years of development before it reached the public.</p>

      <h2>What made it different</h2>
      <p>In a cross-ply tyre, the internal plies run diagonally and overlap each other, which means the tread and sidewalls flex together rather than independently. A radial tyre's plies run straight across, at roughly right angles to the direction of travel, with a stabilising steel belt beneath the tread. This lets the sidewalls flex without disturbing the tread's contact with the road &mdash; improving grip, comfort and tyre life compared with the cross-ply designs of the time.</p>

      <h2>Reaching the road</h2>
      <p>The radial tyre, badged the Michelin X, made its public debut around 1948&ndash;1949, offered as fitment on models from manufacturers including Peugeot, Citro&euml;n and Simca. From there, radial construction gradually became the industry standard, and other manufacturers developed their own radial designs over the following decades. Today, radial construction is the default for almost all car and van tyres sold in the UK.</p>

      <h2>Why it still matters</h2>
      <p>The basic radial principle from that 1946 patent &mdash; independent flex between tread and sidewall &mdash; is still what's under the tread of the tyres we fit today, nearly eight decades on. It's a reminder that a lot of what keeps modern driving safe and comfortable comes down to engineering most drivers never think about.</p>

      <p>See our <a href="/our-tyre-range/">tyre range</a> for what we currently carry, across a range of brands and price points.</p>`,
  },
  {
    slug: "pirelli-silent-tyres-uk",
    title: "Pirelli PNCS: What The Noise-Reduction Technology Actually Does | SFR Motors Ltd",
    metaDescription: "What Pirelli's PNCS technology is, the noise reduction Pirelli reports, and what to check with us before you book.",
    breadcrumbLabel: "Blog",
    headline: "Pirelli PNCS: What The Noise-Reduction Technology Actually Does",
    bodyHtml: `      <p>Some Pirelli tyres carry a technology called PNCS aimed specifically at reducing the noise you hear inside the car. Here's what it actually is, based on Pirelli's own published information.</p>

      <h2>What PNCS is</h2>
      <p>PNCS &mdash; Pirelli Noise Cancelling System &mdash; is a layer of sound-absorbing foam fitted to the inside of the tyre, against the inner liner. Its purpose is to dampen the resonance that builds up inside the tyre's air cavity as it rolls, which is a major source of the low-frequency "boom" some drivers notice inside the cabin at certain speeds.</p>

      <h2>What Pirelli reports about the reduction</h2>
      <p>According to Pirelli's own published information, PNCS reduces in-cabin noise by around 2&ndash;3 decibels on average, which Pirelli describes as roughly halving the perceived loudness of that cavity-resonance noise. This is Pirelli's own figure for their own technology &mdash; we're reporting it as their claim, not independently verifying it ourselves.</p>

      <h2>What actually changes the outcome</h2>
      <p>How much difference this makes in your specific car depends on more than the tyre &mdash; the vehicle's own insulation, wheel size, suspension and the road surface all play a part. A tyre with excellent noise-reduction technology can still sound different from car to car, so it's realistic to expect a noticeable improvement rather than silence.</p>

      <h2>How to tell if a tyre has it</h2>
      <p>PNCS-equipped tyres carry a specific marking on the sidewall alongside the usual size and specification details. Pirelli has offered PNCS across parts of its range since 2013, though which specific sizes and models include it varies.</p>

      <h2>Checking availability</h2>
      <p>Whether a PNCS-equipped Pirelli tyre is available and suitable for your specific vehicle and size is something we'd confirm with you when you call &mdash; it isn't something we can promise in advance without knowing your vehicle. See our <a href="/our-tyre-range/">tyre range</a> for the brands and options we generally carry, or get in touch with your vehicle details to ask.</p>`,
  },
  {
    slug: "tyre-care-and-flat-tyre-help-in-linlithgow",
    title: "Tyre Care And Flat Tyre Help In Linlithgow | SFR Motors Ltd",
    metaDescription: "Looking after your tyres on Linlithgow's roads, and what to do safely if you get a flat.",
    breadcrumbLabel: "Blog",
    headline: "Tyre Care And Flat Tyre Help In Linlithgow",
    bodyHtml: `      <p>Linlithgow's mix of older town-centre streets and the wider West Lothian roads around it can be tough on tyres. Here's what's worth watching for, and what to do safely if you end up with a flat.</p>

      <h2>Protecting your tyres day to day</h2>
      <p>Older streets and tighter corners around the town centre make kerb strikes an easy way to damage a sidewall without noticing straight away, so it's worth taking corners a little wider where you can. Potholes on some of the surrounding West Lothian roads are another common cause of sudden damage &mdash; slowing down and steering around them where it's safe to do so reduces the risk.</p>

      <h2>Keeping on top of the basics</h2>
      <p>Checking tyre pressure monthly, and watching for a car pulling to one side or a steering vibration, catches most developing problems before they become a breakdown. If you notice uneven wear across a tyre, it's usually worth having the alignment checked rather than just replacing the tyre and hoping it doesn't happen again.</p>

      <h2>If you get a flat tyre</h2>
      <p>Pull over somewhere safe as soon as you reasonably can &mdash; away from moving traffic if possible &mdash; and put your hazard lights on. If you're on a fast road or somewhere that doesn't feel safe to stop, keep going carefully to the next safe place to pull in rather than stopping where you are. We wouldn't recommend attempting a wheel change yourself at the roadside; it's safer, and often just as quick, to call for mobile help and wait somewhere out of the way of traffic.</p>

      <h2>Getting mobile help in Linlithgow</h2>
      <p>See our <a href="/mobile-tyre-fitting-linlithgow/">Linlithgow coverage page</a> for what we offer and how to book, or get in touch with your location and we'll confirm we can reach you and give you an honest estimate of timing.</p>`,
  },
  // ---------------------------------------------------------------- Phase 4B Batch D3
  {
    slug: "tyres-bathgate-technical-breakdown",
    title: "Reading Your Tyre's Sidewall: A Bathgate Guide | SFR Motors Ltd",
    metaDescription: "How to read a tyre size marking, what load and speed ratings mean, and the checks worth doing before you call a fitter.",
    breadcrumbLabel: "Blog",
    headline: "Reading Your Tyre's Sidewall: A Bathgate Guide",
    bodyHtml: `      <p>The numbers and letters moulded into a tyre's sidewall look like a code, but they're worth being able to read at a basic level &mdash; here's what they mean and what to check before calling a fitter.</p>

      <h2>Reading the size marking</h2>
      <p>A marking like 205/55 R16 91V breaks down into a few parts: the first number is the tyre's width in millimetres, the second is the sidewall height as a percentage of that width, "R" followed by a number gives the radial construction and rim diameter in inches, and the final code is the load and speed rating together. Your vehicle's handbook or the sticker inside the driver's door will confirm the correct specification &mdash; that's the reference to use, not a guess.</p>

      <h2>What load and speed ratings mean</h2>
      <p>The load index refers to the maximum weight a single tyre is rated to carry, and the speed rating indicates the maximum speed it's designed to sustain. Both matter for safety, which is why a tyre should match &mdash; not fall below &mdash; your vehicle manufacturer's specified rating. We wouldn't recommend a specific rating without seeing your vehicle's own requirements first.</p>

      <h2>Understanding the date code</h2>
      <p>Tyres also carry a DOT code ending in four digits &mdash; the first two give the week of manufacture, the last two the year. This tells you how old a tyre is, which is useful context, but age alone doesn't tell you whether a specific tyre is safe or unsafe. A well-stored, lightly-used older tyre can be in better condition than a younger one that's seen harder use &mdash; the date code is one piece of information, not a verdict on its own.</p>

      <h2>Checks worth doing yourself</h2>
      <p>Tread depth, visible cracking or bulging, and correct pressure are all worth checking regularly. By law, tyres need at least 1.6mm of tread across the central three-quarters of the tyre, around its entire circumference &mdash; driving below that risks a fine of up to £2,500 and 3 penalty points per illegal tyre, under the Highway Code's vehicle safety requirements. That's a legal minimum, not a target to wait for.</p>

      <h2>Why the handbook and a professional inspection still matter</h2>
      <p>Sidewall markings and date codes give you useful background, but they don't replace an actual inspection. Your vehicle handbook has the specification that applies to your car, and a physical check is the only reliable way to know whether a specific tyre needs attention. If you're not sure what you're looking at, we're happy to take a look on-site.</p>

      <h2>Getting it looked at in Bathgate</h2>
      <p>See our <a href="/mobile-tyre-fitting-bathgate/">Bathgate coverage page</a> to arrange a visit, or our guide on <a href="/best-mobile-tyre-fitters-bathgate/">what to check when picking a mobile tyre fitter in Bathgate</a> if you're comparing options.</p>`,
  },
  {
    slug: "why-tyres-fail-mobile-tyre-fitter-falkirk",
    title: "Why Tyres Fail: Common Causes Explained | SFR Motors Ltd",
    metaDescription: "The most common reasons tyres fail — pressure, load, impact damage, alignment and age — and how to spot the early signs.",
    breadcrumbLabel: "Blog",
    headline: "Why Tyres Fail: Common Causes Explained",
    bodyHtml: `      <p>Tyre failure rarely comes from nowhere &mdash; it's usually the result of one or more ordinary, avoidable factors building up over time. Here's what actually causes it, and what to watch for.</p>

      <h2>Incorrect pressure</h2>
      <p>Under-inflation is one of the most common causes of tyre failure. Running low on air lets a tyre flex more than it's built for, generating heat that weakens its structure over time. Over-inflation causes its own problems, wearing the centre of the tread faster than the edges. A monthly check against your vehicle's recommended pressure catches most of this early.</p>

      <h2>Overloading</h2>
      <p>Every tyre is rated to carry a maximum load, and consistently exceeding that &mdash; a heavily loaded car or van, for example &mdash; adds strain that shows up as faster wear, overheating and a higher risk of failure. Your vehicle's manual has the load limits that apply to your specific vehicle.</p>

      <h2>Impact damage</h2>
      <p>Potholes, kerbs and general road debris can damage a tyre's structure in ways that aren't always obvious straight away. A sharp impact can weaken the sidewall or belt even when the tyre still looks fine afterwards, which is why it's worth having a tyre checked after a hard hit rather than assuming it's fine.</p>

      <h2>Tread and sidewall damage</h2>
      <p>Cuts, bulges and cracking are all warning signs. Sidewall damage in particular isn't repairable &mdash; it needs a replacement rather than a patch, since the sidewall flexes constantly and any weakness there is a genuine safety risk.</p>

      <h2>Alignment and suspension issues</h2>
      <p>Poor wheel alignment or worn suspension components cause uneven wear, often concentrated on one edge of the tyre. Left unchecked, this shortens a tyre's working life considerably and can affect handling and braking too.</p>

      <h2>Age and general condition</h2>
      <p>Rubber changes over time regardless of mileage, so an older tyre can be due attention even with plenty of visible tread left. Cracking, perishing or a change in the rubber's texture are worth checking for alongside tread depth.</p>

      <h2>Getting it checked in Falkirk</h2>
      <p>If you're noticing any of the above, see our <a href="/mobile-tyre-fitting-falkirk/">Falkirk coverage page</a> to arrange an inspection, repair or replacement wherever your vehicle is.</p>`,
  },
  {
    slug: "which-is-the-best-mobile-tyre-fitting-service-provider-in-the-uk",
    title: "What To Look For When Choosing A Mobile Tyre Fitting Service | SFR Motors Ltd",
    metaDescription: "A practical checklist for assessing any mobile tyre fitting provider — coverage, pricing, safety, reviews and more.",
    breadcrumbLabel: "Blog",
    headline: "What To Look For When Choosing A Mobile Tyre Fitting Service",
    bodyHtml: `      <p>Mobile tyre fitting has grown a lot as an industry, and not every provider operates to the same standard. Here's what's genuinely worth checking before you book, whoever you're considering.</p>

      <h2>Clear service-area information</h2>
      <p>A trustworthy provider will tell you plainly whether they cover your location, rather than listing a vague or unrealistically wide area. SFR Motors Ltd operates across Bathgate, Edinburgh, West Lothian and Falkirk &mdash; if you're outside that area, we'll say so rather than promise a visit we can't realistically deliver.</p>

      <h2>Transparent quotation and tyre specification</h2>
      <p>You should be able to get a price and a confirmed tyre specification before a fitter sets off, based on your vehicle's registration or the size on your tyre's sidewall &mdash; not be told a different figure once they've arrived.</p>

      <h2>Safe working practices</h2>
      <p>A proper fitter assesses whether a location is actually safe to work in before starting &mdash; the angle of the ground, the surface, and whether it's safe to be at the roadside at all. A provider who'll work anywhere regardless of the conditions is a red flag, not a selling point.</p>

      <h2>Genuine, independently hosted reviews</h2>
      <p>Reviews tied to a real, independently hosted business profile (such as Google) are far more meaningful than star ratings you can't trace back to anything, or testimonials only ever shown on the provider's own site.</p>

      <h2>Clear contact details</h2>
      <p>A real phone number, a real business address, and a straightforward way to get in touch all matter &mdash; it should be easy to reach a provider before you book, not just after something's gone wrong.</p>

      <h2>Suitable equipment and a proper assessment</h2>
      <p>Fitting, balancing and puncture assessment all need proper equipment, not an improvised setup. A good provider will assess a tyre honestly &mdash; telling you when a repair is possible rather than defaulting to a replacement &mdash; and will be upfront if a job needs specialist tools they carry, or don't.</p>

      <h2>Honest availability information</h2>
      <p>A provider should give you a realistic sense of timing based on your actual location and how busy they are, rather than a blanket promise that doesn't hold up in practice.</p>

      <h2>Getting in touch</h2>
      <p>See our <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> for what we offer, or get in touch with your location and vehicle details and we'll confirm honestly whether we can help.</p>`,
  },
  {
    slug: "how-much-does-mobile-tyre-fitting-cost",
    title: "What Affects The Cost Of Mobile Tyre Fitting | SFR Motors Ltd",
    metaDescription: "What actually determines the cost of a mobile tyre fitting callout — tyre type, vehicle, location and more — explained without invented prices.",
    breadcrumbLabel: "Blog",
    headline: "What Affects The Cost Of Mobile Tyre Fitting",
    bodyHtml: `      <p>"How much will it cost?" is one of the first questions most people ask about mobile tyre fitting, and the honest answer is that it depends on several factors specific to the job. Here's what actually goes into a quote.</p>

      <h2>Tyre size and specification</h2>
      <p>Larger tyres, less common sizes, and higher load or speed ratings generally cost more than standard car sizes, simply because of what's involved in sourcing and fitting them.</p>

      <h2>Tyre brand or product category</h2>
      <p>Premium, mid-range and budget tyres sit at different price points, and which category suits you depends on your vehicle, driving and budget &mdash; not a single right answer for everyone.</p>

      <h2>Vehicle type</h2>
      <p>Cars, vans, 4x4s and light commercials often need different tyre sizes and sometimes different equipment to fit them, which can affect the price.</p>

      <h2>Number of tyres</h2>
      <p>Whether you need a single tyre replaced or a full set fitted changes the overall cost, though not always in a simple multiple &mdash; ask for a quote covering exactly what you need.</p>

      <h2>Location and travel</h2>
      <p>Where you are affects how a callout is priced, since it factors in the technician's time and travel to reach you.</p>

      <h2>Scheduled versus urgent attendance</h2>
      <p>A booked appointment at a convenient time is generally priced differently from an urgent, out-of-hours emergency callout.</p>

      <h2>Puncture assessment versus replacement</h2>
      <p>A repair and a replacement involve different amounts of work, and which one applies to your tyre depends on an on-site assessment &mdash; we'll always tell you honestly which is needed before starting.</p>

      <h2>Locking wheel nut complications</h2>
      <p>If a locking wheel nut key is lost, damaged or the nut is seized, that's additional work beyond a standard fitting, which is reflected in the price.</p>

      <h2>Any additional work</h2>
      <p>Anything beyond the original job &mdash; found during the visit &mdash; would always be confirmed with you before we go ahead, not added afterwards as a surprise.</p>

      <h2>Getting an accurate quote</h2>
      <p>Because pricing depends on all of the above, the only accurate way to get a figure is to contact SFR Motors Ltd directly with your vehicle, tyre details and location. Call <a href="tel:01312020289">0131 202 0289</a>, message us on <a href="https://wa.me/447448427154" target="_blank" rel="noopener">WhatsApp</a>, or use the <a href="/contact-us/#quote-form">quote form</a> and we'll confirm a price before any work starts.</p>`,
  },
];

for (const p of pages) {
  const outDir = path.join(SITE_DIR, p.slug);
  fs.mkdirSync(outDir, { recursive: true });
  const hasFaq = Array.isArray(p.faq) && p.faq.length > 0;
  const html = shell({
    slug: p.slug,
    title: p.title,
    metaDescription: p.metaDescription,
    breadcrumbLabel: p.breadcrumbLabel,
    extraSchema: articleSchema(p.slug, p.headline) + (hasFaq ? faqSchema(p.faq) : ""),
    bodyHtml:
      article({ title: p.headline, bodyHtml: p.bodyHtml }) +
      (hasFaq ? faqHtml(p.faq, p.faqGroup, `${p.slug}-faq-heading`, p.faqTitle) : ""),
  });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`  generated site/${p.slug}/index.html`);
}
