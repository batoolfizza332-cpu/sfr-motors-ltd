// SFR Motors Ltd — tyre size calculator (vanilla JS, no dependencies).
// Comparison and general information only: this script never labels a
// result "safe", "legal", "approved" or "compatible" — it only computes
// and displays the geometry. Nothing entered here is stored, sent to a
// server, or shared with analytics — every calculation happens in the
// browser and is discarded on reload.
(function () {
  "use strict";

  var form = document.getElementById("tyre-calc-form");
  if (!form) return;

  // Realistic technical ranges for published passenger/light-commercial
  // tyre sizes — wide enough to cover genuine sizes, narrow enough to
  // reject nonsensical input (e.g. a 5mm-wide tyre or a 200-inch rim).
  var FIELDS = [
    { id: "cur-width", min: 135, max: 335 },
    { id: "cur-profile", min: 25, max: 85 },
    { id: "cur-rim", min: 12, max: 24 },
    { id: "new-width", min: 135, max: 335 },
    { id: "new-profile", min: 25, max: 85 },
    { id: "new-rim", min: 12, max: 24 }
  ];

  var MM_PER_MILE = 1609344;
  var MM_PER_KM = 1000000;
  var EXAMPLE_SPEED_MPH = 70; // UK motorway speed limit — a fixed, stated example, not a claim about any specific vehicle

  function fieldEl(id) {
    return document.getElementById(id);
  }
  function errorEl(id) {
    return document.getElementById(id + "-error");
  }

  function clearFieldError(id) {
    fieldEl(id).removeAttribute("aria-invalid");
    errorEl(id).textContent = "";
  }

  function setFieldError(id, message) {
    fieldEl(id).setAttribute("aria-invalid", "true");
    errorEl(id).textContent = message;
  }

  // Returns a finite number within [min, max], or null (and sets an
  // inline error) for anything empty, non-numeric, zero, negative,
  // out of range, or a malformed number the browser itself flags.
  function validateField(f) {
    var input = fieldEl(f.id);
    var raw = input.value.trim();

    if (input.validity && input.validity.badInput) {
      setFieldError(f.id, "Enter a valid number.");
      return null;
    }
    if (raw === "") {
      setFieldError(f.id, "Enter a value.");
      return null;
    }
    var value = Number(raw);
    if (!isFinite(value) || value !== value) {
      // value !== value catches NaN without relying on isNaN's implicit coercion
      setFieldError(f.id, "Enter a valid number.");
      return null;
    }
    if (value <= 0) {
      setFieldError(f.id, "Value must be greater than zero.");
      return null;
    }
    if (value < f.min || value > f.max) {
      setFieldError(f.id, "Enter a value between " + f.min + " and " + f.max + ".");
      return null;
    }

    clearFieldError(f.id);
    return value;
  }

  // The four formulas this calculator is built on, exactly as specified:
  //   sidewall height (mm) = width x aspect ratio / 100
  //   rim diameter (mm)    = rim (in) x 25.4
  //   overall diameter(mm) = rim diameter + (2 x sidewall height)
  //   circumference (mm)   = overall diameter x pi
  // Given the enforced input ranges (aspect ratio >= 25, rim >= 12),
  // overall diameter and circumference are always strictly positive, so
  // revs-per-mile/km can never divide by zero.
  function computeTyre(widthMm, aspectPct, rimIn) {
    var sidewallHeight = (widthMm * aspectPct) / 100;
    var rimDiameterMm = rimIn * 25.4;
    var overallDiameter = rimDiameterMm + 2 * sidewallHeight;
    var circumference = overallDiameter * Math.PI;
    return {
      sidewallHeight: sidewallHeight,
      overallDiameter: overallDiameter,
      circumference: circumference,
      revsPerMile: MM_PER_MILE / circumference,
      revsPerKm: MM_PER_KM / circumference
    };
  }

  function fmt(n, dp) {
    return n.toFixed(dp);
  }

  function setText(id, text) {
    fieldEl(id).textContent = text;
  }

  function showResults(current, next) {
    var diffPct = ((next.overallDiameter - current.overallDiameter) / current.overallDiameter) * 100;
    var actualSpeed = EXAMPLE_SPEED_MPH * (next.overallDiameter / current.overallDiameter);
    var sign = diffPct >= 0 ? "+" : "";

    setText("calc-diff-value", sign + fmt(diffPct, 2) + "%");
    setText("calc-cur-sidewall", fmt(current.sidewallHeight, 1) + " mm");
    setText("calc-new-sidewall", fmt(next.sidewallHeight, 1) + " mm");
    setText("calc-cur-diameter", fmt(current.overallDiameter, 1) + " mm");
    setText("calc-new-diameter", fmt(next.overallDiameter, 1) + " mm");
    setText("calc-cur-circumference", fmt(current.circumference, 1) + " mm");
    setText("calc-new-circumference", fmt(next.circumference, 1) + " mm");
    setText("calc-cur-revs-mile", fmt(current.revsPerMile, 1));
    setText("calc-new-revs-mile", fmt(next.revsPerMile, 1));
    setText("calc-cur-revs-km", fmt(current.revsPerKm, 1));
    setText("calc-new-revs-km", fmt(next.revsPerKm, 1));

    setText(
      "calc-speedo-text",
      "At an indicated " + EXAMPLE_SPEED_MPH + " mph on your current tyre size, your actual road speed on the new size would be approximately " +
        fmt(actualSpeed, 1) + " mph — based on the change in overall diameter alone, not a measurement of your specific vehicle."
    );

    fieldEl("calc-results").hidden = false;
    setText("calc-status", "Results updated. Diameter difference " + sign + fmt(diffPct, 2) + "%.");
  }

  function hideResults() {
    fieldEl("calc-results").hidden = true;
    setText("calc-status", "");
  }

  function showFormError(message) {
    var el = fieldEl("calc-form-error");
    el.textContent = message;
    el.setAttribute("data-visible", "true");
  }

  function clearFormError() {
    var el = fieldEl("calc-form-error");
    el.textContent = "";
    el.removeAttribute("data-visible");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var values = {};
    var firstInvalidId = null;

    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
      var value = validateField(f);
      if (value === null) {
        if (!firstInvalidId) firstInvalidId = f.id;
      } else {
        values[f.id] = value;
      }
    }

    if (firstInvalidId) {
      hideResults();
      showFormError("Please fix the highlighted fields before calculating.");
      fieldEl(firstInvalidId).focus();
      return;
    }

    clearFormError();

    var current = computeTyre(values["cur-width"], values["cur-profile"], values["cur-rim"]);
    var next = computeTyre(values["new-width"], values["new-profile"], values["new-rim"]);
    showResults(current, next);
  });

  form.addEventListener("reset", function () {
    for (var i = 0; i < FIELDS.length; i++) {
      clearFieldError(FIELDS[i].id);
    }
    clearFormError();
    hideResults();
  });
})();
