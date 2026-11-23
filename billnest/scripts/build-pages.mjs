import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('.pages-output/', root);
const publicFiles = [
  'index.html', 'styles.css', 'auth-ui.css', 'language-ui.css', 'app.bundle.js',
  'auth-config.js', 'cloud-backup.js', 'auth-ui.js', 'turnstile.js', 'i18n.js',
  'install-app.js', 'qrcode.min.js', 'vendor-LICENSE-qrcodejs.txt',
  'manifest.webmanifest', 'sw.js', 'logo-mark.svg', 'favicon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'download/BillNest-Android-Test.apk'
];

const url = process.env.BILLNEST_SUPABASE_URL?.trim() || '';
const key = process.env.BILLNEST_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const turnstileSiteKey = process.env.BILLNEST_TURNSTILE_SITE_KEY?.trim() || '';
if (url || key || turnstileSiteKey) {
  const supabase = url && URL.canParse(url) ? new URL(url) : null;
  if (!supabase || supabase.protocol !== 'https:' || supabase.href !== supabase.origin + '/' ||
      !/^sb_publishable_[\w-]+$/.test(key)) {
    throw new Error('Set the Supabase HTTPS project URL and an sb_publishable_ key.');
  }
  if (turnstileSiteKey && !/^[\w-]{10,100}$/.test(turnstileSiteKey)) {
    throw new Error('Set a valid public Turnstile site key.');
  }
}

for (const path of publicFiles) {
  const target = new URL(path, output);
  mkdirSync(new URL('./', target), { recursive: true });
  cpSync(new URL(path, root), target);
}
if (url) {
  writeFileSync(new URL('auth-config.js', output),
    'window.BILLNEST_AUTH_CONFIG = ' + JSON.stringify({ url, key, turnstileSiteKey }) + ';\n');
}
console.log('Built Cloudflare Pages assets in ' + fileURLToPath(output));
