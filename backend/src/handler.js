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

// UK-friendly: digits with optional leading +, spaces, hyphens or brackets,
// 7-16 digits total. Loose on purpose — real validation is "can we call it".
function isPlausiblePhone(value) {
  const digits = value.replace(/[^\d]/g, "");
  return /^[\d+()\-.\s]+$/.test(value) && digits.length >= 7 && digits.length <= 16;
}

// Defence in depth for the HTML confirmation email — clean() already strips
// < and >, but this also escapes & so the rendered email can't have its
// markup structure altered by anything a submitter typed.
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;");
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
  const renderedAt = Number(payload.renderedAt);

  // Honeypot tripped, or the form was "filled" faster than a human could
  // read and type it: pretend success, never send the email or hint that
  // a check exists.
  const elapsedMs = Number.isFinite(renderedAt) ? Date.now() - renderedAt : null;
  if (company || (elapsedMs !== null && elapsedMs < 1500)) {
    return respond(200, { ok: true });
  }

  if (!name || !phone || !service || !location) {
    return respond(400, { ok: false, error: "Name, phone, service and current location are required." });
  }
  if (!isPlausiblePhone(phone)) {
    return respond(400, { ok: false, error: "That phone number doesn't look right." });
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

  // Customer confirmation — best-effort. The lead has already reached the
  // business at this point, so a failure here (e.g. the address isn't SES-
  // verified while still in the SES sandbox) must not fail the request or
  // be shown to the customer as an error.
  if (email) {
    const detailLines = [
      ["Service", service],
      ["Vehicle", [vehicle, vehicleReg].filter(Boolean).join(" — ")],
      ["Tyre size", tyreSize],
      ["Location", location],
      ["Preferred date & time", preferredDate || preferredTime ? preferredWhen : ""],
      ["Additional information", message],
    ].filter(([, value]) => value);

    const confirmTextBody = [
      `Hi ${name},`,
      ``,
      `Thank you for contacting SFR Motors Ltd. We've received your mobile tyre service request and will be in touch shortly to confirm details and arrange your appointment.`,
      ``,
      `Your request:`,
      ...detailLines.map(([label, value]) => `${label}: ${value}`),
      ``,
      `Need urgent help right now? Call us on 0131 202 0289 — we're open 24/7.`,
      `Prefer WhatsApp? Message us: https://wa.me/447448427154`,
      ``,
      `SFR Motors Ltd`,
      `Secure. Fast. Reliable.`,
      `39 S Loch Park, Bathgate, EH48 2QZ`,
    ].join("\n");

    const confirmHtmlRows = detailLines
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#5c5955;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#15161a;font-weight:600;">${escapeHtml(value)}</td></tr>`
      )
      .join("");

    const confirmHtmlBody = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f3f1;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#15161a;padding:20px 28px;">
<span style="color:#ffffff;font-size:17px;font-weight:900;">SFR Motors Ltd</span>
<div style="color:#ff6600;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Secure. Fast. Reliable.</div>
</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 14px;color:#15161a;font-size:15px;">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 20px;color:#5c5955;font-size:14.5px;line-height:1.6;">Thank you for contacting SFR Motors Ltd. We've received your mobile tyre service request and will be in touch shortly to confirm details and arrange your appointment.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #e8e5e1;border-bottom:1px solid #e8e5e1;margin-bottom:20px;">
${confirmHtmlRows}
</table>
<p style="margin:0 0 6px;color:#15161a;font-size:14.5px;font-weight:700;">Need urgent help right now?</p>
<p style="margin:0 0 20px;color:#5c5955;font-size:14.5px;line-height:1.6;">Call us on <a href="tel:01312020289" style="color:#d94f00;font-weight:700;text-decoration:none;">0131 202 0289</a> — we're open 24/7 — or message us on <a href="https://wa.me/447448427154" style="color:#d94f00;font-weight:700;text-decoration:none;">WhatsApp</a>.</p>
<p style="margin:0;color:#a9a6a0;font-size:12.5px;">SFR Motors Ltd &middot; 39 S Loch Park, Bathgate, EH48 2QZ</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    try {
      await ses.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: { ToAddresses: [email] },
          ReplyToAddresses: [TO_EMAIL],
          Message: {
            Subject: { Data: "We've received your tyre service request — SFR Motors Ltd" },
            Body: {
              Text: { Data: confirmTextBody },
              Html: { Data: confirmHtmlBody },
            },
          },
        })
      );
    } catch (err) {
      console.error("Customer confirmation email failed", err);
    }
  }

  return respond(200, { ok: true });
};
