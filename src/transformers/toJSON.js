/**
 * Serializza i dati parsati della fattura in una stringa JSON formattata.
 *
 * @param {object} data - Oggetto JS prodotto da parseXML()
 * @returns {string} Stringa JSON indentata (2 spazi)
 */
export function toJSON(data) {
  return JSON.stringify(data, null, 2);
}
