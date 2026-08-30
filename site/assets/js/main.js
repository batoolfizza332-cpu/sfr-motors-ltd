// SFR Motors Ltd — site scripts (vanilla JS, no dependencies)
(function () {
  "use strict";

  // ---- Mobile nav toggle ----
  var toggle = document.querySelector(".sfr-nav__toggle");
  var nav = document.querySelector(".sfr-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
    });
    nav.querySelectorAll(".sfr-nav__links a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---- Quote / contact form ----
  // Set this to your deployed API Gateway endpoint (see backend/README.md).
  var QUOTE_API_ENDPOINT = "https://api.sfrmotors.co.uk/quote";

  var form = document.getElementById("quote-form-el");
  if (!form) return;

  var statusEl = document.getElementById("quote-form-status");
  var submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(state, message) {
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var data = Object.fromEntries(new FormData(form).entries());

    // Honeypot: real visitors never fill this hidden field.
    // Bots typically fill every field, so if it has a value we
    // silently pretend success without ever hitting the API.
    if (data.company) {
      form.reset();
      setStatus("success", "Thanks — we'll be in touch shortly.");
      return;
    }

    if (!data.name || !data.phone || !data.service || !data.location) {
      setStatus("error", "Please fill in your name, phone number, service and current location.");
      return;
    }

    var defaultLabel = "Request A Free Quote";
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    setStatus("", "");
    statusEl.removeAttribute("data-state");

    fetch(QUOTE_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        email: data.email || "",
        vehicleReg: data.vehicleReg || "",
        vehicle: data.vehicle || "",
        tyreSize: data.tyreSize || "",
        service: data.service,
        location: data.location,
        preferredDate: data.preferredDate || "",
        preferredTime: data.preferredTime || "",
        message: data.message || "",
        company: data.company || "" // honeypot, checked again server-side
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then(function () {
        form.reset();
        setStatus("success", "Thanks — your request has been sent. We'll get back to you shortly.");
      })
      .catch(function () {
        setStatus(
          "error",
          "Sorry, something went wrong sending your request. Please call us on 0131 202 0289 instead."
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultLabel;
      });
  });
})();
