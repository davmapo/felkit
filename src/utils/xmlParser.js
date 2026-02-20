import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  trimValues: true,
});

/**
 * Parsa una stringa XML in un oggetto JavaScript.
 * @param {string} xmlString - Contenuto XML grezzo
 * @returns {object} Oggetto JavaScript con la struttura della fattura
 * @throws {Error} Se l'XML non è valido
 */
export function parseXML(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('xmlString deve essere una stringa non vuota');
  }
  try {
    return parser.parse(xmlString);
  } catch (err) {
    throw new Error(`Errore nel parsing XML: ${err.message}`);
  }
}
