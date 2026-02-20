# felkit — contesto per Claude Code

## Cos'è
Libreria JavaScript **isomorfa** (Node.js + browser) per gestire **fatture elettroniche italiane**.

## Tipi di fattura supportati
| Tipo | Schema XSD | Foglio XSLT |
|---|---|---|
| `'ordinaria'` | `data/schemi/FatturaOrdinaria.xsd` | `data/style/FatturaOrdinaria.xsl` |
| `'semplificata'` | `data/schemi/FatturaSemplificata.xsd` | `data/style/FatturaSemplificata.xsl` |

I file XSD e XSL **non sono inclusi nel repo**: vanno scaricati dal sito ufficiale
[fatturapa.gov.it](https://www.fatturapa.gov.it) e inseriti nelle rispettive cartelle.

## Struttura del progetto
```
felkit/
├── package.json           ESM, dipendenze, exports map
├── CLAUDE.md              questo file
├── src/
│   ├── index.js           entry point — esporta FatturaElettronica + utils
│   ├── FatturaElettronica.js  classe principale
│   ├── utils/
│   │   ├── xmlParser.js       fast-xml-parser wrapper
│   │   ├── schemaValidator.js xmllint-wasm wrapper (Node) / avviso (browser)
│   │   └── typeDetector.js    loop di validazione XSD per rilevare il tipo
│   └── transformers/
│       ├── toJSON.js          serializza data in JSON
│       ├── toHTML.js          applica XSLT (xslt-processor/Node, XSLTProcessor/browser)
│       └── toPDF.js           puppeteer/Node → Buffer; browser → window.print()
├── data/
│   ├── schemi/            XSD ufficiali (da fornire)
│   └── style/             XSLT ufficiali (da fornire)
└── examples/
    └── test.js            script di verifica manuale
```

## API pubblica

```js
import { FatturaElettronica } from 'felkit';

// Pattern consigliato (asincrono, rileva tipo via XSD)
const fattura = await FatturaElettronica.from(xmlString);

fattura.type          // 'ordinaria' | 'semplificata'
fattura.data          // oggetto JS (fast-xml-parser output)
fattura.raw           // XML grezzo originale

fattura.toJSON()              // → string JSON
await fattura.toHTML()        // → string HTML (via XSLT)
fattura.toHTMLFromXSL(xsl)    // → string HTML (browser: passa XSL già caricato)
await fattura.toPDF()         // → Buffer (Node) | null + window.print() (browser)
await fattura.validate()      // → { valid: boolean|null, errors: string[] }
await fattura.detectType()    // → 'ordinaria' | 'semplificata'
```

## Dipendenze
- `fast-xml-parser` — parsing XML (isomorfo)
- `xmllint-wasm` — validazione XSD via WebAssembly (isomorfo)
- `xslt-processor` — trasformazione XSLT 1.0 in Node.js
- `puppeteer` — **peer dependency opzionale**, solo per toPDF() su Node.js

## Algoritmo di rilevamento del tipo (typeDetector.js)
1. Valida contro `FatturaSemplificata.xsd` → se valido → `'semplificata'`
2. Valida contro `FatturaOrdinaria.xsd` → se valido → `'ordinaria'`
3. Se nessuno XSD valida (fattura con scostamenti minori), fallback sull'attributo `versione`:
   - `FSM*` → `'semplificata'`
   - `FPR*` / `FPA*` → `'ordinaria'`
4. Tipo non determinabile → lancia `Error('Formato fattura non riconosciuto')`

## Comportamento isomorfo
| Funzione | Node.js | Browser |
|---|---|---|
| `parseXML()` | ✅ fast-xml-parser | ✅ fast-xml-parser |
| `validate()` / `detectType()` | ✅ xmllint-wasm | ⚠️ restituisce `{ valid: null }` |
| `toHTML()` | ✅ xslt-processor | ❌ usare `toHTMLFromXSL(xsl)` |
| `toHTMLFromXSL(xsl)` | ✅ | ✅ XSLTProcessor nativo |
| `toPDF()` | ✅ puppeteer (peer dep) | ⚠️ window.print() + null |

## Note implementative

### xmldsig e schemi con import esterni
Gli XSD ufficiali importano `xmldsig-core-schema.xsd` via URL W3C: xmllint-wasm non può
fare richieste di rete. `patchSchemaLocations()` sostituisce l'URL con il nome file locale.
`xmldsig-core-schema.xsd` è in `data/schemi/`. Se futuri XSD aggiungono URL esterni,
aggiungere la mappatura in `URL_TO_LOCAL` in [schemaValidator.js](src/utils/schemaValidator.js).

### xsi:schemaLocation nelle fatture reali
Le fatture reali contengono `xsi:schemaLocation` con URL remoti che xmllint userebbe per
scaricare lo schema, ignorando quello passato esplicitamente. `stripSchemaLocationHint()`
in [schemaValidator.js](src/utils/schemaValidator.js) rimuove l'attributo prima della validazione.

### xmllint-wasm v3: schema vs preload
- `schema`: solo lo schema principale (es. `FatturaOrdinaria.xsd`)
- `preload`: dipendenze importate (es. `xmldsig-core-schema.xsd`)
Mescolare tutto in `schema` causa "No matching global declaration" — bug noto dell'API v3.

### xslt-processor: API e versione XSLT
API corretta: `new XmlParser().xmlParse(str)` + `new Xslt().xsltProcess(xmlDoc, xslDoc)`.
I fogli ufficiali dichiarano `version="1.1"` ma usano solo XSLT 1.0: `toHTML.js` fa il
patch inline `version="1.1"` → `version="1.0"` prima della trasformazione.

## Comandi utili
```bash
npm install          # installa dipendenze
npm test             # esegue examples/test.js
npm install puppeteer  # installa peer dep opzionale per toPDF()
```
