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
      <p>We cover Edinburgh and the surrounding area 24/7 — see our <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh coverage page</a> for details, or our <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> for what's included wherever you're based.</p>`,
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
      <p>For genuine tyre emergencies, our <a href="/emergency-tyre-change/">24/7 emergency tyre change service</a> covers Bathgate, Edinburgh, West Lothian and the surrounding area.</p>`,
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
      <p>See our <a href="/mobile-tyre-fitting-bathgate/">Bathgate coverage page</a> for what we offer, or get in touch for a price.</p>`,
  },
  {
    slug: "tyre-fitting-edinburgh-expert-technical-aspects-you-must-know",
    title: "Tyre Fitting In Edinburgh: Technical Aspects You Must Know | SFR Motors Ltd",
    metaDescription: "Load ratings, torque settings, balancing and TPMS resets — the technical side of a proper tyre fitting job, explained for Edinburgh drivers.",
    breadcrumbLabel: "Blog",
    headline: "Tyre Fitting In Edinburgh: Technical Aspects You Must Know",
    bodyHtml: `      <p>A tyre fitting job is more than bolting on a new tyre. Here's what should actually happen for it to be done properly.</p>

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
    slug: "behind-the-scenes-what-tools-do-mobile-tyre-fitters-really-use",
    title: "Behind The Scenes: What Tools Do Mobile Tyre Fitters Really Use? | SFR Motors Ltd",
    metaDescription: "A look at the equipment a well-equipped mobile tyre fitting van typically carries, from tyre changers to torque wrenches.",
    breadcrumbLabel: "Blog",
    headline: "Behind The Scenes: What Tools Do Mobile Tyre Fitters Really Use?",
    bodyHtml: `      <p>A mobile tyre fitting van needs to carry a genuine workshop's worth of kit — just portable. Here's what a well-equipped one typically has on board.</p>

      <h2>A portable tyre changer</h2>
      <p>Removes the old tyre from the wheel rim and seats the new one, without damaging the rim — the core piece of equipment for any fitting job.</p>

      <h2>A wheel balancer</h2>
      <p>Checks and corrects the wheel's balance after a new tyre is fitted, so the vehicle doesn't vibrate at speed.</p>

      <h2>An impact wrench and torque wrench</h2>
      <p>The impact wrench removes wheel nuts quickly; the torque wrench does the final tightening to the exact figure the vehicle manufacturer specifies — two different jobs, two different tools.</p>

      <h2>A compressor</h2>
      <p>For inflating new tyres to the correct pressure and, where needed, topping up others during the same visit.</p>

      <h2>TPMS tools</h2>
      <p>For resetting or checking the tyre pressure monitoring system after a tyre change, where the vehicle needs it.</p>

      <h2>Why this matters</h2>
      <p>The right equipment, used properly, is the difference between a tyre that's fitted and one that's fitted safely. See our <a href="/mobile-tyre-fitting/">mobile tyre fitting service</a> for what's included.</p>`,
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
      <p>Tread depth below 1.6mm, visible cracking or bulging, or noticeable vibration are all signs it's time — see our <a href="/mobile-tyre-replacement/">tyre replacement service</a> or <a href="/our-tyre-range/">tyre range</a> for options.</p>

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
      <p>No spare, a locked wheel nut with no key, an unsafe location, or simply not wanting to do it yourself — any of these are good reasons to call us instead. See our <a href="/emergency-tyre-change/">emergency tyre change service</a> covering West Lothian 24/7.</p>`,
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
      <p>We offer mobile locking wheel nut removal across Bathgate and West Lothian, 24/7 — see our <a href="/mobile-locking-wheel-nut-removal/">locking wheel nut removal service</a> for details.</p>`,
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
      <p>Our <a href="/emergency-tyre-change/">emergency tyre change service</a> covers Bathgate, <a href="/mobile-tyre-fitting-edinburgh/">Edinburgh</a>, <a href="/mobile-tyre-fitting-falkirk/">Falkirk</a> and the surrounding area, 24/7.</p>`,
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
];

for (const p of pages) {
  const outDir = path.join(SITE_DIR, p.slug);
  fs.mkdirSync(outDir, { recursive: true });
  const html = shell({
    slug: p.slug,
    title: p.title,
    metaDescription: p.metaDescription,
    breadcrumbLabel: p.breadcrumbLabel,
    extraSchema: articleSchema(p.slug, p.headline),
    bodyHtml: article({ title: p.headline, bodyHtml: p.bodyHtml }),
  });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`  generated site/${p.slug}/index.html`);
}
