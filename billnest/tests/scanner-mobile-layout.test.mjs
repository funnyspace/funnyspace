import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('mobile camera video fills entire preview, with a near-full-width scan guide',()=>{
 const mobile=css.slice(css.indexOf('/* v18: Full-width mobile barcode camera'));
 assert.match(mobile,/@media \(max-width:700px\)/);
 assert.match(mobile,/\.scanner-preview video\{[^}]*object-fit:cover/);
 assert.match(mobile,/\.scanner-guide\{inset:7% 3% 15%/);
 assert.doesNotMatch(mobile,/\.scanner-preview video\{[^}]*object-fit:contain/);
 assert.match(html,/styles\.css\?v=19/);
 assert.match(html,/app\.bundle\.js\?v=19/);
});

test('mobile scanner hides distance banner and lens picker while keeping controls',()=>{
 const mobile=css.slice(css.indexOf('/* v19: Hide the close-range instructions'));
 assert.match(mobile,/@media \(max-width:700px\)/);
 assert.match(mobile,/\.scanner-distance,\s*#scannerCameraWrap\{display:none!important\}/);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/data-action="scanner-switch"/);
 assert.match(app,/data-action="scanner-focus"/);
 assert.match(app,/id="barcodePhoto"/);
 assert.doesNotMatch(app,/Close-range reader ready/);
});
