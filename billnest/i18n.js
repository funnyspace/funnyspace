/* BillNest Hindi/English UI translation. Business records and numeric values are never rewritten. */
(() => {
 'use strict';
 const ROWS="Dashboard|डैशबोर्ड\nOverview|सारांश\nBilling|बिलिंग\nInventory|स्टॉक\nInvoices & Sales|बिल और बिक्री\nInvoices|बिल\nSales & invoices|बिक्री और बिल\nCustomers|ग्राहक\nAccounting|लेखा-जोखा\nAccounts|खाते\nReports|रिपोर्ट\nSettings|सेटिंग्स\nStore settings|दुकान की सेटिंग्स\nWORKSPACE|कार्यक्षेत्र\nLocal workspace|इस डिवाइस पर\nMy Store|मेरी दुकान\nSaved on this device|इस डिवाइस पर सुरक्षित\nOpen Billing|बिल बनाएं\nSign in|साइन इन\nMy Account|मेरा खाता\nHome|होम\nQuick actions|त्वरित विकल्प\nGood to see you 👋|आपका स्वागत है 👋\nManage stock|स्टॉक संभालें\nAdd product|सामान जोड़ें\nAdd a product|सामान जोड़ें\nNew invoice and checkout|नया बिल और भुगतान\nUpdate inventory|स्टॉक अपडेट करें\nExpenses and cashbook|खर्च और रोकड़ बही\nToday's sales|आज की बिक्री\nToday’s sales|आज की बिक्री\nTotal products|कुल सामान\nLow stock items|कम स्टॉक\nStock value|स्टॉक का मूल्य\nRecent invoices|हाल के बिल\nRecent transactions|हाल के लेनदेन\nLow stock|कम स्टॉक\nOut of stock|स्टॉक खत्म\nIn stock|स्टॉक में\nAll products|सभी सामान\nExpired|समाप्त\nExpiry|समाप्ति\nExpiring ≤30 days|30 दिन में समाप्त होने वाला\nStock alerts|स्टॉक चेतावनी\nNo products sold yet|अभी कोई बिक्री नहीं\nNo invoices yet|अभी कोई बिल नहीं\nNo invoices found|कोई बिल नहीं मिला\nNo matching products|कोई सामान नहीं मिला\nNo products to bill yet|बिल बनाने के लिए सामान नहीं\nYour products|आपका सामान\nSearch inventory|स्टॉक खोजें\nSearch product, barcode or SKU...|सामान, बारकोड या SKU खोजें...\nSearch name, SKU or barcode...|नाम, SKU या बारकोड खोजें...\nSearch invoice or customer...|बिल या ग्राहक खोजें...\nFind product|सामान खोजें\nSearch invoices|बिल खोजें\nSearch customers|ग्राहक खोजें\nSearch|खोजें\nScan barcode|बारकोड स्कैन करें\nScan|स्कैन\nScan barcode with camera|कैमरे से बारकोड स्कैन करें\nAdd customer|ग्राहक जोड़ें\nEdit customer|ग्राहक बदलें\nEdit product|सामान बदलें\nDelete product|सामान हटाएं\nSave changes|बदलाव सहेजें\nCancel|रद्द करें\nClose|बंद करें\nSave|सहेजें\nView|देखें\nView / Print|देखें / प्रिंट\nCreate invoice|बिल बनाएं\nNew invoice|नया बिल\nInvoice history|पुराने बिल\nCurrent invoice|मौजूदा बिल\nSelect products|सामान चुनें\nBilling & checkout|बिल और भुगतान\nCustomer|ग्राहक\nWalk-in customer|सामान्य ग्राहक\nQuantity|मात्रा\nQty|मात्रा\nRate|दर\nAmount|राशि\nTotal|कुल\nSubtotal|उप-योग\nTaxable amount|कर योग्य राशि\nDiscount|छूट\nGST|जीएसटी\nGST rate (%)|जीएसटी दर (%)\nProduct name *|सामान का नाम *\nCategory|श्रेणी\nUnit|इकाई\nSelling price (₹) *|बिक्री मूल्य (₹) *\nPurchase cost (₹)|खरीद मूल्य (₹)\nOpening stock|शुरुआती स्टॉक\nLow stock alert at|कम स्टॉक चेतावनी\nExpiry date (optional)|समाप्ति तिथि (वैकल्पिक)\nSKU / item code *|SKU / आइटम कोड *\nBarcode / EAN / UPC|बारकोड / EAN / UPC\nStock update|स्टॉक अपडेट\nUpdate stock|स्टॉक अपडेट करें\nStock received (+)|स्टॉक आया (+)\nSet exact available stock|सही उपलब्ध स्टॉक सेट करें\nNote (optional)|नोट (वैकल्पिक)\nNote|नोट\nPhone|फ़ोन\nPhone number|मोबाइल नंबर\nEmail|ईमेल\nEmail address|ईमेल पता\nAddress|पता\nBusiness address|दुकान का पता\nBusiness details|दुकान का विवरण\nBusiness logo|दुकान का लोगो\nBusiness / shop name|दुकान का नाम\nOwner / contact name|मालिक / संपर्क नाम\nBusiness state / UT|राज्य / केंद्र शासित प्रदेश\nState / UT|राज्य / केंद्र शासित प्रदेश\nGSTIN (optional)|GSTIN (वैकल्पिक)\nGSTIN|GSTIN\nInvoice prefix|बिल नंबर का प्रीफ़िक्स\nBilling preferences|बिलिंग की पसंद\nProduct price includes GST?|क्या कीमत में GST शामिल है?\nNo, add GST|नहीं, GST जोड़ें\nYes, GST included|हाँ, GST शामिल है\nUPI payment QR|UPI भुगतान QR\nReceiving UPI ID|भुगतान प्राप्त करने का UPI ID\nPayment|भुगतान\nPayment method|भुगतान का तरीका\nPayment mode|भुगतान का तरीका\nPayment status|भुगतान स्थिति\nStatus|स्थिति\nPaid|भुगतान हुआ\nUnpaid|भुगतान बाकी\nPart paid|आंशिक भुगतान\nDue|बकाया\nDue payments|बकाया भुगतान\nCash|नकद\nCredit|उधार\nBank / UPI|बैंक / UPI\nReceive payment|भुगतान प्राप्त करें\nInvoice Terms & Conditions|बिल के नियम और शर्तें\nTerms & Conditions|नियम और शर्तें\nInvoice footer message|बिल का नीचे का संदेश\nThank-you message|धन्यवाद संदेश\nSecond footer line|दूसरी पंक्ति\nSave settings|सेटिंग्स सहेजें\nData & backup|डेटा और बैकअप\nDownload backup|बैकअप डाउनलोड करें\nRestore backup|बैकअप वापस लाएं\nDownload JSON|JSON डाउनलोड करें\nImport JSON|JSON इंपोर्ट करें\nReset workspace|डेटा रीसेट करें\nClear all data|पूरा डेटा हटाएं\nCloud backup|क्लाउड बैकअप\nSave to cloud now|अभी क्लाउड पर सहेजें\nRefresh backups|बैकअप रीफ़्रेश करें\nSign out|साइन आउट\nDownload CSV|CSV डाउनलोड करें\nExport CSV|CSV एक्सपोर्ट करें\nBefore using real invoices|असली बिल बनाने से पहले\nNo external libraries required|बाहरी लाइब्रेरी आवश्यक नहीं\nYour customers|आपके ग्राहक\nCustomer / business name *|ग्राहक / कारोबार का नाम *\nNew accounting transaction|नया लेखा लेनदेन\nTransaction type|लेनदेन का प्रकार\nTransaction|लेनदेन\nCashbook|रोकड़ बही\nDate|तारीख\nDescription|विवरण\nAmount (INR)|राशि (INR)\nPaid from / received in|भुगतान स्रोत / प्राप्ति खाता\nRecord transaction|लेनदेन दर्ज करें\nOpening balances|शुरुआती बैलेंस\nBalance|बैलेंस\nIncome|आय\nExpense|खर्च\nExpenses|खर्च\nAdd expense|खर्च जोड़ें\nBank|बैंक\nSales|बिक्री\nNet sales|शुद्ध बिक्री\nGross profit|सकल लाभ\nProfit|लाभ\nLoss|हानि\nTotal sales|कुल बिक्री\nDaily sales|दैनिक बिक्री\nLast 7 days|पिछले 7 दिन\nLast 30 days|पिछले 30 दिन\nAll time|अब तक\nAll-time|अब तक\nThis month|इस महीने\nThis week|इस सप्ताह\nToday|आज\nYesterday|कल\nView all|सभी देखें\nActions|कार्य\nInvoice #|बिल नंबर\nItems subtotal|सामान का उप-योग\nTaxable INR|कर योग्य राशि INR\nGST INR|जीएसटी INR\nTotal INR|कुल INR\nNumber of items|सामान की संख्या\nThank you for your business!|खरीदारी के लिए धन्यवाद!\nInvoice generated with BillNest|BillNest से बनाया गया बिल\nPrint / Save as PDF|प्रिंट / PDF सहेजें\nPrint thermal receipt|थर्मल रसीद प्रिंट करें\nBluetooth print|ब्लूटूथ प्रिंट\nReceipt printer|रसीद प्रिंटर\nPaper width|कागज़ की चौड़ाई\nSystem print (Bluetooth / USB / Wi-Fi)|सिस्टम प्रिंट (ब्लूटूथ / USB / Wi-Fi)\nBluetooth LE receipt|ब्लूटूथ LE रसीद\nTest receipt|टेस्ट रसीद\nLanguage|भाषा\nEnglish|English\nHindi|हिन्दी\nSend verification code|सत्यापन कोड भेजें\nVerify and continue|सत्यापित करके आगे बढ़ें\nMobile number|मोबाइल नंबर\nSigned in|साइन इन किया हुआ\nWelcome to BillNest|BillNest में स्वागत है\nVerification code|सत्यापन कोड".split('\n');
 const translations=Object.fromEntries(ROWS.map(s=>{const index=s.indexOf('|');return [s.slice(0,index),s.slice(index+1)]}));
 for(const row of ["Here is what is happening in your store today,|आज आपकी दुकान का हाल यह है:","Products in your catalogue|आपकी सूची में सामान","Need your attention|आपका ध्यान चाहिए","Based on purchase cost|खरीद मूल्य के आधार पर","Select products, set quantities and create a printable invoice.|सामान चुनें, मात्रा तय करें और प्रिंट करने योग्य बिल बनाएं।","Every generated invoice is stored in this browser.|हर नया बिल इस ब्राउज़र में सुरक्षित रहता है।","Manage stock, prices and expiry dates with 30-day alerts.|स्टॉक, कीमत और समाप्ति तिथि संभालें। 30 दिन पहले चेतावनी पाएं।","Personalise your invoices and manage your data.|अपने बिल की सेटिंग्स और डेटा संभालें।","This information appears on every new invoice.|यह जानकारी हर नए बिल में दिखाई देगी।","Choose how prices are stored. This affects GST calculations on new invoices.|कीमत का तरीका चुनें। इससे नए बिल का GST हिसाब प्रभावित होगा।","Product price includes GST?|क्या उत्पाद की कीमत में GST शामिल है?","Click a product to add it to the invoice|बिल में जोड़ने के लिए सामान पर क्लिक करें","Select products|सामान चुनें","No products to bill yet|बिल बनाने के लिए अभी सामान नहीं है","Add your first product to start billing.|बिल बनाने से पहले अपना पहला सामान जोड़ें।","Try searching with a different keyword.|दूसरे शब्द से खोजें।","Try a different search.|दूसरा शब्द खोजें।","Stock is deducted when you generate the invoice.|बिल बनने पर स्टॉक कम हो जाता है।","No matching products|मेल खाने वाला सामान नहीं मिला","Start by creating your first invoice.|पहले एक बिल बनाएं।","Invoices will appear here after you generate them.|नए बिल यहाँ दिखाई देंगे।","Open billing|बिलिंग खोलें","Create an invoice to see what sells best.|सबसे अधिक बिकने वाले सामान देखने के लिए बिल बनाएं।","Your store data lives in this browser. It does not automatically sync across devices or to GitHub.|दुकान का डेटा इस ब्राउज़र में रहता है। दूसरे डिवाइस या GitHub से अपने आप सिंक नहीं होता।","Save products, customers, stock movements, invoices, accounting transactions and opening balances as JSON.|सामान, ग्राहक, स्टॉक, बिल और लेखा डेटा JSON में सुरक्षित करें।","Replaces the current browser workspace with a backup file.|मौजूदा डेटा को बैकअप फ़ाइल से बदलता है।","Erase this browser's current store and accounting data. Export a backup first.|इस ब्राउज़र की दुकान और खाते का डेटा मिटाएं। पहले बैकअप लें।","Enter the details for your new product.|नए सामान की जानकारी भरें।","Update product information.|सामान की जानकारी बदलें।","Customer details for invoices.|बिल के लिए ग्राहक का विवरण।","Record business movements in cash or bank. Invoiced sales are automatic.|नकद या बैंक का लेनदेन दर्ज करें। बिल वाली बिक्री अपने आप दर्ज होती है।","New invoice|नया बिल","Add product|सामान जोड़ें","Add customer|ग्राहक जोड़ें","Save settings|सेटिंग्स सुरक्षित करें","Search product, barcode or SKU...|सामान, बारकोड या SKU खोजें...","The barcode identifies the item.|बारकोड से सामान पहचाना जाता है।","Select Cash or Bank.|नकद या बैंक चुनें।","This information appears on every new invoice.|यह विवरण हर नए बिल पर दिखाई देगा।","Upload logo|लोगो अपलोड करें","Remove logo|लोगो हटाएं","No, add GST|नहीं, GST जोड़ें","Yes, GST included|हाँ, GST पहले से शामिल है","Terms & Conditions|नियम और शर्तें","Print thermal receipt|थर्मल रसीद प्रिंट करें","Bluetooth LE|ब्लूटूथ LE"]){
  const i=row.indexOf('|');if(i>0)translations[row.slice(0,i)]=row.slice(i+1);
 }
 const KEY='billnest-ui-language-v1';
 let lang='en';
 try{lang=localStorage.getItem(KEY)==='hi'?'hi':'en'}catch{}
 const originals=new WeakMap();
 const attributeOriginals=new WeakMap();
 const blocked='script,style,noscript,textarea,code,pre,[contenteditable],.invoice-paper,.printable-invoice,.picker-product,.mobile-product,.data-table tbody,.cloud-backup-row,.store-meta b,.store-avatar,.billnest-auth-user,.invoice-upi-payment,.invoice-logo-top,.product-avatar,.customer-name';
 const dynamic=[
  [/^(\d+) invoices$/,n=>n+' बिल'],
  [/^(\d+) items$/,n=>n+' सामान'],
  [/^(\d+) in stock$/,n=>n+' स्टॉक में'],
  [/^Across (\d+) invoices$/,n=>n+' बिलों में'],
  [/^Due: (.+)$/,n=>'बकाया: '+n],
  [/^(\d+) sold$/,n=>n+' बिके']
 ];
 const translated=s=>translations[s]||dynamic.reduce((out,[re,fn])=>out||(re.exec(s)?.[1]?fn(re.exec(s)[1]):''),'')||s;
 const skip=node=>node.parentElement?.closest(blocked);
 function paintText(node){
  if(skip(node))return;
  const now=node.nodeValue;
  if(!now||!now.trim())return;
  const saved=originals.get(node);
  let base=saved?.original;
  if(!saved||now!==saved.original&&now!==saved.translation)base=now;
  const trimmed=base.trim(),before=base.slice(0,base.indexOf(trimmed)),after=base.slice(base.indexOf(trimmed)+trimmed.length);
  const next=lang==='hi'?before+translated(trimmed)+after:base;
  originals.set(node,{original:base,translation:next});
  if(now!==next)node.nodeValue=next;
 }
 function paintAttributes(el){
  if(el.matches(blocked)||el.closest('.invoice-paper,.mobile-product,.picker-product,.data-table tbody'))return;
  const attrs=['placeholder','aria-label','title'];
  let store=attributeOriginals.get(el);
  if(!store){store={};attributeOriginals.set(el,store)}
  for(const key of attrs){
   const current=el.getAttribute(key);
   if(current===null)continue;
   if(!store[key]||current!==store[key].original&&current!==store[key].translation)store[key]={original:current,translation:current};
   const next=lang==='hi'?translated(store[key].original):store[key].original;
   store[key].translation=next;
   if(current!==next)el.setAttribute(key,next);
  }
 }
 function translateTree(root){
  if(root.nodeType===3){paintText(root);return}
  if(root.nodeType!==1)return;
  const rootEl=root;
  if(rootEl.matches(blocked))return;
  paintAttributes(rootEl);
  const walker=document.createTreeWalker(rootEl,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const child=walker.currentNode;
   if(child.nodeType===3)paintText(child);
   else if(!child.matches(blocked))paintAttributes(child);
  }
 }
 const toggle=document.createElement('button');
 toggle.type='button';toggle.id='billnestLanguageToggle';toggle.className='billnest-language-toggle';toggle.dataset.i18nIgnore='';
 function label(){
  toggle.innerHTML='<span aria-hidden="true">🌐</span><span>'+(lang==='hi'?'हिं':'EN')+'</span>';
  toggle.setAttribute('aria-label',lang==='hi'?'Switch to English':'हिन्दी भाषा में बदलें');
  toggle.title=lang==='hi'?'English':'हिन्दी';
  document.documentElement.lang=lang;
 }
 function setLanguage(next){
  lang=next==='hi'?'hi':'en';try{localStorage.setItem(KEY,lang)}catch{}
  label();translateTree(document.body);
  window.dispatchEvent(new CustomEvent('billnest-language-changed',{detail:{language:lang}}));
 }
 const actions=document.querySelector('.top-actions');
 if(actions){actions.insertBefore(toggle,actions.firstChild);toggle.addEventListener('click',()=>setLanguage(lang==='hi'?'en':'hi'))}
 label();
 translateTree(document.body);
 const observer=new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='characterData')paintText(record.target);
   else for(const node of record.addedNodes)translateTree(node);
  }
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 globalThis.BillNestI18n={language:()=>lang,setLanguage,translate:translated};
})();