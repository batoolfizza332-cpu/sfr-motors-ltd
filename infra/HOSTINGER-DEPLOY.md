# Hostinger پر سائٹ کیسے live ہوتی ہے

سائٹ صرف **GitHub** اور **Hostinger** پر چلتی ہے۔ کوئی اور hosting (Vercel، AWS وغیرہ) استعمال نہیں ہوتی۔

```
site/ میں تبدیلی  →  main میں merge  →  dry-run خود چلتا ہے (کچھ upload نہیں)  →  مالک کی اجازت  →  deploy  →  live
```

**مالک کی اجازت کے بغیر کچھ live نہیں ہوتا۔**

---

## 1. روز مرہ کا طریقہ

1. `site/` میں تبدیلی کریں (یا Claude سے کروائیں) اور PR بنائیں۔
2. "Quality gate" سبز ہو تو PR کو `main` میں merge کریں۔
3. merge کے بعد "Deploy to Hostinger" خود **dry-run** چلاتا ہے: backup لیتا ہے اور بتاتا ہے کون سی فائلیں بدلیں گی۔ **کچھ upload نہیں کرتا۔**
4. مالک اجازت دے ("deploy کرو") تو Actions → Deploy to Hostinger → **Run workflow** → mode `deploy` اور خانے میں `DEPLOY` لکھ کر چلایا جاتا ہے (مالک خود، یا مالک کے کہنے پر Claude)۔
5. deploy کے بعد workflow live سائٹ چیک کرتا ہے۔ کچھ غلط ہو تو خود پرانی حالت واپس لگاتا ہے اور GitHub آپ کو e-mail کرتا ہے۔

dry-run تب ہی خود چلتا ہے جب ویب سائٹ کی فائلیں بدلیں (`site/`، `infra/template.yaml`، build scripts یا `package.json`)۔ صرف docs بدلنے سے کچھ نہیں چلتا۔

---

## 2. ایک بار کا setup (صرف مالک کر سکتا ہے)

جب تک یہ setup نہیں ہوتا، workflow ہر merge پر صرف یہ لکھ دیتا ہے کہ "Hostinger ابھی set up نہیں" اور کچھ upload نہیں کرتا (job fail نہیں ہوتی)۔

1. **اپنے کمپیوٹر پر key بنائیں** (PowerShell یا Terminal؛ passphrase پوچھے تو دو بار صرف Enter):
   ```
   ssh-keygen -t ed25519 -C "github-deploy-sfr" -f sfr_deploy_key
   ```
2. **hPanel** → Websites → `sfrmotors.co.uk` → Manage → **Advanced → SSH Access**:
   * SSH کو **Enable** کریں، اور IP، Port (عموماً `65002`) اور Username نوٹ کریں۔
   * **SSH Keys → Add SSH key** میں `sfr_deploy_key.pub` کی لائن paste کریں۔
3. **سرور کی پہچان:** `ssh-keyscan -p <port> <IP>` چلائیں اور نتیجہ copy کریں۔
4. **GitHub** → repo → Settings → Secrets and variables → **Actions**:

   | کہاں | نام | قدر |
   |---|---|---|
   | Secrets | `HOSTINGER_SSH_HOST` | IP (DNS کے مطابق `82.29.191.9`؛ hPanel سے تصدیق کریں) |
   | Secrets | `HOSTINGER_SSH_PORT` | Port، جیسے `65002` |
   | Secrets | `HOSTINGER_SSH_USER` | Username، جیسے `u123456789` |
   | Secrets | `HOSTINGER_SSH_KEY` | `sfr_deploy_key` فائل (بغیر `.pub`) پوری |
   | Secrets | `HOSTINGER_SSH_KNOWN_HOSTS` | قدم 3 کا نتیجہ |
   | Variables | `HOSTINGER_DOCROOT` | `domains/sfrmotors.co.uk/public_html` (File Manager میں تصدیق کریں) |

   یہ **Repository** secrets ہوں (Environment secrets نہیں)۔
5. پھر Actions → Deploy to Hostinger → Run workflow → `dry-run` ایک بار چلائیں اور دیکھیں کہ سب سبز ہے۔
6. `sfr_deploy_key` فائل کمپیوٹر سے مٹا دیں۔ کوئی key یا پاس ورڈ **کبھی** repo کی کسی فائل یا chat میں نہ لکھیں۔

---

## 3. workflow کیا کرتا ہے (ہر بار)

1. `npm ci` اور `npm run verify` (fail ہو تو یہیں رک جاتا ہے)
2. production `.htaccess` بناتا ہے: `node scripts/htaccess-config.js --profile production --out dist/.htaccess`
   (`npm run build:hostinger` **کبھی نہیں**: وہ staging والی `noindex` فائل بناتا ہے)
3. حفاظتی چیک: production profile، `X-Robots-Tag` نہیں، HSTS ایک سال، `includeSubDomains`/`preload` نہیں، sitemap/robots میں `noindex` نہیں
4. سرور کا پورا document root backup کرتا ہے (30 دن GitHub artifact میں)۔ اگر live `.htaccess` اس repo کی بنائی ہوئی نہ ہو تو رک جاتا ہے۔
5. ترتیب سے upload، **`--delete` کے بغیر**: `assets/` → صفحات → `.htaccess` → `sitemap.xml` → `robots.txt`/`favicon.ico`
6. `node scripts/live-compare.js` سے live سائٹ کو repo سے ملاتا ہے (fail ہو تو 60 سیکنڈ بعد دوبارہ)
7. دوبارہ fail ہو تو backup سے `.htaccess`، صفحات اور sitemap/robots واپس لگاتا ہے اور job کو fail دکھاتا ہے

روز صبح **Daily SEO check** بھی یہی موازنہ کرتا ہے۔

---

## 4. کبھی نہیں کرنا

* DNS، MX/e-mail ریکارڈ یا Hostinger plan کو ہاتھ لگانا
* `--delete` کے ساتھ sync، یا سرور سے پرانی فائلیں مٹانا
* `site/`، `infra/`، `node_modules/` یا `.git/` کو سرور پر بھیجنا
* staging والی `.htaccess` live پر بھیجنا
* کوئی key، token یا پاس ورڈ repo میں لکھنا

---

## 5. redirects اور headers کہاں سے آتے ہیں

```
infra/template.yaml          ← تمام redirects، صاف URLs اور security headers کا واحد ذریعہ
      │
      ├── scripts/routing.js         یہ اصول پڑھتا ہے
      ├── scripts/htaccess-config.js →  dist/.htaccess   (Hostinger)
      └── scripts/live-compare.js    →  live سائٹ پر تمام 114 redirects اور 146 صاف URLs کی جانچ
```

`infra/template.yaml` پرانے زمانے کی وجہ سے AWS CloudFormation کی شکل میں لکھی ہے، لیکن **کہیں deploy نہیں ہوتی**۔ اس کا صرف ایک کام ہے: URL کے اصول اور headers رکھنا۔

**نیا redirect جوڑنا ہو تو:** `infra/template.yaml` کے `legacy` جدول میں جوڑیں، پھر `npm run verify`۔ `.htaccess` کو کبھی ہاتھ سے نہ بدلیں۔
