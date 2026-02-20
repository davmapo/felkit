import { validateXSD } from './schemaValidator.js';

const SCHEMI = ['FatturaSemplificata', 'FatturaOrdinaria'];

/**
 * Rileva il tipo di fattura elettronica.
 *
 * Algoritmo in due fasi:
 *   1. Valida contro gli XSD ufficiali (fase principale):
 *      - FatturaSemplificata.xsd → 'semplificata'
 *      - FatturaOrdinaria.xsd   → 'ordinaria'
 *   2. Se nessuno XSD valida (fattura con scostamenti minori dallo standard),
 *      fallback sull'attributo `versione` dell'elemento radice:
 *      - FSM10 → 'semplificata'
 *      - FPR12 / FPA12 → 'ordinaria'
 *
 * @param {string} xmlString - Documento XML grezzo
 * @returns {Promise<'ordinaria' | 'semplificata'>}
 * @throws {Error} Se né XSD né versione consentono di determinare il tipo
 */
export async function detectType(xmlString) {
  // --- Fase 1: validazione XSD ---
  for (const schema of SCHEMI) {
    let result;
    try {
      result = await validateXSD(xmlString, schema);
    } catch (err) {
      throw new Error(`Impossibile rilevare il tipo di fattura: ${err.message}`);
    }

    if (result.valid === true) {
      return schemaNomeToTipo(schema);
    }
  }

  // --- Fase 2: fallback sul tag versione ---
  const tipoFallback = detectTypeByVersioneAttr(xmlString);
  if (tipoFallback) {
    return tipoFallback;
  }

  throw new Error(
    'Formato fattura non riconosciuto: il documento XML non è valido ' +
    'né come FatturaSemplificata né come FatturaOrdinaria, ' +
    'e l\'attributo versione non è riconoscibile.'
  );
}

/**
 * Legge l'attributo `versione` dall'elemento radice per determinare il tipo.
 * Usato come fallback quando la validazione XSD non è conclusiva.
 *
 * @param {string} xmlString
 * @returns {'ordinaria' | 'semplificata' | null}
 */
function detectTypeByVersioneAttr(xmlString) {
  const match = xmlString.match(/versione=["']([^"']+)["']/);
  if (!match) return null;

  const versione = match[1].toUpperCase();
  if (versione.startsWith('FSM')) return 'semplificata';
  if (versione.startsWith('FPR') || versione.startsWith('FPA')) return 'ordinaria';

  return null;
}

/**
 * @param {string} schemaNome
 * @returns {'ordinaria' | 'semplificata'}
 */
function schemaNomeToTipo(schemaNome) {
  switch (schemaNome) {
    case 'FatturaSemplificata': return 'semplificata';
    case 'FatturaOrdinaria':    return 'ordinaria';
    default: throw new Error(`Schema sconosciuto: ${schemaNome}`);
  }
}
