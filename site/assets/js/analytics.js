// SFR Motors Ltd — Google Analytics 4 + conversion event tracking.
//
// Loads gtag.js asynchronously (never blocks rendering) and wires up
// listeners for the site's key conversion actions. Only the fact that an
// action happened is ever sent — never anything typed into a form (name,
// phone number, email, message). No cookies or IDs are set by this file
// itself; that's entirely gtag.js's own standard behaviour.
(function () {
  "use strict";

  // Set this to your real GA4 Measurement ID (Google Analytics ->
  // Admin -> Data Streams -> your web stream) before going live. It is
  // not a secret — Measurement IDs are public by design, visible in any
  // browser's network tab on every GA4 site — but it's kept as a single
  // named placeholder here rather than hard-coded into every page, so
  // there's exactly one place to configure and no risk of pages drifting
  // out of sync with different IDs.
  var GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === "G-XXXXXXXXXX") {
    console.warn(
      "[SFR Motors] Analytics not configured — set GA_MEASUREMENT_ID in assets/js/analytics.js. No tracking requests will be sent until then."
    );
    return;
  }

  // ---- Classify the current page (lets service/location visits and ----
  // ---- conversions be segmented in GA4 reports without per-page setup) ----
  // Keyed by the first path segment of the clean URL (e.g. "/mobile-tyre-fitting-bathgate/"
  // -> "mobile-tyre-fitting-bathgate"), not filenames — every page lives at
  // /<slug>/ since the Phase 3 URL restructure.
  var LOCATION_SLUGS = [
    "mobile-tyre-fitting-bathgate",
    "mobile-tyre-fitting-edinburgh",
    "mobile-tyre-fitting-livingston",
    "mobile-tyre-fitting-west-lothian",
    "mobile-tyre-fitting-falkirk",
    "mobile-tyre-fitting-armadale",
    "mobile-tyre-fitting-whitburn",
    "mobile-tyre-fitting-airdrie"
  ];
  var SERVICE_SLUGS = [
    "mobile-tyre-fitting",
    "mobile-tyre-replacement",
    "mobile-tyre-puncture-repair",
    "emergency-tyre-change",
    "mobile-locking-wheel-nut-removal",
    "trade-fleet-tyre-services",
    "van-tyre-replacement-services",
    "caravan-trailer-tyre-fitting",
    "tpms-services",
    "our-tyre-range"
  ];

  function currentPageSlug() {
    var segs = window.location.pathname.split("/").filter(Boolean);
    return segs.length ? segs[0] : ""; // "" = homepage
  }

  function pageType() {
    var slug = currentPageSlug();
    if (LOCATION_SLUGS.indexOf(slug) !== -1) return "location";
    if (SERVICE_SLUGS.indexOf(slug) !== -1) return "service";
    if (slug === "blog") return "blog";
    return "core";
  }

  // ---- Bootstrap gtag.js (standard Google snippet, loaded async) ----
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    page_type: pageType()
  });

  var loader = document.createElement("script");
  loader.async = true;
  loader.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(loader);

  // ---- Conversion + engagement events ----
  // Delegated to document so it works for every link on the page,
  // including ones added or changed later, with a single listener.
  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a") : null;
    if (!link) return;

    var href = link.getAttribute("href") || "";
    var label = (link.textContent || "").trim();

    if (href.indexOf("tel:") === 0) {
      gtag("event", "phone_click", {
        link_text: label,
        link_url: href,
        page_type: pageType()
      });
      return;
    }

    if (href.indexOf("https://wa.me/") === 0) {
      gtag("event", "whatsapp_click", {
        link_text: label,
        link_url: href,
        page_type: pageType()
      });
      return;
    }

    // Any "Get A Free Quote" / "Request A Free Quote" / etc. link that
    // points at the quote form, wherever its wording varies per page.
    if (href.indexOf("#quote-form") !== -1) {
      gtag("event", "cta_click", {
        link_text: label,
        link_url: href,
        page_type: pageType()
      });
      return;
    }

    if (link.closest(".sfr-nav__links")) {
      gtag("event", "nav_click", {
        link_text: label,
        link_url: href,
        page_type: pageType()
      });
    }
  });

  // Fired by assets/js/main.js only after a quote/contact form submission
  // has genuinely succeeded — never on the honeypot's silent-success path,
  // so bot traffic can't inflate conversion counts.
  document.addEventListener("sfr:quote-submitted", function () {
    gtag("event", "quote_request", { page_type: pageType() });

    if (currentPageSlug() === "contact-us") {
      gtag("event", "contact_form_submit", { page_type: pageType() });
    }
  });
})();
