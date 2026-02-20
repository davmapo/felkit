# felkit (BETA)

Libreria JavaScript per gestire **fatture elettroniche italiane** (formato SDI).

Supporta i due formati ufficiali:

| Tipo | Formato |
|---|---|
| `'ordinaria'` | FatturaPA e FatturaPR (FPA12 / FPR12) |
| `'semplificata'` | FatturaSemplificata (FSM10) |

---

## Requisiti

- Node.js ≥ 18
- Gli **schemi XSD** e i **fogli di stile XSLT** ufficiali devono essere forniti dall'utente (vedi [Configurazione dei file in `data/`](#configurazione-dei-file-in-data))

---

## Installazione

```bash
npm install github:davmapo/felkit
```

Per abilitare la generazione PDF su Node.js, installa anche la peer dependency opzionale:

```bash
npm install puppeteer
```

---

## Configurazione dei file in `data/`

> **Questo passaggio è obbligatorio** prima di poter usare `validate()`, `detectType()`, `toHTML()` e `toPDF()`.

La libreria usa gli schemi XSD ufficiali dell'Agenzia delle Entrate per la validazione e i fogli XSLT ufficiali per il rendering HTML. Questi file **non sono inclusi** nel pacchetto perché soggetti ad aggiornamenti periodici da parte dell'Agenzia delle Entrate.

### Dove scaricarli

