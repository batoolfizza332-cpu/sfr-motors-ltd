# Hostinger پر خودکار ڈیپلائمنٹ کا منصوبہ

**حیثیت: یہ صرف منصوبہ ہے۔ اس پر ابھی کوئی عمل نہیں ہوا۔** اس فائل کی وجہ سے live سائٹ، DNS، Hostinger یا e-mail میں کچھ نہیں بدلا۔
اس منصوبے پر عمل کرنے سے پہلے مالک (owner) کی الگ منظوری ضروری ہے۔
ہاتھ سے upload کرنے کا موجودہ طریقہ، backup اور rollback [`HOSTINGER-RELEASE-RUNBOOK.md`](HOSTINGER-RELEASE-RUNBOOK.md) میں لکھا ہے۔ یہ منصوبہ اسی کو خودکار بناتا ہے، اس کے اصول نہیں بدلتا۔

---

## 1. ابھی کیا ہوتا ہے

* سائٹ کی اصل فائلیں `site/` میں ہیں۔ `npm run build` ان سے `dist/` بناتا ہے (چھوٹی کی ہوئی، hash والی فائلیں)۔
* `sfrmotors.co.uk` Hostinger (LiteSpeed) پر چلتی ہے، اور اس پر `dist/` کی فائلیں **ہاتھ سے** upload کی جاتی ہیں۔
* 2026-10-07 کو موازنہ کیا گیا: live سائٹ اور `main` کا build بالکل ایک جیسے ہیں (76 صفحات، تمام redirects، headers)۔
* `daily-seo` workflow اب ہر روز یہ موازنہ خود کرے گا۔ live اور repo میں فرق ہو تو job fail ہوگی۔

مسئلہ یہ ہے کہ ہر تبدیلی کے بعد کسی کو یاد سے build کر کے فائلیں صحیح ترتیب میں upload کرنی پڑتی ہیں۔ غلط ترتیب یا غلط `.htaccess` سے SEO خراب ہو سکتا ہے۔

---

## 2. دو راستے

| | راستہ A: GitHub Actions سے SFTP upload (**تجویز کردہ**) | راستہ B: Hostinger کی Git سہولت |
|---|---|---|
| کام کیسے ہوتا ہے | GitHub خود build کرتا ہے، چیک کرتا ہے، پھر SFTP سے فائلیں صحیح ترتیب میں upload کرتا ہے | GitHub ایک الگ branch میں تیار فائلیں رکھتا ہے، Hostinger اس branch کو `public_html` میں کھینچ لیتا ہے |
| Backup | ہر بار upload سے پہلے خودکار backup | Git کی history پر انحصار، الگ backup نہیں |
| upload کی ترتیب (assets → صفحات → `.htaccess` → sitemap) | قابو میں ہے | قابو میں نہیں، سب کچھ ایک ساتھ آتا ہے |
| پرانی CSS/JS فائلیں | کبھی delete نہیں ہوتیں | Git pull انہیں delete کر سکتا ہے (کھلے ہوئے پرانے صفحے کچھ منٹ بے ڈھنگے دکھ سکتے ہیں) |
| upload کے بعد خودکار چیک اور rollback | ہاں | نہیں |
| شرط | Hostinger plan میں SSH/SFTP ہو | hPanel میں Git ہو؛ پہلی بار عموماً **خالی فولڈر** چاہیے |
| خطرہ | کم | درمیانہ (موجودہ `public_html` کو خالی کرنا پڑ سکتا ہے) |

**تجویز:** راستہ A۔ یہ وہی محفوظ ترتیب اپناتا ہے جو runbook میں ہے، اور کچھ غلط ہو تو خود واپس پرانی حالت پر لے آتا ہے۔

---

## 3. راستہ A: GitHub Actions اور SFTP (تفصیل)

### 3.1 کب چلے گا

* **صرف بٹن دبانے پر** (`workflow_dispatch`)۔ `main` پر merge ہونے سے خود بخود نہیں چلے گا۔
  وجہ: ہر release مالک کی مرضی سے ہو۔ جب کچھ ہفتے سب ٹھیک چلے تو بعد میں `push: main` پر چلانے کا فیصلہ کیا جا سکتا ہے۔
* اضافی حفاظت: GitHub **Environment** `production` بنائیں اور اس پر "Required reviewers" میں اپنا نام رکھیں۔
  (نوٹ: private repo میں یہ سہولت GitHub Pro/Team plan پر ملتی ہے۔ مفت plan پر "صرف بٹن" ہی منظوری کا کام کرے گا۔)

### 3.2 مالک کو ایک بار کیا کرنا ہوگا

1. hPanel → **Advanced → SSH Access**: SSH آن کریں، اور host، port (Hostinger پر عموماً `65002`) اور username نوٹ کریں۔
2. ایک نئی SSH key بنائیں (صرف اسی کام کے لیے)۔ اس کا public حصہ hPanel میں ڈالیں، private حصہ GitHub میں۔
3. GitHub repo → **Settings → Secrets and variables → Actions → Secrets** میں یہ چار چیزیں ڈالیں:
   `HOSTINGER_SSH_HOST`، `HOSTINGER_SSH_PORT`، `HOSTINGER_SSH_USER`، `HOSTINGER_SSH_KEY`۔
   اور **Variables** میں `HOSTINGER_DOCROOT` (مثلاً `domains/sfrmotors.co.uk/public_html`؛ اصل راستہ hPanel میں دیکھ کر لکھیں)۔
