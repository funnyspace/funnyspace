import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('BillNest receipt B logo is used in sidebar and mobile header',()=>{
 const html=load('index.html');
 const css=load('styles.css');
 assert.match(html,/<div class="brand-mark" aria-hidden="true"><img src="logo-mark\.svg\?v=24"/);
 assert.match(html,/class="mobile-brand-mark"[^>]*><img src="logo-mark\.svg\?v=24"/);
 assert.match(html,/billnest<span class="brand-period">\.<\/span>/);
 assert.match(html,/INVENTORY \+ BILLING/);
 assert.match(css,/\.sidebar \.brand-mark img\{[^}]*object-fit:contain/);
 assert.match(css,/\.mobile-brand-mark\{display:none\}/);
 assert.match(css,/@media \(min-width:400px\) and \(max-width:700px\)/);
 assert.match(html,/styles\.css\?v=24/);
});

test('brand and favicon use valid standalone vector artwork and matching colors',()=>{
 const logo=load('logo-mark.svg');
 const favicon=load('favicon.svg');
 const html=load('index.html');
 for(const svg of [logo,favicon]){
  assert.match(svg,/<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/<\/svg>/);
  assert.match(svg,/#19BF93/);
  assert.match(svg,/#102E43/);
  assert.match(svg,/#FFFFFF/);
  assert.match(svg,/clipPath/);
 }
 assert.match(html,/href="favicon\.svg\?v=24"/);
});

test('brand update preserves core application scripts',()=>{
 const html=load('index.html');
 assert.match(html,/cloud-backup\.js\?v=23/);
 assert.match(html,/qrcode\.min\.js\?v=1/);
 assert.match(html,/app\.bundle\.js\?v=23/);
});
