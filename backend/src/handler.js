"use strict";

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const ses = new SESClient({});

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://sfrmotors.co.uk";
const TO_EMAIL = process.env.TO_EMAIL || "info@sfrmotors.co.uk";
const FROM_EMAIL = process.env.FROM_EMAIL || TO_EMAIL;

const MAX_LEN = {
  name: 100,
  phone: 30,
  email: 100,
  vehicleReg: 20,
  vehicle: 100,
  tyreSize: 30,
  service: 60,
  location: 200,
  preferredDate: 20,
  preferredTime: 20,
  message: 2000,
  company: 100,
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function respond(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

// Strip anything that could be interpreted as markup and clamp length,
// so submitted text can't inject HTML into the notification email.
function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim().slice(0, max);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return respond(204, {});
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { ok: false, error: "Invalid request body." });
  }

  const name = clean(payload.name, MAX_LEN.name);
  const phone = clean(payload.phone, MAX_LEN.phone);
  const email = clean(payload.email, MAX_LEN.email);
  const vehicleReg = clean(payload.vehicleReg, MAX_LEN.vehicleReg);
  const vehicle = clean(payload.vehicle, MAX_LEN.vehicle);
  const tyreSize = clean(payload.tyreSize, MAX_LEN.tyreSize);
  const service = clean(payload.service, MAX_LEN.service);
  const location = clean(payload.location, MAX_LEN.location);
  const preferredDate = clean(payload.preferredDate, MAX_LEN.preferredDate);
  const preferredTime = clean(payload.preferredTime, MAX_LEN.preferredTime);
  const message = clean(payload.message, MAX_LEN.message);
  const company = clean(payload.company, MAX_LEN.company); // honeypot

  // Honeypot tripped: pretend success, never send the email or hint that a check exists.
  if (company) {
    return respond(200, { ok: true });
  }

  if (!name || !phone || !service || !location) {
    return respond(400, { ok: false, error: "Name, phone, service and current location are required." });
  }
  if (email && !isValidEmail(email)) {
    return respond(400, { ok: false, error: "That email address doesn't look right." });
  }

  const preferredWhen = preferredDate || preferredTime
    ? [preferredDate, preferredTime].filter(Boolean).join(" ")
    : "ASAP / not specified";

  const textBody = [
    `New mobile tyre service request from the SFR Motors website`,
    ``,
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email || "(not provided)"}`,
    `Vehicle registration: ${vehicleReg || "(not provided)"}`,
    `Vehicle make & model: ${vehicle || "(not provided)"}`,
    `Tyre size: ${tyreSize || "(not provided)"}`,
    `Service required: ${service}`,
    `Current location: ${location}`,
    `Preferred date & time: ${preferredWhen}`,
    ``,
    `Additional information:`,
    message || "(none)",
  ].join("\n");

  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [TO_EMAIL] },
        ReplyToAddresses: email ? [email] : undefined,
        Message: {
          Subject: { Data: `New tyre service request — ${name} (${service})` },
          Body: { Text: { Data: textBody } },
        },
      })
    );
  } catch (err) {
    console.error("SES send failed", err);
    return respond(502, { ok: false, error: "Could not send your request. Please try again or call us." });
  }

  return respond(200, { ok: true });
};
