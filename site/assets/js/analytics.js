// SFR Motors Ltd — cookie consent (two categories) + Google Analytics 4 + Google Ads/Tag Manager,
// implementing Google Consent Mode v2 ("advanced" mode).
//
// This one file is the whole implementation, loaded on every page:
//   1. Consent: a first-party banner with two separate, clearly labelled categories —
//      "Analytics" and "Advertising / Google Ads" — each on by default OFF, plus an
//      "Accept all" / "Reject all" pair and a "Cookie settings" footer control that
//      reopens the same panel on any page so a choice can be changed at any time.
//   2. Consent Mode v2 (advanced): on every visit to the production host, before anything
//      else, we declare Google's four consent signals as "denied" and load Google Tag
//      Manager anyway. GTM (and the Google Ads tags it carries) can then send Google a
//      cookieless, consent-respecting ping on every page — enough for Google's own
//      modelling of conversions — but it cannot set an identifying cookie or store
//      personal data until the visitor actually accepts. Accepting "Advertising / Google
//      Ads" updates the ad_storage/ad_user_data signals to "granted"; accepting
//      "Analytics" updates analytics_storage to "granted" and loads Google Analytics 4
//      (gtag.js) itself, which is NOT requested, initialised or given a cookie before then.
//   3. Events: phone/WhatsApp/quote actions are sent to Google Analytics only while the
//      Analytics category is granted, and never carry a phone number, message text or
//      form data.
//
// The Measurement ID and GTM container ID are public by design (visible in every such
// site's network tab). They live here, once, so no page can drift onto a different ID.
(function () {
  "use strict";

  var GA_MEASUREMENT_ID = "G-B9TY4GMXYT";
  var GTAG_URL = "https://www.googletagmanager.com/gtag/js?id=";

  // Google Ads / Google Tag Manager (owner request, 2026-09-29): same container as
  // sfrmotors.uk, so call/WhatsApp clicks can be measured as Google Ads conversions.
  var GTM_ID = "GTM-WZ6S5SHX";
  var GTM_URL = "https://www.googletagmanager.com/gtm.js?id=";

  // Consent preference: one first-party cookie, essential to this feature. Value format
  // "v2:analytics=granted|ads=denied" (any combination of granted/denied for each) — "|" is used
  // between the two categories, not ";", because ";" is a cookie-attribute separator: a literal
  // semicolon inside a cookie's own value truncates it (this shipped as a bug once, caught in testing).
  // Anything else (missing, expired, wrong version) is treated as "no choice yet".
  var CONSENT_COOKIE = "sfr_consent";
  var CONSENT_MAX_AGE = 15552000; // 180 days, in seconds
  var CONSENT_VALUE = /^v2:analytics=(granted|denied)\|ads=(granted|denied)$/;

  var PRIVACY_URL = "/privacy-policy.html";

  // Google may run ONLY on the two production hostnames. Every other host (localhost,
  // *.vercel.app previews, any staging or temporary hostname) must never feed the live
  // GA4/Google Ads accounts, even after accepting. The banner and the stored choice still
  // work there; only the Google requests are skipped. Keep this pattern identical to
  // PRODUCTION_HOST in assets/js/main.js (scripts/verify.js checks that they match).
  var IS_PRODUCTION_HOST = /^(www\.)?sfrmotors\.co\.uk$/.test(window.location.hostname);

  var consentModeStarted = false;
  var gtmLoaded = false;
  var analyticsLoaded = false;
  var memoryChoice = null; // used only if the browser refuses to store the cookie
  var panel = null;
  var panelOpener = null;
  var liveRegion = null;

  // ---------------------------------------------------------------------
  // Consent storage
  // ---------------------------------------------------------------------
  function readCookie(name) {
    var pairs = document.cookie ? document.cookie.split("; ") : [];
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf("=");
      if (eq !== -1 && pairs[i].slice(0, eq) === name) return pairs[i].slice(eq + 1);
    }
    return null;
  }

  // Returns { analytics: "granted"|"denied", ads: "granted"|"denied" } — both "denied"
  // when no valid choice has been stored yet (nothing is granted until the visitor acts).
  function readChoice() {
    var match = CONSENT_VALUE.exec(readCookie(CONSENT_COOKIE) || "");
    if (match) return { analytics: match[1], ads: match[2] };
    if (memoryChoice) return memoryChoice;
    return { analytics: "denied", ads: "denied" };
  }

  // null means "no choice has ever been made" (used only to decide whether to show the
  // first-visit banner); readChoice() above always returns concrete denied/granted values.
  function hasStoredChoice() {
    return CONSENT_VALUE.test(readCookie(CONSENT_COOKIE) || "") || !!memoryChoice;
  }

  function writeChoice(analytics, ads) {
    memoryChoice = { analytics: analytics, ads: ads };
    document.cookie =
      CONSENT_COOKIE + "=v2:analytics=" + analytics + "|ads=" + ads +
      "; Max-Age=" + CONSENT_MAX_AGE + "; Path=/; SameSite=Lax" +
      (window.location.protocol === "https:" ? "; Secure" : "");
  }

  // ---------------------------------------------------------------------
  // Cookie removal (withdrawal / rejection), split by category so rejecting one never
  // touches the other's cookies.
  // ---------------------------------------------------------------------
  function expireCookie(name) {
    var host = window.location.hostname;
    var domains = [null, host];
    if (host.indexOf(".") !== -1 && !/^[\d.]+$/.test(host)) {
      var parts = host.split(".");
      // GA writes its cookies on the registrable parent domain, so try each
      // parent (a browser silently ignores any it will not let us touch).
      for (var i = 0; i < parts.length - 1; i++) domains.push("." + parts.slice(i).join("."));
    }
    for (var j = 0; j < domains.length; j++) {
      document.cookie =
        name + "=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/" +
        (domains[j] ? "; Domain=" + domains[j] : "");
    }
  }

  function expireMatching(pattern) {
    var pairs = document.cookie ? document.cookie.split("; ") : [];
    for (var i = 0; i < pairs.length; i++) {
      var name = pairs[i].split("=")[0];
      if (pattern.test(name)) expireCookie(name);
    }
  }

  // "_ga" and "_ga_<container>" are the cookies GA4 writes; "_gid"/"_gat*" are the older
  // Universal Analytics names, cleared as well.
  function clearGACookies() {
    expireMatching(/^_ga(_.+)?$/);
    expireMatching(/^_gid$/);
    expireMatching(/^_gat/);
  }

  // "_gcl_au"/"_gcl_aw"/"_gac_*" are Google Ads' own click-id cookies, written once GTM runs.
  function clearAdsCookies() {
    expireMatching(/^_gcl_/);
    expireMatching(/^_gac_/);
  }

  // ---------------------------------------------------------------------
  // Page classification (unchanged behaviour; used to segment GA4 reports)
  // ---------------------------------------------------------------------
  var LOCATION_PAGES = [
    "mobile-tyre-fitting-bathgate.html",
    "mobile-tyre-fitting-edinburgh.html",
    "mobile-tyre-fitting-livingston.html",
    "mobile-tyre-fitting-west-lothian.html",
    "mobile-tyre-fitting-falkirk.html"
  ];
  var SERVICE_PAGES = [
    "mobile-tyre-replacement.html",
    "mobile-puncture-repair.html",
    "emergency-tyre-change.html",
    "mobile-locking-wheel-nut-removal.html",
    "trade-fleet-tyre-services.html",
    "van-tyre-replacement.html",
    "caravan-trailer-tyre-fitting.html",
    "tpms-services.html"
  ];
  // Service pages whose canonical URL is a CloudFront pretty path, so the
  // last "/"-segment is empty and the filename lookup above cannot match.
  var SERVICE_PRETTY_PATHS = [
    "/mobile-tyre-fitting/",
    "/mobile-tyre-fitting",
    "/mobile-trailer-and-caravan-tyre-fitting/",
    "/mobile-trailer-and-caravan-tyre-fitting",
    "/mobile-tyre-puncture-repair/",
    "/mobile-tyre-puncture-repair",
    "/tyre-pressure-monitoring-system/",
    "/tyre-pressure-monitoring-system",
    "/van-tyre-replacement-services/",
    "/van-tyre-replacement-services"
  ];

  function currentPageFile() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function isContactPage() {
    var path = window.location.pathname;
    return path === "/contact-us/" || path === "/contact-us" || currentPageFile() === "contact.html";
  }

  function pageType() {
    if (SERVICE_PRETTY_PATHS.indexOf(window.location.pathname) !== -1) return "service";
    var page = currentPageFile();
    if (LOCATION_PAGES.indexOf(page) !== -1) return "location";
    if (SERVICE_PAGES.indexOf(page) !== -1) return "service";
    return "core";
  }

  // Where on the page a link sits — reliable because every page shares the
  // same top bar / header / footer landmarks.
  function linkLocation(link) {
    if (link.closest(".sfr-topbar")) return "top_bar";
    if (link.closest(".sfr-callbar")) return "call_bar";
    if (link.closest(".sfr-header")) return "header";
    if (link.closest(".sfr-footer")) return "footer";
    return "page_content";
  }

  // ---------------------------------------------------------------------
  // Google Consent Mode v2 + Google Tag Manager — started unconditionally from init()
  // ---------------------------------------------------------------------
  function gtag() {
    window.dataLayer.push(arguments); // gtag.js requires the `arguments` object itself
  }

  // Runs once, on every page load, on the production host only — before any consent
  // decision is known. Declares Google's four signals "denied" by default (nothing is
  // granted until the visitor actually accepts a category) and loads GTM regardless, so
  // Google Ads can model conversions from cookieless, consent-respecting pings even for a
  // visitor who has not yet chosen or who rejects. See the file header for the full picture.
  function startConsentMode() {
    if (consentModeStarted || !IS_PRODUCTION_HOST) return;
    consentModeStarted = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;

    gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });

    loadGTM();
  }

  function loadGTM() {
    if (gtmLoaded || !IS_PRODUCTION_HOST) return;
    if (document.querySelector('script[src^="' + GTM_URL + '"]')) return;
    gtmLoaded = true;
    // Pushed as a plain object (not via gtag()'s arguments wrapper): GTM's own loader reads
    // this exact shape from the front of dataLayer to time itself, same as Google's own snippet.
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var gtmLoader = document.createElement("script");
    gtmLoader.async = true;
    gtmLoader.src = GTM_URL + encodeURIComponent(GTM_ID);
    document.head.appendChild(gtmLoader);
  }

  // Updates the two advertising consent signals. ad_personalization stays "denied" even
  // after accepting: this Google Ads set-up only measures which advert led to a call,
  // WhatsApp message or quote request — it does not build advertising profiles or
  // retarget visitors elsewhere.
  function applyAdsConsent(granted) {
    if (!IS_PRODUCTION_HOST || typeof window.gtag !== "function") return;
    window.gtag("consent", "update", {
      ad_storage: granted ? "granted" : "denied",
      ad_user_data: granted ? "granted" : "denied"
    });
    if (granted) installCallTracking();
  }

  // Google Ads "website call conversion tracking" (owner request, 2026-09-29): swaps the
  // displayed phone number for a Google forwarding number so Google can count answered
  // calls to it as conversions. Conversion "Call (0131 202 0289)",
  // AW-16776239836/l76yCKqPuYkdENy1xL8-. Only called from applyAdsConsent(true) above, so it
  // stays behind the "Advertising / Google Ads" consent category and never runs on a
  // non-production host.
  var callTrackingInstalled = false;
  function installCallTracking() {
    if (callTrackingInstalled) return;
    callTrackingInstalled = true;
    window.gtag("config", "AW-16776239836/l76yCKqPuYkdENy1xL8-", { phone_conversion_number: "0131 202 0289" });
  }

  // ---------------------------------------------------------------------
  // Google Analytics 4 — only ever started once the "Analytics" category is granted
  // ---------------------------------------------------------------------
  function analyticsActive() {
    return analyticsLoaded && readChoice().analytics === "granted";
  }

  function track(name, params) {
    if (!analyticsActive()) return;
    var data = { page_path: window.location.pathname, page_type: pageType() };
    for (var key in params) if (Object.prototype.hasOwnProperty.call(params, key)) data[key] = params[key];
    window.gtag("event", name, data);
  }

  function onClick(event) {
    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";
    var where = linkLocation(link);

    // Phone and WhatsApp events carry only where the click happened — never
    // the number, the link text or the link URL.
    if (href.toLowerCase().indexOf("tel:") === 0) {
      track("phone_click", { link_location: where });
    } else if (link.protocol === "https:" && link.hostname === "wa.me") {
      track("whatsapp_click", { link_location: where });
    } else if (href.indexOf("#quote-form") !== -1) {
      track("cta_click", { link_location: where, link_text: (link.textContent || "").trim().slice(0, 60) });
    } else if (link.closest(".sfr-nav__links")) {
      track("nav_click", { link_location: where, link_text: (link.textContent || "").trim().slice(0, 60) });
    }
  }

  // Fired by assets/js/main.js only after a genuine quote/contact submission
  // (never on the honeypot path). Carries no form content at all.
  function onQuoteSubmitted() {
    track("quote_request", {});
    if (isContactPage()) track("contact_form_submit", {});
  }

  // Stops the already-loaded GA4 tag from sending anything more (including its own
  // end-of-visit engagement ping) — the documented way to fully silence gtag.js mid-page,
  // used when a visitor downgrades Analytics from granted to denied.
  function disableAnalyticsTag() {
    window["ga-disable-" + GA_MEASUREMENT_ID] = true;
    if (typeof window.gtag === "function") window.gtag("consent", "update", { analytics_storage: "denied" });
  }

  function applyAnalyticsConsent(granted) {
    if (!granted) {
      if (typeof window.gtag === "function") window.gtag("consent", "update", { analytics_storage: "denied" });
      return;
    }
    if (!IS_PRODUCTION_HOST || typeof window.gtag !== "function") return;
    window.gtag("consent", "update", { analytics_storage: "granted" });

    if (analyticsLoaded) return;
    if (document.querySelector('script[src^="' + GTAG_URL.split("?")[0] + '"]')) return;
    analyticsLoaded = true;

    window.gtag("js", new Date());
    // "config" sends the single automatic page_view for this page.
    window.gtag("config", GA_MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_type: pageType()
    });

    var loader = document.createElement("script");
    loader.async = true;
    loader.src = GTAG_URL + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(loader);

    document.addEventListener("click", onClick);
    document.addEventListener("sfr:quote-submitted", onQuoteSubmitted);
  }

  // Another tab may have changed consent while this one stays open.
  document.addEventListener("visibilitychange", function () {
    var choice = readChoice();
    if (analyticsLoaded && choice.analytics !== "granted") disableAnalyticsTag();
  });

  // ---------------------------------------------------------------------
  // Consent banner / Cookie settings dialog
  // ---------------------------------------------------------------------
  function announce(message) {
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.className = "sfr-sr-only";
      liveRegion.setAttribute("role", "status");
      liveRegion.setAttribute("aria-live", "polite");
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = "";
    window.setTimeout(function () { liveRegion.textContent = message; }, 50);
  }

  function closePanel(restoreFocus) {
    if (!panel) return;
    document.removeEventListener("keydown", onPanelKeydown, true);
    panel.parentNode.removeChild(panel);
    panel = null;
    if (restoreFocus && panelOpener && document.body.contains(panelOpener)) panelOpener.focus();
    panelOpener = null;
  }

  function onPanelKeydown(event) {
    if (!panel) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel(true); // closing never changes the stored choice
      return;
    }
    if (event.key !== "Tab") return;
    var items = panel.querySelectorAll("a[href], button, input");
    var card = panel.querySelector(".sfr-consent__card");
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === card)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Applies one saved choice for both categories, updates cookies/tags accordingly, closes
  // the panel and tells screen-reader users what happened.
  function save(analytics, ads) {
    var wasAnalyticsLoaded = analyticsLoaded;
    writeChoice(analytics, ads);

    applyAdsConsent(ads === "granted");
    if (ads !== "granted") clearAdsCookies();

    if (analytics === "granted") {
      applyAnalyticsConsent(true);
      closePanel(true);
      announce(ads === "granted" ? "All cookies are on." : "Your cookie choices have been saved.");
      return;
    }

    clearGACookies();
    if (wasAnalyticsLoaded) {
      // GA4 is already running on this page and cannot be unloaded, so stop it, clear its
      // cookies, then reload for a guaranteed clean page (GTM itself is unaffected and stays
      // loaded — only its consent signals changed, which it applies live, no reload needed).
      disableAnalyticsTag();
      clearGACookies();
      window.location.reload();
      return;
    }
    closePanel(true);
    announce(ads === "granted" ? "Your cookie choices have been saved." : "All optional cookies are off.");
  }

  function showPanel(mode, opener) {
    if (panel) {
      var existing = panel.querySelector(".sfr-consent__card");
      if (existing) existing.focus();
      return;
    }
    var settings = mode === "settings";
    var choice = readChoice();

    panel = document.createElement("div");
    panel.id = "sfr-consent";
    panel.className = "sfr-consent" + (settings ? " sfr-consent--settings" : "");
    panel.setAttribute("data-mode", mode);
    panel.innerHTML =
      (settings ? '<div class="sfr-consent__scrim" data-sfr-consent-close></div>' : "") +
      '<div class="sfr-consent__card" role="dialog" aria-modal="' + (settings ? "true" : "false") +
      '" aria-labelledby="sfr-consent-title" aria-describedby="sfr-consent-desc" tabindex="-1">' +
        '<p class="sfr-consent__title" id="sfr-consent-title">Cookie settings</p>' +
        '<p class="sfr-consent__text" id="sfr-consent-desc">We use optional cookies to understand how this website is used and to measure which Google adverts bring visitors here. ' +
        "Both stay off unless you choose to turn them on, and you can change your choice at any time using &ldquo;Cookie settings&rdquo; in the footer. " +
        '<a href="' + PRIVACY_URL + '">Privacy Policy</a></p>' +
        '<div class="sfr-consent__categories">' +
          '<div class="sfr-consent__category">' +
            '<label class="sfr-consent__toggle">' +
              '<input type="checkbox" data-sfr-consent-cat="analytics"' + (choice.analytics === "granted" ? " checked" : "") + '>' +
              '<span class="sfr-consent__cat-name">Analytics</span>' +
            "</label>" +
            '<p class="sfr-consent__cat-desc">Google Analytics: helps us understand how visitors use the site.</p>' +
          "</div>" +
          '<div class="sfr-consent__category">' +
            '<label class="sfr-consent__toggle">' +
              '<input type="checkbox" data-sfr-consent-cat="ads"' + (choice.ads === "granted" ? " checked" : "") + '>' +
              '<span class="sfr-consent__cat-name">Advertising / Google Ads</span>' +
            "</label>" +
            '<p class="sfr-consent__cat-desc">Google Ads &amp; Tag Manager: measures which advert led to a call, WhatsApp message or quote request.</p>' +
          "</div>" +
        "</div>" +
        '<div class="sfr-consent__actions">' +
          '<button type="button" class="sfr-consent__btn sfr-consent__btn--accept" data-sfr-consent-all="granted">Accept all</button>' +
          '<button type="button" class="sfr-consent__btn sfr-consent__btn--reject" data-sfr-consent-all="denied">Reject all</button>' +
          '<button type="button" class="sfr-consent__btn sfr-consent__btn--save" data-sfr-consent-save>Save my choices</button>' +
        "</div>" +
        (settings ? '<button type="button" class="sfr-consent__close" data-sfr-consent-close>Close</button>' : "") +
      "</div>";

    panel.addEventListener("click", function (event) {
      var target = event.target.closest ? event.target.closest("[data-sfr-consent-all],[data-sfr-consent-save],[data-sfr-consent-close]") : null;
      if (!target) return;
      if (target.hasAttribute("data-sfr-consent-all")) {
        var v = target.getAttribute("data-sfr-consent-all");
        save(v, v);
      } else if (target.hasAttribute("data-sfr-consent-save")) {
        var analyticsBox = panel.querySelector('[data-sfr-consent-cat="analytics"]');
        var adsBox = panel.querySelector('[data-sfr-consent-cat="ads"]');
        save(analyticsBox && analyticsBox.checked ? "granted" : "denied", adsBox && adsBox.checked ? "granted" : "denied");
      } else {
        closePanel(true); // closing never changes the stored choice
      }
    });

    // First in the DOM, so keyboard and screen-reader users reach the
    // choice before the rest of the page; it is fixed to the bottom visually.
    document.body.insertBefore(panel, document.body.firstChild);

    if (settings) {
      panelOpener = opener || null;
      document.addEventListener("keydown", onPanelKeydown, true);
      panel.querySelector(".sfr-consent__card").focus();
    }
  }

  // ---------------------------------------------------------------------
  // Start-up
  // ---------------------------------------------------------------------
  function init() {
    startConsentMode();

    var choice = readChoice();
    if (choice.analytics === "granted") applyAnalyticsConsent(true);
    if (choice.ads === "granted") applyAdsConsent(true);
    if (!hasStoredChoice()) showPanel("first");

    var openers = document.querySelectorAll("[data-sfr-cookie-settings]");
    for (var i = 0; i < openers.length; i++) {
      openers[i].hidden = false; // hidden in the HTML so it never shows without JS
      openers[i].addEventListener("click", function (event) {
        showPanel("settings", event.currentTarget);
      });
    }
  }

  init();
})();
