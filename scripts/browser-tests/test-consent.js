// Browser test of the PRODUCTION build (dist/) behind the CloudFront + CSP model, driven over CDP.
//
// What is tested: the two-category cookie banner (Analytics, Advertising / Google Ads) and Google Consent Mode v2 in
// assets/js/analytics.js. On the production host GTM loads on every visit with all four consent signals "denied" first;
// GA4 (gtag.js) loads only once the visitor grants Analytics; the Ads signals become "granted" only once the visitor grants
// Advertising; ad_personalization is never granted.
//
// How the live GA4 / Google Ads accounts are protected: gtag.js and gtm.js are answered by local STUBS (the gtag stub
// mimics gtag's dataLayer handling, _ga cookies and /g/collect calls; the GTM stub does nothing) and every Google
// collection request is BLOCKED at the network layer and only recorded. Nothing is ever sent to Google in this file.
const fs = require("fs"), path = require("path");
const { start } = require("../preview-edge.js");
const { launch, newPage, sleep, setHostMap } = require("./cdp.js");

const ROOT = path.join(__dirname, "..", "..");
const SHOTS = path.join(process.env.SFR_SHOTS || require("os").tmpdir(), "sfr-browser-shots"); fs.mkdirSync(SHOTS, { recursive: true });
// Google may run ONLY on the production hostnames (assets/js/analytics.js). So the consent tests run on the page
// https://sfrmotors.co.uk/, which the browser answers from the local server (see cdp.js setHostMap): nothing reaches the real domain.
const PORT = 4181, PROD_HOST = "sfrmotors.co.uk", PREVIEW_HOST = "sfr-motors-preview.vercel.app", HOST = `https://${PROD_HOST}`;
setHostMap({ [PROD_HOST]: PORT, [PREVIEW_HOST]: PORT });
const ID = "G-B9TY4GMXYT", GTM_ID = "GTM-WZ6S5SHX", AW = "AW-16776239836/l76yCKqPuYkdENy1xL8-";

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
    if(!args||typeof args.length!=="number") return; // GTM's own {"gtm.start"} object
    if(args[0]==="config"&&args[1]===id){ var p={}; for(var k in args[2]||{}) p[k]=args[2][k]; send("page_view",p); }
    else if(args[0]==="event") send(args[1],args[2]||{});
  }
  var dl=window.dataLayer=window.dataLayer||[];
  for(var i=0;i<dl.length;i++) run(dl[i]);
  var push=dl.push; dl.push=function(){ for(var j=0;j<arguments.length;j++) run(arguments[j]); return push.apply(dl,arguments); };
})();`;
const GTM_STUB = `window.__gtmLoads=(window.__gtmLoads||0)+1;`;

const results = []; let section = "";
const check = (name, ok, detail) => { results.push({ section, name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  [${section}] ${name}${!ok && detail !== undefined ? "  -> " + JSON.stringify(detail) : ""}`); };

const isCollect = (r) => /(^|\.)google-analytics\.com$/.test(new URL(r.url).hostname) && new URL(r.url).pathname === "/g/collect";
const isGtag = (r) => new URL(r.url).hostname === "www.googletagmanager.com" && new URL(r.url).pathname === "/gtag/js";
const isGtm = (r) => new URL(r.url).hostname === "www.googletagmanager.com" && new URL(r.url).pathname === "/gtm.js";
const collects = (p) => p.state.requests.filter(isCollect).map((r) => { const u = new URL(r.url); return { en: u.searchParams.get("en"), tid: u.searchParams.get("tid"), params: Object.fromEntries([...u.searchParams].filter(([k]) => k.startsWith("ep.")).map(([k, v]) => [k.slice(3), v])), url: r.url }; });
const gtagLoads = (p) => p.state.requests.filter(isGtag).length;
const gtmLoads = (p) => p.state.requests.filter(isGtm).length;
const gaCookies = async (p) => (await p.cookies()).filter((c) => /^_ga/.test(c.name));
const consentCookie = async (p) => (await p.cookies()).find((c) => c.name === "sfr_consent");
const COOKIE = (a, d) => `v2:analytics=${a}|ads=${d}`;
// dataLayer as plain arrays (gtag() pushes `arguments` objects; GTM's loader pushes a plain object).
const DL = `[...(window.dataLayer||[])].map(a=>a&&typeof a.length==="number"?Array.from(a):a)`;
const consentCmds = (p, kind) => p.eval(`${DL}.filter(a=>Array.isArray(a)&&a[0]==="consent"&&a[1]===${JSON.stringify(kind)}).map(a=>a[2])`);
const configs = (p) => p.eval(`${DL}.filter(a=>Array.isArray(a)&&a[0]==="config").map(a=>a[1])`);
const SEL = { accept: '[data-sfr-consent-all="granted"]', reject: '[data-sfr-consent-all="denied"]', save: "[data-sfr-consent-save]", analytics: '[data-sfr-consent-cat="analytics"]', ads: '[data-sfr-consent-cat="ads"]' };
// Name of the focused element as a visitor would hear it: checkboxes by category, everything else by its text.
const focused = (p) => p.eval(`(()=>{const e=document.activeElement;return e.tagName==="INPUT"?"["+e.getAttribute("data-sfr-consent-cat")+"]":e.textContent})()`);

