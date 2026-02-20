import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMI_DIR = join(__dirname, '../../data/schemi');

/**
 * URL usati negli schemaLocation degli XSD ufficiali italiani come import esterni.
 * Vengono sostituiti con il nome file locale prima di passare il contenuto a xmllint-wasm
 * (che non può fare richieste di rete nel contesto WASM).
 */
const URL_TO_LOCAL = {
  'http://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd':
    'xmldsig-core-schema.xsd',
};

/**
 * Riscrive gli schemaLocation URL negli import XSD sostituendoli con nomi file locali.
 * @param {string} xsdContent
 * @returns {string}
 */
function patchSchemaLocations(xsdContent) {
  let patched = xsdContent;
  for (const [url, localFile] of Object.entries(URL_TO_LOCAL)) {
    patched = patched.replaceAll(url, localFile);
  }
  return patched;
}

/**
 * Rimuove l'attributo xsi:schemaLocation dal documento XML.
 * Le fatture elettroniche reali contengono questo attributo con URL remoti:
 * xmllint li userebbe per scaricare lo schema sovrascrivendo quello passato esplicitamente.
 * @param {string} xmlString
 * @returns {string}
 */
function stripSchemaLocationHint(xmlString) {
  return xmlString.replace(/\s+xsi:schemaLocation="[^"]*"/g, '');
}

/**
 * Carica il contenuto di uno schema XSD dal filesystem e applica il patching degli URL.
 * @param {string} nome - Nome del file senza estensione (es. 'FatturaOrdinaria')
 * @returns {Promise<string>} Contenuto XSD come stringa (con schemaLocation locali)
 */
async function loadSchemaNode(nome) {
  const filePath = join(SCHEMI_DIR, `${nome}.xsd`);
  try {
    const raw = await readFile(filePath, 'utf8');
    return patchSchemaLocations(raw);
  } catch {
    throw new Error(
      `Schema XSD non trovato: ${filePath}\n` +
      `Inserire il file ${nome}.xsd in data/schemi/`
    );
  }
}

/**
 * Carica tutti gli XSD presenti in data/schemi/ come schemi di supporto.
 * @returns {Promise<Array<{fileName: string, contents: string}>>}
 */
async function loadSupportSchemas() {
  let files;
  try {
    files = await readdir(SCHEMI_DIR);
  } catch {
    return [];
  }

  const xsdFiles = files.filter((f) => extname(f).toLowerCase() === '.xsd');
  const schemas = [];

  for (const file of xsdFiles) {
    const raw = await readFile(join(SCHEMI_DIR, file), 'utf8');
    schemas.push({ fileName: file, contents: patchSchemaLocations(raw) });
  }

  return schemas;
}

/**
 * Valida un documento XML contro uno schema XSD.
 *
 * In ambiente Node.js usa xmllint-wasm.
 * In ambiente browser la validazione XSD non è disponibile nativamente:
 * viene restituito un risultato "non verificato" con relativo avviso.
 *
 * @param {string} xmlString - Documento XML da validare
 * @param {string} schemaNome - Nome schema senza estensione (es. 'FatturaOrdinaria')
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
export async function validateXSD(xmlString, schemaNome) {
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    console.warn(
      '[felkit] La validazione XSD non è supportata nel browser. ' +
      'Usare il metodo validate() in un ambiente Node.js.'
    );
    return { valid: null, errors: ['Validazione XSD non disponibile nel browser'] };
  }

  // --- Node.js ---
  const xsdString = await loadSchemaNode(schemaNome);
  const supportSchemas = await loadSupportSchemas();

  // schema: solo lo schema principale (xmllint-wasm v3)
  // preload: dipendenze importate (es. xmldsig-core-schema.xsd)
  const mainSchema = { fileName: `${schemaNome}.xsd`, contents: xsdString };
  const preload = supportSchemas.filter((s) => s.fileName !== `${schemaNome}.xsd`);

  const { validateXML } = await import('xmllint-wasm');

  let result;
  try {
    result = await validateXML({
      xml: [{ fileName: 'fattura.xml', contents: stripSchemaLocationHint(xmlString) }],
      schema: mainSchema,
      preload,
    });
  } catch (e) {
    const msg = (typeof e === 'object' && e !== null) ? (e.message ?? JSON.stringify(e)) : String(e);
    throw new Error(`xmllint-wasm error: ${msg}`);
  }

  return {
    valid: result.valid,
    errors: result.errors.map((e) => e.message ?? String(e)),
  };
}
