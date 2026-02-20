import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLE_DIR = join(__dirname, '../../data/style');

/**
 * Carica il foglio di stile XSLT dal filesystem (Node.js).
 * @param {string} tipo - 'ordinaria' | 'semplificata'
 * @returns {Promise<string>} Contenuto XSLT
 */
async function loadStylesheetNode(tipo) {
  const nomeFile = tipo === 'semplificata' ? 'FatturaSemplificata.xsl' : 'FatturaOrdinaria.xsl';
  const filePath = join(STYLE_DIR, nomeFile);
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    throw new Error(
      `Foglio di stile XSLT non trovato: ${filePath}\n` +
      `Inserire ${nomeFile} in data/style/`
    );
  }
}

/**
 * Trasforma il documento XML in HTML applicando il foglio XSLT ufficiale.
 *
 * - Node.js  : usa xslt-processor (XSLT 1.0, pure JS)
 * - Browser  : usa XSLTProcessor nativo (API DOM standard)
 *
 * @param {string} xmlString - Documento XML grezzo
 * @param {'ordinaria' | 'semplificata'} tipo - Tipo di fattura
 * @returns {Promise<string>} Stringa HTML risultante
 */
export async function toHTML(xmlString, tipo) {
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    return toHTMLBrowser(xmlString, tipo);
  }
  return toHTMLNode(xmlString, tipo);
}

async function toHTMLNode(xmlString, tipo) {
  const xslString = await loadStylesheetNode(tipo);

  const { Xslt, XmlParser } = await import('xslt-processor');

  // I fogli ufficiali dell'Agenzia delle Entrate dichiarano version="1.1"
  // ma usano solo istruzioni XSLT 1.0. xslt-processor supporta solo 1.0:
  // il patch è sicuro e non altera il comportamento del foglio.
  const xslPatched = xslString.replace(/(<xsl:stylesheet[^>]*)\bversion="1\.1"/, '$1version="1.0"');

  const parser = new XmlParser();
  const processor = new Xslt();

  const result = processor.xsltProcess(
    parser.xmlParse(xmlString),
    parser.xmlParse(xslPatched)
  );

  if (result === null || result === undefined) {
    throw new Error('Trasformazione XSLT fallita: xslt-processor ha restituito un risultato vuoto');
  }

  return String(result);
}

async function toHTMLBrowser(xmlString, tipo) {
  const nomeFile = tipo === 'semplificata' ? 'FatturaSemplificata.xsl' : 'FatturaOrdinaria.xsl';

  // Nel browser il percorso del foglio XSLT deve essere configurato dall'utente
  // tramite l'opzione xslUrl, oppure il file viene caricato con fetch.
  // Se non disponibile, si lancia un errore descrittivo.
  throw new Error(
    `[felkit] Nel browser, toHTML() richiede il contenuto XSLT come stringa. ` +
    `Carica ${nomeFile} con fetch() e passa il risultato a toHTMLFromXSL(xmlString, xslString).`
  );
}

/**
 * Alternativa browser-friendly: riceve direttamente il contenuto XSL come stringa.
 *
 * @param {string} xmlString
 * @param {string} xslString
 * @returns {string} HTML serializzato
 */
export function toHTMLFromXSL(xmlString, xslString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
  const xslDoc = parser.parseFromString(xslString, 'application/xml');

  const processor = new XSLTProcessor();
  processor.importStylesheet(xslDoc);

  const resultDoc = processor.transformToDocument(xmlDoc);
  return new XMLSerializer().serializeToString(resultDoc);
}
