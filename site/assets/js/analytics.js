// SFR Motors Ltd — cookie consent + Google Analytics 4 (consent-gated).
//
// This one file is the whole implementation, loaded on every page:
//   1. Consent: a small first-party banner (Accept / Reject, equal weight)
//      and a "Cookie settings" footer control that reopens it on any page.
//   2. Analytics: Google Analytics 4 (gtag.js) is NOT requested, initialised
//      or given a cookie until the visitor presses "Accept analytics".
//      Rejecting, closing, scrolling, or ignoring the banner never loads it.
//   3. Events: phone/WhatsApp/quote actions are sent only while consent is
//      granted, and never carry a phone number, message text or form data.
//
// The Measurement ID is public by design (it is visible in every GA4 site's
// network tab). It lives here, once, so no page can drift onto another ID.
(function () {
  "use strict";

  var GA_MEASUREMENT_ID = "G-B9TY4GMXYT";
  var GTAG_URL = "https://www.googletagmanager.com/gtag/js?id=";

  // Consent preference: one first-party cookie, essential to this feature.
  // Value format "v1:analytics=granted" | "v1:analytics=denied". Anything
  // else (missing, expired, wrong version) is treated as "no choice yet".
  var CONSENT_COOKIE = "sfr_consent";
  var CONSENT_MAX_AGE = 15552000; // 180 days, in seconds
  var CONSENT_VALUE = /^v1:analytics=(granted|denied)$/;

  var PRIVACY_URL = "/privacy-policy.html";

  // Google Analytics may run ONLY on the two production hostnames. Every other
  // host (localhost, *.vercel.app previews, any staging or temporary hostname)
  // must never feed the live GA4 property, even after "Accept analytics". The
  // banner and the stored choice still work there; only the Google request is
  // skipped. Keep this pattern identical to PRODUCTION_HOST in assets/js/main.js
  // (scripts/verify.js checks that they match).
  var IS_PRODUCTION_HOST = /^(www\.)?sfrmotors\.co\.uk$/.test(window.location.hostname);

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

  function readChoice() {
    var match = CONSENT_VALUE.exec(readCookie(CONSENT_COOKIE) || "");
    return match ? match[1] : memoryChoice;
  }

  function writeChoice(choice) {
    memoryChoice = choice;
    document.cookie =
      CONSENT_COOKIE + "=v1:analytics=" + choice +
      "; Max-Age=" + CONSENT_MAX_AGE + "; Path=/; SameSite=Lax" +
      (window.location.protocol === "https:" ? "; Secure" : "");
  }

  // ---------------------------------------------------------------------
  // Analytics cookie removal (withdrawal / rejection)
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

  // "_ga" and "_ga_<container>" are the only cookies this GA4 set-up writes;
  // "_gid"/"_gat*" are the older Universal Analytics names, cleared as well
  // so a rejecting visitor is left with none of them.
  function clearAnalyticsCookies() {
    var pairs = document.cookie ? document.cookie.split("; ") : [];
    for (var i = 0; i < pairs.length; i++) {
      var name = pairs[i].split("=")[0];
      if (/^_ga(_.+)?$/.test(name) || name === "_gid" || /^_gat/.test(name)) expireCookie(name);
    }
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
    "mobile-tyre-fitting.html",
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
    if (link.closest(".sfr-header")) return "header";
    if (link.closest(".sfr-footer")) return "footer";
    return "page_content";
  }

  // ---------------------------------------------------------------------
  // Google Analytics 4 — only ever started from acceptAnalytics()
  // ---------------------------------------------------------------------
  function gtag() {
    window.dataLayer.push(arguments); // gtag.js requires the `arguments` object itself
  }

  function analyticsActive() {
    return analyticsLoaded && readChoice() === "granted";
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

  function acceptAnalytics() {
    if (analyticsLoaded) {
      window["ga-disable-" + GA_MEASUREMENT_ID] = false;
      return;
    }
    if (!IS_PRODUCTION_HOST) {
      if (window.console && console.info) console.info("[SFR Motors] Preview or local copy: Google Analytics is only loaded on sfrmotors.co.uk.");
      return;
    }
    if (document.querySelector('script[src^="' + GTAG_URL.split("?")[0] + '"]')) return;
    analyticsLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;

    // Analytics only; advertising storage stays off, and Google signals /
    // ad personalisation are switched off for this tag.
    gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    gtag("js", new Date());
    // "config" sends the single automatic page_view for this page.
    gtag("config", GA_MEASUREMENT_ID, {
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

  // Stops the already-loaded tag from sending anything more (including its
  // own end-of-visit engagement ping). Used before the withdrawal reload.
  function disableAnalytics() {
    window["ga-disable-" + GA_MEASUREMENT_ID] = true;
    if (typeof window.gtag === "function") window.gtag("consent", "update", { analytics_storage: "denied" });
  }

  // Another tab may have withdrawn consent while this one stays open.
  document.addEventListener("visibilitychange", function () {
    if (analyticsLoaded && readChoice() !== "granted") disableAnalytics();
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
    var items = panel.querySelectorAll("a[href], button");
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

  function choose(choice) {
    var previous = readChoice();
    var wasLoaded = analyticsLoaded;
    writeChoice(choice);

    if (choice === "granted") {
      acceptAnalytics();
      closePanel(true);
      announce("Analytics cookies are on.");
      return;
    }

    clearAnalyticsCookies();
    if (previous === "granted" && wasLoaded) {
      // gtag.js is already running in this page and cannot be unloaded, so
      // stop it, clear its cookies, then reload for a guaranteed clean page.
      disableAnalytics();
      clearAnalyticsCookies();
      window.location.reload();
      return;
    }
    closePanel(true);
    announce("Analytics cookies are off.");
  }

  function showPanel(mode, opener) {
    if (panel) {
      var existing = panel.querySelector(".sfr-consent__card");
      if (existing) existing.focus();
      return;
    }
    var settings = mode === "settings";
    var choice = readChoice();
    var status = choice === "granted" ? "Analytics cookies are currently on." :
      choice === "denied" ? "Analytics cookies are currently off." : "You have not made a choice yet, so analytics cookies are off.";

    panel = document.createElement("div");
    panel.id = "sfr-consent";
    panel.className = "sfr-consent" + (settings ? " sfr-consent--settings" : "");
    panel.setAttribute("data-mode", mode);
    panel.innerHTML =
      (settings ? '<div class="sfr-consent__scrim" data-sfr-consent-close></div>' : "") +
      '<div class="sfr-consent__card" role="dialog" aria-modal="' + (settings ? "true" : "false") +
      '" aria-labelledby="sfr-consent-title" aria-describedby="sfr-consent-desc" tabindex="-1">' +
        '<p class="sfr-consent__title" id="sfr-consent-title">' + (settings ? "Cookie settings" : "Analytics cookies") + "</p>" +
        '<p class="sfr-consent__text" id="sfr-consent-desc">We would like to use optional Google Analytics cookies to understand how this website is used. ' +
        "They stay off unless you accept, and you can change your choice at any time using &ldquo;Cookie settings&rdquo; in the footer. " +
        '<a href="' + PRIVACY_URL + '">Privacy Policy</a></p>' +
        (settings ? '<p class="sfr-consent__status">' + status + "</p>" : "") +
        '<div class="sfr-consent__actions">' +
          '<button type="button" class="sfr-consent__btn sfr-consent__btn--accept" data-sfr-consent="granted">Accept analytics</button>' +
          '<button type="button" class="sfr-consent__btn sfr-consent__btn--reject" data-sfr-consent="denied">Reject analytics</button>' +
        "</div>" +
        (settings ? '<button type="button" class="sfr-consent__close" data-sfr-consent-close>Close</button>' : "") +
      "</div>";

    panel.addEventListener("click", function (event) {
      var target = event.target.closest ? event.target.closest("[data-sfr-consent],[data-sfr-consent-close]") : null;
      if (!target) return;
      if (target.hasAttribute("data-sfr-consent")) choose(target.getAttribute("data-sfr-consent"));
      else closePanel(true);
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
    var choice = readChoice();
    if (choice === "granted") acceptAnalytics();
    else if (choice === "denied") clearAnalyticsCookies();
    else showPanel("first");

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
