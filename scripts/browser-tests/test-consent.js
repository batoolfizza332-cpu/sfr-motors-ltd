// Browser test of the PRODUCTION build (dist/) behind the CloudFront + CSP model, driven over CDP.
//
// How the live GA4 property is protected: gtag.js is answered by a local STUB (it mimics gtag's
// dataLayer handling, _ga cookies and /g/collect calls) and every Google collection request is
// BLOCKED at the network layer and only recorded. Nothing is ever sent to Google in this file.
const fs = require("fs"), path = require("path");
const { start } = require("../preview-edge.js");
const { launch, newPage, sleep, setHostMap } = require("./cdp.js");

const ROOT = path.join(__dirname, "..", "..");
const SHOTS = path.join(process.env.SFR_SHOTS || require("os").tmpdir(), "sfr-browser-shots"); fs.mkdirSync(SHOTS, { recursive: true });
// Analytics may run ONLY on the production hostnames (assets/js/analytics.js). So the consent tests run on the page
// https://sfrmotors.co.uk/, which the browser answers from the local server (see cdp.js setHostMap): nothing reaches the real domain.
const PORT = 4181, PROD_HOST = "sfrmotors.co.uk", PREVIEW_HOST = "sfr-motors-preview.vercel.app", HOST = `https://${PROD_HOST}`;
setHostMap({ [PROD_HOST]: PORT, [PREVIEW_HOST]: PORT });
const ID = "G-B9TY4GMXYT";

const STUB = `(function(){
  var id=(document.currentScript.src.match(/[?&]id=([^&]+)/)||[])[1];
  window.__stubLoads=(window.__stubLoads||0)+1;
  function cookie(n,v){document.cookie=n+"="+v+"; Max-Age=34560000; Path=/; Domain=."+location.hostname;}
  function send(en,params){
    if(window["ga-disable-"+id]) return;
    cookie("_ga","GA1.1.111.222"); cookie("_ga_"+id.slice(2),"GS2.1.s1$o1");
    var q="v=2&tid="+id+"&en="+en+"&dl="+encodeURIComponent(location.href);
    for(var k in params) q+="&ep."+k+"="+encodeURIComponent(params[k]);
    fetch("https://region1.google-analytics.com/g/collect?"+q,{method:"POST",mode:"no-cors"}).catch(function(){});
  }
  function run(args){
    if(args[0]==="config"){ var p={}; for(var k in args[2]||{}) p[k]=args[2][k]; send("page_view",p); }
    else if(args[0]==="event") send(args[1],args[2]||{});
  }
  var dl=window.dataLayer=window.dataLayer||[];
  for(var i=0;i<dl.length;i++) run(dl[i]);
  var push=dl.push; dl.push=function(){ for(var j=0;j<arguments.length;j++) run(arguments[j]); return push.apply(dl,arguments); };
})();`;

