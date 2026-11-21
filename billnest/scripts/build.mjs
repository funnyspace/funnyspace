import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logic = readFileSync(resolve(root, 'logic.mjs'), 'utf8');
const accounting = readFileSync(resolve(root, 'accounting.mjs'), 'utf8');
const app = readFileSync(resolve(root, 'app.js'), 'utf8');
const sourceImport = "import {toPaise,rupees,money,today,calculateInvoice,summarizeProfit,expiryStatus,escapeHtml as e,csvEncode} from './logic.mjs';";
const accountingImport = "import {invoiceOutstanding,makeAccountingSummary,ACCOUNT_TYPES} from './accounting.mjs';";
const accountingLogicImport = "import {summarizeProfit} from './logic.mjs';";
if (!app.includes(accountingImport) || !accounting.startsWith('/**')) throw new Error('Accounting module is missing.');
if (!app.startsWith(sourceImport)) throw new Error('Unexpected app.js import; review the bundle build.');
const combined = '// BillNest standalone bundle: no module loading required.\n'
  + logic.replaceAll('export ', '') + '\n'
  + accounting.replace(accountingLogicImport, '').replaceAll('export ', '') + '\n'
  + app.replace(sourceImport, 'const e = escapeHtml;').replace(accountingImport, '');
writeFileSync(resolve(root, 'app.bundle.js'), combined);
console.log('Built app.bundle.js');
