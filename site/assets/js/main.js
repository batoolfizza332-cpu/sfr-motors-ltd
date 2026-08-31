// SFR Motors Ltd — site scripts (vanilla JS, no dependencies)
(function () {
  "use strict";

  // ---- Mobile nav toggle ----
  var toggle = document.querySelector(".sfr-nav__toggle");
  var nav = document.querySelector(".sfr-nav");
  if (toggle && nav) {
    var closeNav = function () {
      nav.setAttribute("data-open", "false");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    };
    toggle.addEventListener("click", function () {
      var open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    });
    nav.querySelectorAll(".sfr-nav__links a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
    // Escape closes the open mobile menu and returns focus to the toggle,
    // so keyboard users are never left with an open menu they can't dismiss.
    nav.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.getAttribute("data-open") === "true") {
        closeNav();
        toggle.focus();
      }
    });
  }

  // ---- Quote / contact form ----
  // Enquiries go straight to SFR Motors' WhatsApp as a pre-filled message —
  // there's no backend to send them to instead. Do not add one back in
  // without also wiring up a real success/failure state; a WhatsApp deep
  // link either opens or it doesn't, and the user can see which happened.
  var WHATSAPP_NUMBER = "447448427154";

  var form = document.getElementById("quote-form-el");
  if (!form) return;

  // Timestamp the form's first render, so a submission arriving faster
  // than a human could plausibly fill the form in gets silently treated
  // like the honeypot case below — a lightweight bot check now that
  // there's no server left to do it.
  var formRenderedAt = Date.now();
  var MIN_FILL_TIME_MS = 1500;

  var statusEl = document.getElementById("quote-form-status");

  function setStatus(state, message) {
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }

  function fieldOrFallback(value) {
    return value && value.trim() ? value.trim() : "Not specified";
  }

  function formatDate(isoDate) {
    if (!isoDate) return "Not specified";
    var parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function buildWhatsAppMessage(data) {
    return [
      "SFR MOTORS — NEW QUOTE REQUEST",
      "",
      "Name: " + fieldOrFallback(data.name),
      "Phone: " + fieldOrFallback(data.phone),
      "Service: " + fieldOrFallback(data.service),
      "Vehicle: " + fieldOrFallback(data.vehicle),
      "Registration: " + fieldOrFallback(data.vehicleReg),
      "Tyre Size: " + fieldOrFallback(data.tyreSize),
      "Number of Tyres: " + fieldOrFallback(data.tyreCount),
      "Location: " + fieldOrFallback(data.location),
      "Preferred Date: " + formatDate(data.preferredDate),
      "Preferred Time: " + fieldOrFallback(data.preferredTime),
      "",
      "Additional Information:",
      fieldOrFallback(data.message)
    ].join("\n");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var data = Object.fromEntries(new FormData(form).entries());
    var elapsedMs = Date.now() - formRenderedAt;

    // Honeypot + too-fast-to-be-human: real visitors never trip either of
    // these, so treat both the same way — pretend it worked without
    // opening WhatsApp, rather than tipping a bot off that it was caught.
    if (data.company || elapsedMs < MIN_FILL_TIME_MS) {
      form.reset();
      setStatus(
        "success",
        "Thank you. Your request has been received. SFR Motors will contact you shortly. For urgent assistance, please call us directly."
      );
      return;
    }

    if (!data.name || !data.phone || !data.service || !data.location) {
      setStatus("error", "Please fill in your name, phone number, service and current location.");
      return;
    }

    var message = buildWhatsAppMessage(data);
    var whatsappUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);

    // wa.me handles the mobile-app-vs-WhatsApp-Web split on its own based
    // on the device opening it — no user-agent sniffing needed here.
    window.open(whatsappUrl, "_blank", "noopener");

    form.reset();
    setStatus(
      "success",
      "Opening WhatsApp with your enquiry filled in — just check it over and press Send to reach us. Didn't open? Message us directly on WhatsApp below."
    );

    // Lets assets/js/analytics.js fire its quote_request /
    // contact_form_submit conversion events — only reached here, on a
    // genuine attempt to reach us, never on the honeypot/bot-timing
    // silent-success path above, so bot traffic can't inflate the numbers.
    document.dispatchEvent(new CustomEvent("sfr:quote-submitted"));
  });
})();