4. کوئی پاس ورڈ یا key **کبھی بھی** repo کی کسی فائل میں نہ لکھیں۔

### 3.3 workflow کے مراحل (`.github/workflows/deploy-hostinger.yml`، ابھی بنی نہیں)

1. **Checkout** `main` اور `npm ci`۔
2. **Quality gate:** `npm run verify`۔ اگر fail ہو تو یہیں رک جائے۔
3. **Build + production `.htaccess`:**
   ```bash
   npm run build
   node scripts/htaccess-config.js --profile production --out dist/.htaccess
   ```
   ⚠️ `npm run build:hostinger` **استعمال نہیں کرنا**۔ وہ staging والی `.htaccess` بناتا ہے جس میں `noindex` ہے، اور اس سے سائٹ Google سے غائب ہو جائے گی۔
4. **حفاظتی چیک** (runbook سیکشن 3 والے)۔ کوئی بھی چیک غلط ہو تو workflow رک جائے:
   * `.htaccess` کی تیسری لائن `# Profile: production` ہو
   * `X-Robots-Tag` کی گنتی 0 ہو
   * `includeSubDomains|preload` کی گنتی 0 ہو
   * `sitemap.xml` اور `robots.txt` میں `noindex` نہ ہو
5. **Backup:** سرور کا موجودہ document root (`.htaccess` سمیت) SFTP سے download کریں اور GitHub **artifact** کے طور پر 30 دن رکھیں۔ backup نہ بنے تو release بھی نہیں ہوگی۔
6. **ترتیب سے upload** (rsync over SSH، `--delete` کے بغیر، یعنی کوئی پرانی فائل نہیں مٹے گی):
   1. `dist/assets/`
   2. `dist/*.html`
   3. `dist/.htaccess` (ایک فائل، فوراً)
   4. `sitemap.xml`، پھر `robots.txt` اور `favicon.ico`
7. **Live چیک:** `node scripts/live-compare.js`، وہی script جو daily-seo میں چلتی ہے۔ پہلی بار fail ہو تو 60 سیکنڈ رک کر (cache کی وجہ سے) ایک بار دوبارہ چلائیں۔
8. **خودکار rollback:** اگر چیک دوسری بار بھی fail ہو تو backup میں سے پہلے `.htaccess`، پھر `*.html`، پھر `sitemap.xml`/`robots.txt` واپس رکھیں، دوبارہ چیک کریں، اور job کو fail دکھائیں تاکہ مالک کو e-mail جائے۔
9. **ریکارڈ:** commit hash، وقت اور نتیجہ GitHub کی job summary میں لکھیں۔

### 3.4 کبھی نہیں کرنا

* DNS، MX/e-mail ریکارڈ، Hostinger plan یا WordPress کی فائلیں/database کو ہاتھ لگانا
* `--delete` کے ساتھ sync کرنا، یا سرور سے پرانی فائلیں مٹانا
* `site/`، `infra/`، `node_modules/`، `.git/` یا `vercel.json` کو سرور پر بھیجنا
* staging والی `.htaccess` live پر بھیجنا

---

## 4. راستہ B: Hostinger Git (اگر SSH نہ ملے)

1. ایک GitHub workflow `main` پر build کر کے صرف `dist/` (production `.htaccess` سمیت) ایک الگ branch `hostinger-dist` میں commit کرے۔
   پرانی hashed CSS/JS فائلیں اس branch میں رکھی رہیں، تاکہ Git pull انہیں delete نہ کرے۔
2. hPanel → **Advanced → Git**: repo `batoolfizza332-cpu/sfr-motors-ltd`، branch `hostinger-dist`۔ repo private ہے، اس لیے Hostinger کی دی ہوئی **deploy key** GitHub میں (read-only) ڈالنی ہوگی۔
3. Hostinger عموماً پہلی بار **خالی فولڈر** مانگتا ہے۔ موجودہ `public_html` کو خالی کرنا خطرناک ہے، اس لیے:
   * کسی نئے فولڈر میں deploy کریں، وہاں چیک کریں، پھر hPanel میں domain کا document root اس فولڈر پر بدل دیں (یہ runbook کا سیکشن 5A ہے)۔
   * یہ سہولت آپ کے plan میں ہے یا نہیں، یہ ابھی **تصدیق شدہ نہیں**۔
4. Hostinger کا "Auto deployment" webhook GitHub میں لگائیں، تاکہ `hostinger-dist` بدلتے ہی سرور pull کر لے۔
5. ہر pull کے بعد daily-seo workflow بٹن سے چلا کر چیک کریں۔

کمی: نہ backup، نہ upload کی ترتیب، نہ خودکار rollback۔ اسی لیے یہ دوسرا انتخاب ہے۔