function lum(hex) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

let browser;
async function fresh(viewport, { stub = true } = {}) {
  const page = await newPage(browser, { ...viewport, onIntercept: async (rec) => {
    const u = new URL(rec.url);
    if (u.hostname.endsWith("localhost") || u.hostname.endsWith("googleapis.com") || u.hostname.endsWith("gstatic.com")) return {};
    if (isGtag(rec) && stub) return { fulfill: STUB };
    if (isGtm(rec) && stub) return { fulfill: GTM_STUB };
    return { fail: true }; // block everything else that is not our own server
  } });
  await page.eval("0");
  return page;
}
const noNav = (p) => p.eval(`window.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(a&&/^(tel:|https:\\/\\/wa\\.me)/.test(a.getAttribute("href")))e.preventDefault();},true);0`);
const visible = (p, sel) => p.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"})()`);
const rect = (p, sel) => p.eval(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}})()`);
const checked = (p) => p.eval(`[${JSON.stringify(SEL.analytics)},${JSON.stringify(SEL.ads)}].map(s=>document.querySelector(s).checked)`);

async function suite(label, viewport) {
  const mobile = viewport.width < 500;

  // ---------------------------------------------------------------- A. Fresh visitor
  section = `${label} A fresh`;
  let p = await fresh(viewport);
  await p.goto(HOST + "/"); await sleep(1500);
  check("banner (role=dialog) is shown on first visit", await visible(p, "#sfr-consent-title") && await p.eval(`document.querySelector('.sfr-consent__card').getAttribute('role')==="dialog"`));
  check("Accept all, Reject all and Save my choices are all visible", await visible(p, SEL.accept) && await visible(p, SEL.reject) && await visible(p, SEL.save));
  check("two labelled categories (Analytics, Advertising / Google Ads), both OFF by default", JSON.stringify(await checked(p)) === "[false,false]" && await p.eval(`[...document.querySelectorAll('.sfr-consent__cat-name')].map(e=>e.textContent).join("|")`) === "Analytics|Advertising / Google Ads");
  const ra = await rect(p, SEL.accept), rr = await rect(p, SEL.reject);
  check("Accept all and Reject all are the same size (equal prominence)", Math.abs(ra.w - rr.w) < 1 && Math.abs(ra.h - rr.h) < 1, { ra, rr });
  const fs2 = await p.eval(`['granted','denied'].map(v=>{const s=getComputedStyle(document.querySelector('[data-sfr-consent-all="'+v+'"]'));return s.fontSize+"/"+s.fontWeight})`);
  check("same font size and weight on Accept all and Reject all", fs2[0] === fs2[1], fs2);
  check("no gtag.js (GA4) request before any choice", gtagLoads(p) === 0, gtagLoads(p));
  check("no Google collection request before any choice", collects(p).length === 0);
  check("GTM (gtm.js) requested exactly once, with the approved container ID (Consent Mode v2)", gtmLoads(p) === 1 && p.state.requests.filter(isGtm)[0].url.endsWith("?id=" + GTM_ID), p.state.requests.filter(isGtm).map((r) => r.url));
  check("no request to any Google host other than fonts and gtm.js before choice", p.state.requests.filter((r) => /google|gstatic|doubleclick/.test(new URL(r.url).hostname) && !/googleapis\.com|gstatic\.com/.test(new URL(r.url).hostname) && !isGtm(r)).length === 0);
  check("no _ga / _gcl cookie before any choice", (await p.cookies()).filter((c) => /^(_ga|_gcl_|_gac_)/.test(c.name)).length === 0);
  check("no consent cookie is written before a choice", !(await consentCookie(p)));
  const def = await consentCmds(p, "default");
  check("exactly one consent default, all four signals denied", def.length === 1 && ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"].every((k) => def[0][k] === "denied"), def);
  check("consent default is declared before GTM starts; no update, js or config before a choice", await p.eval(`(()=>{const d=${DL};const c=d.findIndex(a=>Array.isArray(a)&&a[0]==="consent"&&a[1]==="default"),g=d.findIndex(a=>a&&!Array.isArray(a)&&a.event==="gtm.js");return c>=0&&g>c&&!d.some(a=>Array.isArray(a)&&(a[1]==="update"||a[0]==="js"||a[0]==="config"))})()`), await p.eval(DL));
  await p.eval(`window.scrollTo(0, document.body.scrollHeight/2)`); await sleep(700);
  await p.eval(`window.scrollTo(0, 0)`); await sleep(1500);
  check("scrolling / waiting is NOT treated as consent (banner stays, nothing granted)", await visible(p, ".sfr-consent__card") && gtagLoads(p) === 0 && !(await consentCookie(p)) && (await gaCookies(p)).length === 0 && (await consentCmds(p, "update")).length === 0);
  check("first-visit banner has no Close button / Escape does not dismiss it", !(await p.eval(`!!document.querySelector('.sfr-consent__close')`)) && (await (async () => { await p.key("Escape"); return visible(p, ".sfr-consent__card"); })()));
  check("banner is first in DOM (reached first by keyboard/screen reader)", await p.eval(`document.body.firstElementChild.id==="sfr-consent"`));
  const banner = await rect(p, ".sfr-consent__card"), vh = viewport.height, vw = viewport.width;
  check(`banner fits viewport (${Math.round(banner.h)}px tall of ${vh}px)`, banner.b <= vh && banner.x >= 0 && banner.r <= vw && (!mobile || banner.h <= vh * 0.3), banner);
  check("no horizontal overflow with banner", await p.eval(`document.documentElement.scrollWidth<=innerWidth`));
  check("header / nav not covered by the banner (banner is bottom-anchored)", banner.y > 120, banner.y);
  await p.shot(path.join(SHOTS, `${label}-first-visit.png`));
  const cs = await p.eval(`(()=>{const g=s=>getComputedStyle(document.querySelector(s));const card=g('.sfr-consent__card').backgroundColor;return {accept:[g('${SEL.accept}').color,g('${SEL.accept}').backgroundColor],reject:[g('${SEL.reject}').color,g('${SEL.reject}').backgroundColor],save:[g('${SEL.save}').color,card],text:[g('.sfr-consent__text').color,card],catDesc:[g('.sfr-consent__cat-desc').color,g('.sfr-consent__category').backgroundColor],link:[g('.sfr-consent__text a').color,card],trans:g('${SEL.accept}').transitionDuration}})()`);
  const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("");
  const ratios = Object.fromEntries(["accept", "reject", "save", "text", "catDesc", "link"].map((k) => [k, +contrast(hex(cs[k][0]), hex(cs[k][1])).toFixed(2)]));
  check("text/control contrast >= 4.5:1", Object.values(ratios).every((r) => r >= 4.5), ratios);
  check("no transitions on consent controls (reduced-motion safe)", cs.trans === "0s", cs.trans);
  await p.close();

  // ---------------------------------------------------------------- B. Reject all
  section = `${label} B reject`;
  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(800);
  await p.click(SEL.reject); await sleep(700);
  const cc = await consentCookie(p);
  check("consent cookie stored: v2:analytics=denied|ads=denied", cc && cc.value === COOKIE("denied", "denied"), cc && cc.value);
  const days = cc && ((cc.expires - Date.now() / 1000) / 86400);
  check("consent cookie lifetime is 180 days", days > 179 && days < 181, days);
  check("consent cookie: Path=/, SameSite=Lax, Secure, first-party host-only", cc && cc.path === "/" && cc.sameSite === "Lax" && cc.secure && !cc.domain.startsWith("."), cc);
  check("banner removed after Reject all", !(await visible(p, ".sfr-consent__card")));
  check("live-region announces the change", /off/.test(await p.eval(`document.querySelector('.sfr-sr-only[role=status]').textContent`)));
  check("no consent signal is ever granted after Reject all", (await consentCmds(p, "update")).every((u) => Object.values(u).every((v) => v === "denied")), await consentCmds(p, "update"));
  p.reset(); await p.goto(HOST + "/"); await noNav(p); await sleep(900);
  check("persists across reload: banner not shown", !(await visible(p, ".sfr-consent__card")));
  check("Cookie settings control visible in footer", await visible(p, ".sfr-footer [data-sfr-cookie-settings]"));
  for (const pth of ["/services.html", "/about-us/", "/mobile-tyre-fitting-bathgate/"]) {
    p.reset(); await p.goto(HOST + pth); await noNav(p); await sleep(700);
    check(`persists on ${pth}: no banner, no gtag.js, no collect, Ads still denied`, !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 0 && collects(p).length === 0 && (await consentCmds(p, "update")).length === 0);
  }
  await p.click('.sfr-topbar a[href^="tel:"]'); await p.click('.sfr-footer a[href^="https://wa.me/"]');
  await p.eval(`document.dispatchEvent(new CustomEvent("sfr:quote-submitted"))`); await sleep(800);
  check("phone / WhatsApp clicks and quote event send NOTHING when rejected", collects(p).length === 0 && gtagLoads(p) === 0);
  check("no _ga cookies when rejected", (await gaCookies(p)).length === 0);
  check("site still functional (nav toggle + quote form present, no JS errors)", await p.eval(`!!document.querySelector('.sfr-nav__toggle')`) && !p.state.console.some((l) => /^(error|exception)/i.test(l) && !/BLOCKED_BY_CLIENT|maps/.test(l)), p.state.console.filter((l) => /^error/.test(l)));
  await p.close();

  // ---------------------------------------------------------------- C. Accept all
  section = `${label} C accept`;
  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(800);
  await p.click(SEL.accept); await sleep(1500);
  const cg = await consentCookie(p);
  check("consent cookie stored: v2:analytics=granted|ads=granted", cg && cg.value === COOKIE("granted", "granted"), cg && cg.value);
  check("gtag.js requested exactly once, with the approved ID", gtagLoads(p) === 1 && p.state.requests.filter(isGtag)[0].url.endsWith("?id=" + ID), p.state.requests.filter(isGtag).map((r) => r.url));
  check("exactly one <script> for gtag.js and one for gtm.js in the DOM", await p.eval(`document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length===1&&document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]').length===1`));
  let cl = collects(p);
  check("exactly one page_view, for the approved Measurement ID", cl.length === 1 && cl[0].en === "page_view" && cl[0].tid === ID, cl.map((c) => c.en + "/" + c.tid));
  const ups = await consentCmds(p, "update");
  check("consent updated to granted for analytics_storage, ad_storage and ad_user_data", ups.some((u) => u.analytics_storage === "granted") && ups.some((u) => u.ad_storage === "granted" && u.ad_user_data === "granted"), ups);
  check("ad_personalization is never granted", (await p.eval(`${DL}.filter(a=>Array.isArray(a)&&a[0]==="consent").every(a=>a[2].ad_personalization!=="granted")`)), ups);
  check("dataLayer: one consent default, one js, one GA config, one Ads call-tracking config (no duplicate init)", await p.eval(`(()=>{const d=${DL}.filter(Array.isArray);return d.filter(a=>a[0]==="consent"&&a[1]==="default").length===1&&d.filter(a=>a[0]==="js").length===1&&d.filter(a=>a[0]==="config"&&a[1]===${JSON.stringify(ID)}).length===1&&d.filter(a=>a[0]==="config"&&a[1]===${JSON.stringify(AW)}).length===1})()`), await configs(p));
  check("GA config: Google signals and ad personalisation signals off", await p.eval(`(()=>{const g=${DL}.find(a=>Array.isArray(a)&&a[0]==="config"&&a[1]===${JSON.stringify(ID)})[2];return g.allow_google_signals===false&&g.allow_ad_personalization_signals===false})()`));
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
  check("no phone number / wa number / message text appears in ANY sent request", all.every((c) => !/0131|441312020289|448427154|07448|wa\.me|tel|found you/i.test(decodeURIComponent(c.url).replace(/dl=[^&]*/, ""))), all.map((c) => c.url));
  p.reset(); await p.eval(`document.dispatchEvent(new CustomEvent("sfr:quote-submitted"))`); await sleep(500);
  cl = collects(p);
  check("quote_request sent once, with no form data (home page: no contact_form_submit)", cl.length === 1 && cl[0].en === "quote_request" && !cl[0].params.name && !cl[0].params.phone, cl.map((c) => c.en));
  p.reset(); await p.goto(HOST + "/"); await noNav(p); await sleep(1500);
  cl = collects(p);
  check("persists across reload: no banner; gtag.js and gtm.js loaded once each; one page_view", !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 1 && gtmLoads(p) === 1 && cl.length === 1 && cl[0].en === "page_view", { g: gtagLoads(p), m: gtmLoads(p), c: cl.map((c) => c.en) });
  p.reset(); await p.goto(HOST + "/about-us/"); await noNav(p); await sleep(1500);
  cl = collects(p);
  check("persists on pretty path /about-us/: no banner; one gtag load; one page_view; Ads granted", !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 1 && cl.length === 1 && (await consentCmds(p, "update")).some((u) => u.ad_storage === "granted"), { g: gtagLoads(p), c: cl.map((c) => c.en) });
  p.reset(); await p.goto(HOST + "/contact-us/"); await noNav(p); await sleep(1500); p.reset();
  await p.eval(`document.dispatchEvent(new CustomEvent("sfr:quote-submitted"))`); await sleep(500);
  cl = collects(p);
  check("contact page: quote_request + contact_form_submit (once each)", cl.map((c) => c.en).sort().join() === "contact_form_submit,quote_request", cl.map((c) => c.en));
  await p.close();

  // ---------------------------------------------------------------- D. Withdrawal + E. change to Accept
  section = `${label} D withdraw`;
  p = await fresh(viewport); await p.goto(HOST + "/services.html"); await noNav(p); await sleep(800);
  await p.click(SEL.accept); await sleep(1500);
  const before = collects(p).length;
  await p.click(".sfr-footer [data-sfr-cookie-settings]"); await sleep(400);
  check("Cookie settings reopens the dialog (modal, labelled, both categories shown as ON)", await p.eval(`(()=>{const c=document.querySelector('.sfr-consent__card');return c&&c.getAttribute('aria-modal')==="true"&&document.getElementById(c.getAttribute('aria-labelledby')).textContent==="Cookie settings"})()`) && JSON.stringify(await checked(p)) === "[true,true]");
  check("focus moved into the dialog", await p.eval(`document.activeElement===document.querySelector('.sfr-consent__card')`));
  await p.shot(path.join(SHOTS, `${label}-settings-dialog.png`));
  const order = [];
  for (let i = 0; i < 8; i++) { await p.key("Tab"); order.push(await focused(p)); }
  check("Tab is trapped in the dialog and cycles (Privacy Policy, both categories, the three choices, Close, back to start)", order.join("|") === "Privacy Policy|[analytics]|[ads]|Accept all|Reject all|Save my choices|Close|Privacy Policy", order);
  await p.key("Tab", { shift: true });
  check("Shift+Tab wraps backwards to Close", await focused(p) === "Close");
  const ring = await p.eval(`(()=>{const s=getComputedStyle(document.activeElement);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()`);
  check("keyboard focus ring is visible (>=2px outline)", ring.style !== "none" && ring.width >= 2, ring);
  await p.key("Escape"); await sleep(300);
  check("Escape closes the dialog without changing the choice", !(await visible(p, ".sfr-consent__card")) && (await consentCookie(p)).value === COOKIE("granted", "granted"));
  check("focus returns to the Cookie settings control", await p.eval(`document.activeElement===document.querySelector('.sfr-footer [data-sfr-cookie-settings]')`));
  await p.key("Enter"); await sleep(400);
  check("Cookie settings opens from the keyboard (Enter)", await visible(p, ".sfr-consent__card"));
  await p.click(SEL.reject); await sleep(2500);
  check("no further Google request was sent between withdrawing and the reload", collects(p).length === before, { before, now: collects(p).length });
  check("consent cookie now v2:analytics=denied|ads=denied (withdrawal persisted)", (await consentCookie(p)).value === COOKIE("denied", "denied"));
  check("_ga cookies removed on withdrawal", (await gaCookies(p)).length === 0, await gaCookies(p));
  check("page reloaded clean: GA4 not present in the new page (GTM stays, all signals denied)", (await p.eval(`(window.__stubLoads||0)===0&&!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')`)) && !(await visible(p, ".sfr-consent__card")) && (await consentCmds(p, "update")).length === 0);
  await noNav(p); p.reset(); await p.click('.sfr-topbar a[href^="tel:"]'); await sleep(600);
  check("after withdrawal a phone click sends nothing", collects(p).length === 0);
  await p.goto(HOST + "/about-us/"); await sleep(600);
  check("rejected state persists on another page", !(await visible(p, ".sfr-consent__card")) && (await gaCookies(p)).length === 0 && gtagLoads(p) === 0);

  section = `${label} E change to accept`;
  p.reset(); await p.click(".sfr-footer [data-sfr-cookie-settings]"); await sleep(400);
  check("dialog shows both categories OFF for a rejected visitor", JSON.stringify(await checked(p)) === "[false,false]");
  await p.click(SEL.accept); await sleep(1500);
  cl = collects(p);
  check("Reject -> Accept all: gtag.js loads exactly once and one page_view is sent", gtagLoads(p) === 1 && cl.length === 1 && cl[0].en === "page_view" && cl[0].tid === ID, { g: gtagLoads(p), c: cl.map((c) => c.en) });
  check("consent cookie now granted for both; _ga cookies present", (await consentCookie(p)).value === COOKIE("granted", "granted") && (await gaCookies(p)).length >= 1);
  check("focus returned to the Cookie settings control after choosing", await p.eval(`document.activeElement===document.querySelector('.sfr-footer [data-sfr-cookie-settings]')`));
  await p.close();

  // ---------------------------------------------------------------- F. Keyboard on a fresh visit
  section = `${label} F keyboard`;
  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(900);
  const tabs = [];
  for (let i = 0; i < 5; i++) { await p.key("Tab"); tabs.push(await focused(p)); }
  check("first Tab stops land in the banner: Privacy Policy, both categories, Accept all, Reject all", tabs.join("|") === "Privacy Policy|[analytics]|[ads]|Accept all|Reject all", tabs);
  const r2 = await p.eval(`(()=>{const s=getComputedStyle(document.activeElement);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()`);
  check("focus ring visible on the focused choice button", r2.style !== "none" && r2.width >= 2, r2);
  await p.key("Enter"); await sleep(600);
  check("Enter on Reject all stores the choice and removes the banner", (await consentCookie(p)).value === COOKIE("denied", "denied") && !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 0);
  check("screen-reader accessible names present", await p.eval(`(()=>{const f=document.querySelector('.sfr-footer [data-sfr-cookie-settings]');return f.textContent.trim()==="Cookie settings"&&f.tagName==="BUTTON"&&!f.hidden})()`));
  await p.close();

  // ---------------------------------------------------------------- G. One category at a time ("Save my choices")
  section = `${label} G per category`;
  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(800);
  await p.click(SEL.analytics); await p.click(SEL.save); await sleep(1500);
  cl = collects(p);
  check("Analytics only: cookie v2:analytics=granted|ads=denied", (await consentCookie(p)).value === COOKIE("granted", "denied"));
  check("Analytics only: gtag.js once, one page_view, analytics_storage granted", gtagLoads(p) === 1 && cl.length === 1 && cl[0].en === "page_view" && (await consentCmds(p, "update")).some((u) => u.analytics_storage === "granted"), { g: gtagLoads(p), c: cl.map((c) => c.en) });
  check("Analytics only: Ads signals stay denied and Ads call tracking is not configured", (await consentCmds(p, "update")).every((u) => u.ad_storage !== "granted" && u.ad_user_data !== "granted") && !(await configs(p)).includes(AW), { u: await consentCmds(p, "update"), c: await configs(p) });
  await p.close();

  p = await fresh(viewport); await p.goto(HOST + "/"); await noNav(p); await sleep(800);
  await p.click(SEL.ads); await p.click(SEL.save); await sleep(1500);
  check("Ads only: cookie v2:analytics=denied|ads=granted", (await consentCookie(p)).value === COOKIE("denied", "granted"));
  check("Ads only: ad_storage + ad_user_data granted, Ads call tracking configured once", (await consentCmds(p, "update")).some((u) => u.ad_storage === "granted" && u.ad_user_data === "granted") && (await configs(p)).filter((c) => c === AW).length === 1, { u: await consentCmds(p, "update"), c: await configs(p) });
  check("Ads only: GA4 never loads, analytics_storage never granted, no _ga cookie", gtagLoads(p) === 0 && collects(p).length === 0 && (await gaCookies(p)).length === 0 && (await consentCmds(p, "update")).every((u) => u.analytics_storage !== "granted"));
  p.reset(); await p.click('.sfr-topbar a[href^="tel:"]'); await sleep(600);
  check("Ads only: a phone click sends nothing to Google Analytics", collects(p).length === 0);
  // Withdraw Ads, grant Analytics: the Ads click-id cookies must be cleared, without a reload.
  await p.eval(`document.cookie="_gcl_au=1.1.123.456; Path=/";0`);
  await p.click(".sfr-footer [data-sfr-cookie-settings]"); await sleep(400);
  check("settings dialog shows Analytics OFF, Ads ON", JSON.stringify(await checked(p)) === "[false,true]");
  await p.click(SEL.analytics); await p.click(SEL.ads); await p.click(SEL.save); await sleep(1500);
  const ups2 = await consentCmds(p, "update");
  check("Ads -> Analytics: cookie v2:analytics=granted|ads=denied; ad signals updated back to denied", (await consentCookie(p)).value === COOKIE("granted", "denied") && ups2.length && ups2.filter((u) => "ad_storage" in u).pop().ad_storage === "denied", ups2);
  check("Ads withdrawn: _gcl_au click-id cookie removed", !(await p.cookies()).some((c) => c.name === "_gcl_au"));
  check("Analytics granted after the change: gtag.js once, one page_view", gtagLoads(p) === 1 && collects(p).filter((c) => c.en === "page_view").length === 1);
  await p.close();

  // ---------------------------------------------------------------- hostname guard
  // Neither GTM nor Google Analytics may load on any host except the production hostnames, even after "Accept all".
  section = `${label} hostname guard`;
  for (const [name, url] of [["127.0.0.1", `http://127.0.0.1:${PORT}/`], ["a *.localhost host", `http://sfr-test.localhost:${PORT}/`], ["a *.vercel.app Preview URL", `https://${PREVIEW_HOST}/`]]) {
    p = await newPage(browser, { ...viewport, onIntercept: async (rec) => { const u = new URL(rec.url); if (isGtag(rec)) return { fulfill: STUB }; if (isGtm(rec)) return { fulfill: GTM_STUB }; if (u.hostname === "127.0.0.1" || u.hostname.endsWith("localhost") || u.hostname.endsWith("googleapis.com") || u.hostname.endsWith("gstatic.com")) return {}; return { fail: true }; } });
    await p.goto(url); await sleep(800);
    check(`on ${name} the consent banner is shown, and neither GTM nor gtag is loaded or defined`, await visible(p, ".sfr-consent__card") && gtmLoads(p) === 0 && gtagLoads(p) === 0 && await p.eval(`typeof window.gtag==="undefined"&&typeof window.dataLayer==="undefined"`));
    await p.click(SEL.accept); await sleep(1200);
    check(`on ${name} "Accept all" stores the choice and closes the banner, but Google is never loaded (protects the live GA4 / Google Ads accounts)`, (await consentCookie(p)).value === COOKIE("granted", "granted") && !(await visible(p, ".sfr-consent__card")) && gtagLoads(p) === 0 && gtmLoads(p) === 0 && collects(p).length === 0 && (await gaCookies(p)).length === 0);
    await p.goto(url); await sleep(800);
    check(`on ${name} a remembered "granted" choice still loads nothing from Google after a reload`, gtagLoads(p) === 0 && gtmLoads(p) === 0 && collects(p).length === 0 && (await gaCookies(p)).length === 0 && p.state.requests.every((r) => !/google-analytics|googletagmanager/.test(r.url)));
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