Tutti i file sono disponibili su [fatturapa.gov.it](https://www.fatturapa.gov.it/it/norme-e-regole/documentazione-fattura-elettronica/formato-fatturapa/).

### Schema XSD

Scaricare i due XSD e salvarli con i seguenti nomi **esatti**:

```
data/schemi/FatturaOrdinaria.xsd       ← Schema FatturaPR (e FatturaPA)
data/schemi/FatturaSemplificata.xsd    ← Schema FatturaSemplificata
```

È necessario anche scaricare lo schema W3C per le firme digitali, importato da entrambi gli XSD:

```
data/schemi/xmldsig-core-schema.xsd    ← Scaricabile da:
                                           http://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd
```

### Fogli di stile XSLT

Scaricare i due fogli XSL e salvarli con i seguenti nomi **esatti**:

```
data/style/FatturaOrdinaria.xsl        ← Foglio stile FatturaPR/PA
data/style/FatturaSemplificata.xsl     ← Foglio stile FatturaSemplificata
```

### Aggiornamento dei file

Quando l'Agenzia delle Entrate pubblica una nuova versione degli schemi o dei fogli di stile, è sufficiente **sostituire i file** nelle rispettive cartelle mantenendo gli stessi nomi. La libreria li rileverà automaticamente al successivo avvio.

> **Attenzione:** se la nuova versione dello XSD introduce import verso URL esterni non presenti nella versione precedente, aggiungere la mappatura in `URL_TO_LOCAL` nel file `src/utils/schemaValidator.js`.

---

## Utilizzo

### Import

```js
import { FatturaElettronica } from 'felkit';
```

### Caricamento e rilevamento del tipo

```js
import { readFile } from 'node:fs/promises';

const xml = await readFile('./fattura.xml', 'utf8');

// Pattern consigliato: rileva il tipo automaticamente via XSD
const fattura = await FatturaElettronica.from(xml);

console.log(fattura.type);  // 'ordinaria' | 'semplificata'
console.log(fattura.data);  // struttura JS della fattura
console.log(fattura.raw);   // XML originale grezzo
```

In alternativa, è possibile usare il costruttore sincrono (senza rilevamento automatico):

```js
const fattura = new FatturaElettronica(xml);
// fattura.type è null finché non si chiama detectType()
await fattura.detectType();
console.log(fattura.type);
```

### Conversione in JSON

```js
const json = fattura.toJSON();
// Restituisce una stringa JSON indentata con tutti i dati della fattura
```

### Conversione in HTML

Richiede i fogli XSLT in `data/style/`.

```js
// Node.js — usa xslt-processor + il foglio ufficiale in data/style/
const html = await fattura.toHTML();

// Browser — occorre caricare il foglio XSL manualmente con fetch
const xslRes = await fetch('/path/to/FatturaOrdinaria.xsl');
const xslString = await xslRes.text();
const html = fattura.toHTMLFromXSL(xslString);
```

### Generazione PDF

Richiede `puppeteer` installato (Node.js) oppure apre il dialogo di stampa del browser.

```js
// Node.js → restituisce un Buffer
const pdfBuffer = await fattura.toPDF();
await fs.writeFile('fattura.pdf', pdfBuffer);

// Browser → apre window.print(), restituisce null
await fattura.toPDF();
```

### Validazione XSD

```js
const result = await fattura.validate();

if (result.valid) {
  console.log('Fattura conforme allo schema ufficiale');
} else {
  console.log('Errori di validazione:', result.errors);
}
```

> In ambiente browser `validate()` restituisce `{ valid: null, errors: [...] }` con un avviso in console: la validazione XSD non è disponibile nel browser.

---

## API di riferimento

### `new FatturaElettronica(xmlString)`

Costruttore sincrono. Effettua il parsing XML ma **non** rileva il tipo.

| Proprietà | Tipo | Descrizione |
|---|---|---|
| `raw` | `string` | XML originale |
| `data` | `object` | Struttura JS della fattura (output di fast-xml-parser) |
| `type` | `string \| null` | `'ordinaria'` / `'semplificata'` / `null` se non ancora rilevato |

### `FatturaElettronica.from(xmlString)` *(async)*

Factory statico. Equivale a `new FatturaElettronica(xml)` + `detectType()`. **Uso consigliato.**

### Metodi

| Metodo | Ritorna | Note |
|---|---|---|
| `toJSON()` | `string` | JSON indentato della fattura |
| `toHTML()` | `Promise<string>` | HTML via XSLT (Node); lancia errore nel browser |
| `toHTMLFromXSL(xslString)` | `string` | HTML via XSLT già caricato — funziona in browser e Node |
| `toPDF()` | `Promise<Buffer \| null>` | Buffer PDF (Node) oppure `null` + `window.print()` (browser) |
| `validate()` | `Promise<{valid, errors}>` | Valida contro XSD; `valid: null` nel browser |
| `detectType()` | `Promise<string>` | Rileva e imposta `this.type` |

---

## Comportamento per ambiente

| Funzione | Node.js | Browser |
|---|---|---|
| `parseXML()` | ✅ | ✅ |
| `toJSON()` | ✅ | ✅ |
| `validate()` / `detectType()` | ✅ xmllint-wasm | ⚠️ restituisce `{ valid: null }` |
| `toHTML()` | ✅ xslt-processor | ❌ usare `toHTMLFromXSL()` |
| `toHTMLFromXSL(xsl)` | ✅ | ✅ XSLTProcessor nativo |
| `toPDF()` | ✅ puppeteer (peer dep) | ⚠️ `window.print()` + `null` |

---

## Esempio completo (Node.js)

```js
import { readFile, writeFile } from 'node:fs/promises';
import { FatturaElettronica } from 'felkit';

const xml = await readFile('./IT01234567890_FPR01.xml', 'utf8');
const fattura = await FatturaElettronica.from(xml);

console.log('Tipo:', fattura.type);

// Validazione
const { valid, errors } = await fattura.validate();
if (!valid) {
  console.warn('Attenzione, la fattura presenta errori XSD:', errors);
}

// JSON
await writeFile('./fattura.json', fattura.toJSON());

// HTML
const html = await fattura.toHTML();
await writeFile('./fattura.html', html);

// PDF (richiede: npm install puppeteer)
const pdf = await fattura.toPDF();
await writeFile('./fattura.pdf', pdf);
```

---

## Licenza

MIT