---

## 5. `vercel.json` کے redirects کو `.htaccess` میں کیسے بدلیں

**مختصر جواب: ہاتھ سے بدلنے کی ضرورت نہیں۔ یہ کام پہلے سے خودکار ہے۔**

```
infra/template.yaml   ← تمام redirects، صاف URLs اور headers کا ایک ہی اصل ذریعہ
      │
      ├── node scripts/vercel-config.js                          →  vercel.json   (Vercel preview کے لیے)
      └── node scripts/htaccess-config.js --profile production   →  .htaccess     (Hostinger کے لیے)
```

* `vercel.json` اور `.htaccess` دونوں ایک ہی فائل (`infra/template.yaml`) سے بنتے ہیں، اس لیے ان میں فرق نہیں آ سکتا۔
* `npm run verify` کا check 19 ثابت کرتا ہے کہ دونوں ہر URL کو ایک جیسا route کرتے ہیں۔
* `scripts/live-compare.js` live سائٹ پر `vercel.json` کے **تمام 114 redirects** اور **146 صاف URLs** چیک کرتا ہے۔

**نیا redirect جوڑنا ہو تو:** `infra/template.yaml` میں تبدیلی کریں (`legacy` جدول میں)، پھر `node scripts/vercel-config.js` چلائیں، پھر `npm run verify`۔ `vercel.json` یا `.htaccess` کو کبھی ہاتھ سے نہ بدلیں۔

### ترجمہ کیسے ہوتا ہے (مثالیں)

| `vercel.json` میں | `.htaccess` میں (generator خود لکھتا ہے) | مطلب |
|---|---|---|
| `{"source":"/about.html","destination":"/about-us/","statusCode":301}` | `RewriteCond %{THE_REQUEST} ^[A-Z]+\s[^?\s]*\.html[?\s]`<br>`RewriteRule ^about\.html$ https://%{ENV:SFR_HOST}/about-us/ [R=301,L]` | پرانا `.html` لنک مستقل طور پر نئے URL پر جاتا ہے۔ `THE_REQUEST` والی شرط loop روکتی ہے۔ |
| `{"source":"/tyres-bathgate-guide/","destination":"/van-tyre-replacement-services/","statusCode":301}` (اور بغیر `/` والا) | `RewriteRule ^tyres-bathgate-guide/?$ https://%{ENV:SFR_HOST}/van-tyre-replacement-services/ [R=301,L]` | WordPress کا پرانا URL؛ `/?` سے دونوں شکلیں ایک ہی rule میں آ جاتی ہیں |
| `{"source":"/about-us/","destination":"/about.html"}` (rewrite) | `RewriteRule ^about-us/?$ about.html [L]` | browser میں URL صاف رہتا ہے، اندر سے `about.html` دکھایا جاتا ہے (redirect نہیں) |
| `headers` → `Strict-Transport-Security` وغیرہ | `Header always set Strict-Transport-Security "max-age=31536000"` | production میں HSTS صرف ایک سال کا؛ `includeSubDomains`/`preload` نہیں |
| `headers` → `X-Robots-Tag: noindex, nofollow` | **production `.htaccess` میں نہیں ہوتا** | یہ صرف Vercel preview کو Google سے چھپانے کے لیے ہے |
| `www` → بغیر www | `SFR_HOST` متغیر اور https redirect | www کے ساتھ پرانا URL بھی **ایک ہی** 301 میں صحیح جگہ پہنچتا ہے |
| 404 | `ErrorDocument 404 /404.html` | نامعلوم URL پر اصلی 404 |

ترتیب بھی اہم ہے، اور generator اسے خود سنبھالتا ہے: پہلے پرانے WordPress URLs، پھر `/index.html`، پھر `.html` سے صاف URL، پھر https، اور آخر میں صاف URL سے فائل۔

---

## 6. شروع کرنے سے پہلے مالک کی منظوری اور تصدیق

- [ ] راستہ A یا B کا انتخاب
- [ ] Hostinger plan میں SSH ہے یا نہیں (راستہ A)، یا Git اور document root بدلنے کی سہولت ہے یا نہیں (راستہ B)
- [ ] `sfrmotors.co.uk` کا document root کا اصل راستہ، اور اس میں کوئی اور سائٹ یا subdomain تو نہیں
- [ ] سرور کی موجودہ `.htaccess` میں Hostinger کا اپنا کوئی حصہ تو نہیں (runbook سیکشن 4.2)
- [ ] Hostinger cache/CDN آن ہے یا نہیں (ہو تو upload کے بعد purge کا قدم جوڑنا ہوگا)
- [ ] پرانا AWS والا `.github/workflows/deploy.yml` بند کرنا ہے یا نہیں (یہ `main` پر چلتا ہے اور AWS نہ ہونے کی وجہ سے fail ہوتا ہے)
- [ ] پہلی خودکار release کے وقت کوئی ہاتھ سے نگرانی کرے، اور e-mail کا test پہلے اور بعد میں ہو

ان سب کے بعد ہی `deploy-hostinger.yml` بنائی جائے، الگ PR میں۔