const results = []; let section = "";
const check = (name, ok, detail) => { results.push({ section, name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  [${section}] ${name}${!ok && detail !== undefined ? "  -> " + JSON.stringify(detail) : ""}`); };

const isCollect = (r) => /(^|\.)google-analytics\.com$/.test(new URL(r.url).hostname) && new URL(r.url).pathname === "/g/collect";
const isGtag = (r) => new URL(r.url).hostname === "www.googletagmanager.com" && new URL(r.url).pathname === "/gtag/js";
const collects = (p) => p.state.requests.filter(isCollect).map((r) => { const u = new URL(r.url); return { en: u.searchParams.get("en"), tid: u.searchParams.get("tid"), params: Object.fromEntries([...u.searchParams].filter(([k]) => k.startsWith("ep.")).map(([k, v]) => [k.slice(3), v])), url: r.url }; });
const gtagLoads = (p) => p.state.requests.filter(isGtag).length;
const gaCookies = async (p) => (await p.cookies()).filter((c) => /^_ga/.test(c.name));
const consentCookie = async (p) => (await p.cookies()).find((c) => c.name === "sfr_consent");

function lum(hex) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

let browser;
async function fresh(viewport, { stub = true } = {}) {
  const page = await newPage(browser, { ...viewport, onIntercept: async (rec) => {
    const u = new URL(rec.url);
    if (u.hostname.endsWith("localhost") || u.hostname.endsWith("googleapis.com") || u.hostname.endsWith("gstatic.com")) return {};
    if (isGtag(rec) && stub) return { fulfill: STUB };
    if (u.hostname.endsWith("google.com") && /maps/.test(u.pathname + u.hostname)) return { fail: true };
    return { fail: true }; // block everything else that is not our own server
  } });
  await page.eval("0");
  return page;
}
const noNav = (p) => p.eval(`window.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(a&&/^(tel:|https:\\/\\/wa\\.me)/.test(a.getAttribute("href")))e.preventDefault();},true);0`);
const visible = (p, sel) => p.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"})()`);
const rect = (p, sel) => p.eval(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}})()`);

async function suite(label, viewport) {
  const mobile = viewport.width < 500;

  // ---------------------------------------------------------------- A. Fresh visitor
  section = `${label} A fresh`;
  let p = await fresh(viewport);
  await p.goto(HOST + "/"); await sleep(1500);
  check("banner (role=dialog) is shown on first visit", await visible(p, "#sfr-consent-title") && await p.eval(`document.querySelector('.sfr-consent__card').getAttribute('role')==="dialog"`));
  check("Accept and Reject buttons both visible", await visible(p, '[data-sfr-consent="granted"]') && await visible(p, '[data-sfr-consent="denied"]'));
  const ra = await rect(p, '[data-sfr-consent="granted"]'), rr = await rect(p, '[data-sfr-consent="denied"]');
  check("Accept and Reject are the same size (equal prominence)", Math.abs(ra.w - rr.w) < 1 && Math.abs(ra.h - rr.h) < 1, { ra, rr });
  const fs2 = await p.eval(`['granted','denied'].map(v=>{const s=getComputedStyle(document.querySelector('[data-sfr-consent="'+v+'"]'));return s.fontSize+"/"+s.fontWeight})`);
  check("same font size and weight on both buttons", fs2[0] === fs2[1], fs2);
  check("no gtag.js request before any choice", gtagLoads(p) === 0, gtagLoads(p));
  check("no Google collection request before any choice", collects(p).length === 0);
  check("no request to any Google host other than fonts before choice", p.state.requests.filter((r) => /google|gstatic|doubleclick/.test(new URL(r.url).hostname) && !/fonts\.(googleapis|gstatic)|gstatic\.com|googleapis\.com/.test(new URL(r.url).hostname)).length === 0);
  check("no _ga cookie before any choice", (await gaCookies(p)).length === 0);
  check("no consent cookie is written before a choice", !(await consentCookie(p)));
  check("window.dataLayer / gtag not defined before consent", await p.eval(`typeof window.gtag==="undefined" && typeof window.dataLayer==="undefined"`));
  await p.eval(`window.scrollTo(0, document.body.scrollHeight/2)`); await sleep(700);
  await p.eval(`window.scrollTo(0, 0)`); await sleep(1500);
  check("scrolling / waiting is NOT treated as consent (banner stays, nothing loaded)", await visible(p, ".sfr-consent__card") && gtagLoads(p) === 0 && !(await consentCookie(p)) && (await gaCookies(p)).length === 0);
  check("first-visit banner has no Close button / Escape does not dismiss it", !(await p.eval(`!!document.querySelector('.sfr-consent__close')`)) && (await (async () => { await p.key("Escape"); return visible(p, ".sfr-consent__card"); })()));
  check("banner is first in DOM (reached first by keyboard/screen reader)", await p.eval(`document.body.firstElementChild.id==="sfr-consent"`));
  const banner = await rect(p, ".sfr-consent__card"), vh = viewport.height, vw = viewport.width;
  check(`banner fits viewport (${Math.round(banner.h)}px tall of ${vh}px)`, banner.b <= vh && banner.x >= 0 && banner.r <= vw && (!mobile || banner.h <= vh * 0.3), banner);
  check("no horizontal overflow with banner", await p.eval(`document.documentElement.scrollWidth<=innerWidth`));
  check("header / nav not covered by the banner (banner is bottom-anchored)", banner.y > 120, banner.y);
  await p.shot(path.join(SHOTS, `${label}-first-visit.png`));
  const cs = await p.eval(`(()=>{const g=s=>getComputedStyle(document.querySelector(s));return {accept:[g('[data-sfr-consent="granted"]').color,g('[data-sfr-consent="granted"]').backgroundColor],reject:[g('[data-sfr-consent="denied"]').color,g('[data-sfr-consent="denied"]').backgroundColor],text:[g('.sfr-consent__text').color,g('.sfr-consent__card').backgroundColor],link:[g('.sfr-consent__text a').color,g('.sfr-consent__card').backgroundColor],trans:g('[data-sfr-consent="granted"]').transitionDuration}})()`);
  const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("");
  const ratios = Object.fromEntries(["accept", "reject", "text", "link"].map((k) => [k, +contrast(hex(cs[k][0]), hex(cs[k][1])).toFixed(2)]));
  check("text/control contrast >= 4.5:1", Object.values(ratios).every((r) => r >= 4.5), ratios);
  check("no transitions on consent controls (reduced-motion safe)", cs.trans === "0s", cs.trans);
  await p.close();

  // ---------------------------------------------------------------- B. Reject
  section = `${label} B reject`;
  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(800);
  await p.click('[data-sfr-consent="denied"]'); await sleep(700);
  const cc = await consentCookie(p);
  check("consent cookie stored: v1:analytics=denied", cc && cc.value === "v1:analytics=denied", cc && cc.value);
  const days = cc && ((cc.expires - Date.now() / 1000) / 86400);
  check("consent cookie lifetime is 180 days", days > 179 && days < 181, days);
  check("consent cookie: Path=/, SameSite=Lax, first-party host-only", cc && cc.path === "/" && cc.sameSite === "Lax" && !cc.domain.startsWith("."), cc);
  check("banner removed after Reject", !(await visible(p, ".sfr-consent__card")));
  check("live-region announces the change", /off/.test(await p.eval(`document.querySelector('.sfr-sr-only[role=status]').textContent`)));
  p.reset(); await p.goto(HOST + "/"); await noNav(p); await sleep(900);
  check("persists across reload: banner not shown", !(await visible(p, ".sfr-consent__card")));
  check("Cookie settings control visible in footer", await visible(p, ".sfr-footer [data-sfr-cookie-settings]"));
  for (const pth of ["/services.html", "/about-us/", "/mobile-tyre-fitting-bathgate/"]) {
    p.reset(); await p.goto(HOST + pth); await noNav(p); await sleep(700);
    check(`persists on ${pth}: no banner, no gtag, no collect`, !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 0 && collects(p).length === 0);
  }
  await p.click('.sfr-topbar a[href^="tel:"]'); await p.click('.sfr-footer a[href^="https://wa.me/"]');
  await p.eval(`document.dispatchEvent(new CustomEvent("sfr:quote-submitted"))`); await sleep(800);
  check("phone / WhatsApp clicks and quote event send NOTHING when rejected", collects(p).length === 0 && gtagLoads(p) === 0);
  check("no _ga cookies when rejected", (await gaCookies(p)).length === 0);
  check("site still functional (nav toggle + quote form present, no JS errors)", await p.eval(`!!document.querySelector('.sfr-nav__toggle')`) && !p.state.console.some((l) => /^(error|exception)/i.test(l) && !/BLOCKED_BY_CLIENT|maps/.test(l)), p.state.console.filter((l) => /^error/.test(l)));
  await p.close();

  // ---------------------------------------------------------------- C. Accept
  section = `${label} C accept`;
  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(800);
  await p.click('[data-sfr-consent="granted"]'); await sleep(1500);
  const cg = await consentCookie(p);
  check("consent cookie stored: v1:analytics=granted", cg && cg.value === "v1:analytics=granted", cg && cg.value);
  check("gtag.js requested exactly once, with the approved ID", gtagLoads(p) === 1 && p.state.requests.filter(isGtag)[0].url.endsWith("?id=" + ID), p.state.requests.filter(isGtag).map((r) => r.url));
  check("exactly one <script> for gtag.js in the DOM", await p.eval(`document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length`) === 1);
  let cl = collects(p);
  check("exactly one page_view, for the approved Measurement ID", cl.length === 1 && cl[0].en === "page_view" && cl[0].tid === ID, cl.map((c) => c.en + "/" + c.tid));
  check("dataLayer holds one consent-default, one js, one config (no duplicate init)", await p.eval(`(()=>{const d=[...dataLayer].map(a=>a[0]+":"+(a[1]&&a[1].constructor===String?a[1]:""));return d.filter(x=>x.startsWith("config")).length===1&&d.filter(x=>x.startsWith("js")).length===1&&d.filter(x=>x.startsWith("consent")).length===1})()`));
  check("consent default: analytics granted, ads storage/user data/personalisation denied; signals off", await p.eval(`(()=>{const c=[...dataLayer].find(a=>a[0]==="consent"&&a[1]==="default")[2],g=[...dataLayer].find(a=>a[0]==="config")[2];return c.analytics_storage==="granted"&&c.ad_storage==="denied"&&c.ad_user_data==="denied"&&c.ad_personalization==="denied"&&g.allow_google_signals===false&&g.allow_ad_personalization_signals===false})()`));
  check("_ga cookies exist only after accepting", (await gaCookies(p)).length >= 1);
  p.reset(); await p.click('.sfr-topbar a[href^="tel:"]'); await sleep(700);
  cl = collects(p);
  check("phone click -> exactly one phone_click event", cl.length === 1 && cl[0].en === "phone_click", cl.map((c) => c.en));
  check("phone_click carries only page_path/page_type/link_location", cl[0] && JSON.stringify(Object.keys(cl[0].params).sort()) === JSON.stringify(["link_location", "page_path", "page_type"]), cl[0] && cl[0].params);
  check("phone_click link_location=top_bar", cl[0] && cl[0].params.link_location === "top_bar", cl[0] && cl[0].params);
  p.reset(); await p.click('.sfr-footer a[href^="https://wa.me/"]'); await sleep(700);
  cl = collects(p);
  check("WhatsApp click -> exactly one whatsapp_click (link_location=footer)", cl.length === 1 && cl[0].en === "whatsapp_click" && cl[0].params.link_location === "footer", cl.map((c) => c.en + JSON.stringify(c.params)));
  const all = [];
  p.reset(); await p.click(".sfr-header__call"); await sleep(500); all.push(...collects(p));
  p.reset(); await p.click('.sfr-footer a[href^="tel:"]'); await sleep(500); all.push(...collects(p));
  check("no phone number / wa number / message text appears in ANY sent request", all.every((c) => !/0131|441312020289|448427154|07448|wa\.me|tel/i.test(decodeURIComponent(c.url).replace(/dl=[^&]*/, ""))), all.map((c) => c.url));
  p.reset(); await p.eval(`document.dispatchEvent(new CustomEvent("sfr:quote-submitted"))`); await sleep(500);
  cl = collects(p);
  check("quote_request sent once, with no form data (home page: no contact_form_submit)", cl.length === 1 && cl[0].en === "quote_request" && !cl[0].params.name && !cl[0].params.phone, cl.map((c) => c.en));
  p.reset(); await p.goto(HOST + "/"); await noNav(p); await sleep(1500);
  cl = collects(p);
  check("persists across reload: no banner; gtag.js loaded once; one page_view", !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 1 && cl.length === 1 && cl[0].en === "page_view", { g: gtagLoads(p), c: cl.map((c) => c.en) });
  p.reset(); await p.goto(HOST + "/about-us/"); await noNav(p); await sleep(1500);
  cl = collects(p);
  check("persists on pretty path /about-us/: no banner; one gtag load; one page_view", !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 1 && cl.length === 1, { g: gtagLoads(p), c: cl.map((c) => c.en) });
  p.reset(); await p.goto(HOST + "/contact-us/"); await noNav(p); await sleep(1500); p.reset();
  await p.eval(`document.dispatchEvent(new CustomEvent("sfr:quote-submitted"))`); await sleep(500);
  cl = collects(p);
  check("contact page: quote_request + contact_form_submit (once each)", cl.map((c) => c.en).sort().join() === "contact_form_submit,quote_request", cl.map((c) => c.en));
  await p.close();

  // ---------------------------------------------------------------- D. Withdrawal + E. change to Accept
  section = `${label} D withdraw`;
  p = await fresh(viewport); await p.goto(HOST + "/services.html"); await noNav(p); await sleep(800);
  await p.click('[data-sfr-consent="granted"]'); await sleep(1500);
  const before = collects(p).length;
  await p.click(".sfr-footer [data-sfr-cookie-settings]"); await sleep(400);
  check("Cookie settings reopens the dialog (modal, labelled, status shown)", await p.eval(`(()=>{const c=document.querySelector('.sfr-consent__card');return c&&c.getAttribute('aria-modal')==="true"&&document.getElementById(c.getAttribute('aria-labelledby')).textContent==="Cookie settings"&&/currently on/.test(document.querySelector('.sfr-consent__status').textContent)})()`));
  check("focus moved into the dialog", await p.eval(`document.activeElement===document.querySelector('.sfr-consent__card')`));
  await p.shot(path.join(SHOTS, `${label}-settings-dialog.png`));
  await p.key("Tab"); const f1 = await p.eval(`document.activeElement.textContent`);
  await p.key("Tab"); const f2 = await p.eval(`document.activeElement.textContent`);
  await p.key("Tab"); const f3 = await p.eval(`document.activeElement.textContent`);
  await p.key("Tab"); const f4 = await p.eval(`document.activeElement.textContent`);
  await p.key("Tab"); const f5 = await p.eval(`document.activeElement.textContent`);
  check("Tab is trapped in the dialog and cycles (Privacy Policy, Accept, Reject, Close, back to start)", [f1, f2, f3, f4, f5].join("|") === "Privacy Policy|Accept analytics|Reject analytics|Close|Privacy Policy", [f1, f2, f3, f4, f5]);
  await p.key("Tab", { shift: true });
  check("Shift+Tab wraps backwards to Close", await p.eval(`document.activeElement.textContent`) === "Close");
  const ring = await p.eval(`(()=>{const s=getComputedStyle(document.activeElement);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()`);
  check("keyboard focus ring is visible (>=2px outline)", ring.style !== "none" && ring.width >= 2, ring);
  await p.key("Escape"); await sleep(300);
  check("Escape closes the dialog without changing the choice", !(await visible(p, ".sfr-consent__card")) && (await consentCookie(p)).value === "v1:analytics=granted");
  check("focus returns to the Cookie settings control", await p.eval(`document.activeElement===document.querySelector('.sfr-footer [data-sfr-cookie-settings]')`));
  await p.key("Enter"); await sleep(400);
  check("Cookie settings opens from the keyboard (Enter)", await visible(p, ".sfr-consent__card"));
  await p.click('[data-sfr-consent="denied"]'); await sleep(2500);
  check("no further Google request was sent between withdrawing and the reload", collects(p).length === before, { before, now: collects(p).length });
  check("consent cookie now v1:analytics=denied (withdrawal persisted)", (await consentCookie(p)).value === "v1:analytics=denied");
  check("_ga cookies removed on withdrawal", (await gaCookies(p)).length === 0, await gaCookies(p));
  const loadsAfterReload = await p.eval(`window.__stubLoads||0`);
  check("page reloaded clean: gtag not present in the new page", loadsAfterReload === 0 && (await p.eval(`typeof window.gtag==="undefined"`)) && !(await visible(p, ".sfr-consent__card")));
  await noNav(p); p.reset(); await p.click('.sfr-topbar a[href^="tel:"]'); await sleep(600);
  check("after withdrawal a phone click sends nothing", collects(p).length === 0);
  await p.goto(HOST + "/about-us/"); await sleep(600);
  check("rejected state persists on another page", !(await visible(p, ".sfr-consent__card")) && (await gaCookies(p)).length === 0 && gtagLoads(p) === 0);

  section = `${label} E change to accept`;
  p.reset(); await p.click(".sfr-footer [data-sfr-cookie-settings]"); await sleep(400);
  check("dialog reports 'currently off' for a rejected visitor", await p.eval(`/currently off/.test(document.querySelector('.sfr-consent__status').textContent)`));
  await p.click('[data-sfr-consent="granted"]'); await sleep(1500);
  cl = collects(p);
  check("Reject -> Accept: gtag.js loads exactly once and one page_view is sent", gtagLoads(p) === 1 && cl.length === 1 && cl[0].en === "page_view" && cl[0].tid === ID, { g: gtagLoads(p), c: cl.map((c) => c.en) });
  check("consent cookie now granted; _ga cookies present", (await consentCookie(p)).value === "v1:analytics=granted" && (await gaCookies(p)).length >= 1);
  check("focus returned to the Cookie settings control after choosing", await p.eval(`document.activeElement===document.querySelector('.sfr-footer [data-sfr-cookie-settings]')`));
  await p.close();

  // ---------------------------------------------------------------- F. Keyboard on a fresh visit
  section = `${label} F keyboard`;
  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(900);
  await p.key("Tab"); const t1 = await p.eval(`document.activeElement.textContent`);
  await p.key("Tab"); const t2 = await p.eval(`document.activeElement.textContent`);
  await p.key("Tab"); const t3 = await p.eval(`document.activeElement.textContent`);
  check("first Tab stops land in the banner: Privacy Policy, Accept, Reject", [t1, t2, t3].join("|") === "Privacy Policy|Accept analytics|Reject analytics", [t1, t2, t3]);
  const r2 = await p.eval(`(()=>{const s=getComputedStyle(document.activeElement);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()`);
  check("focus ring visible on the focused choice button", r2.style !== "none" && r2.width >= 2, r2);
  await p.key("Enter"); await sleep(600);
  check("Enter on Reject stores the choice and removes the banner", (await consentCookie(p)).value === "v1:analytics=denied" && !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 0);
  check("screen-reader accessible names present", await p.eval(`(()=>{const f=document.querySelector('.sfr-footer [data-sfr-cookie-settings]');return f.textContent.trim()==="Cookie settings"&&f.tagName==="BUTTON"&&!f.hidden})()`));
  await p.close();

  // ---------------------------------------------------------------- hostname guard
  // Google Analytics must load on no host except the production hostnames, even after "Accept analytics".
  section = `${label} hostname guard`;
  for (const [name, url] of [["127.0.0.1", `http://127.0.0.1:${PORT}/`], ["a *.localhost host", `http://sfr-test.localhost:${PORT}/`], ["a *.vercel.app Preview URL", `https://${PREVIEW_HOST}/`]]) {
    p = await newPage(browser, { ...viewport, onIntercept: async (rec) => { const u = new URL(rec.url); if (isGtag(rec)) return { fulfill: STUB }; if (u.hostname === "127.0.0.1" || u.hostname.endsWith("localhost") || u.hostname.endsWith("googleapis.com") || u.hostname.endsWith("gstatic.com")) return {}; return { fail: true }; } });
    await p.goto(url); await sleep(800);
    check(`on ${name} the consent banner is shown`, await visible(p, ".sfr-consent__card"));
    await p.click('[data-sfr-consent="granted"]'); await sleep(1200);
    check(`on ${name} "Accept analytics" stores the choice and closes the banner, but Google is never loaded (protects the live GA4 property)`, (await consentCookie(p)).value === "v1:analytics=granted" && !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 0 && collects(p).length === 0 && (await gaCookies(p)).length === 0);
    await p.goto(url); await sleep(800);
    check(`on ${name} a remembered "granted" choice still loads nothing from Google after a reload`, gtagLoads(p) === 0 && collects(p).length === 0 && (await gaCookies(p)).length === 0 && p.state.requests.every((r) => !/google-analytics|googletagmanager/.test(r.url)));
    await p.close();
  }
}

(async () => {
  await start({ port: PORT, quiet: true });
  browser = await launch(9334);
  try {
    await suite("desktop-1280x720", { width: 1280, height: 720, mobile: false });
    await suite("mobile-375x812", { width: 375, height: 812, mobile: true });
  } finally { await browser.close(); }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(SHOTS, "consent-results.json"), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
