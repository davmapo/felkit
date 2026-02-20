import { parseXML } from './utils/xmlParser.js';
import { validateXSD } from './utils/schemaValidator.js';
import { detectType } from './utils/typeDetector.js';
import { toJSON } from './transformers/toJSON.js';
import { toHTML, toHTMLFromXSL } from './transformers/toHTML.js';
import { toPDF } from './transformers/toPDF.js';

/**
 * Classe principale per la gestione delle fatture elettroniche italiane.
 *
 * Utilizzo consigliato (rileva il tipo automaticamente via XSD):
 * ```js
 * const fattura = await FatturaElettronica.from(xmlString);
 * console.log(fattura.type); // 'ordinaria' | 'semplificata'
 * ```
 *
 * Utilizzo sincrono (senza rilevamento del tipo):
 * ```js
 * const fattura = new FatturaElettronica(xmlString);
 * // fattura.type è null fino a quando non si chiama detectType()
 * await fattura.detectType();
 * ```
 */
export class FatturaElettronica {
  /**
   * @param {string} xmlString - Documento XML della fattura
   */
  constructor(xmlString) {
    /** @type {string} XML grezzo originale */
    this.raw = xmlString;

    /** @type {object} Struttura parsata della fattura */
    this.data = parseXML(xmlString);

    /** @type {'ordinaria' | 'semplificata' | null} Tipo rilevato (null se non ancora rilevato) */
    this.type = null;
  }

  // ---------------------------------------------------------------------------
  // Factory asincrono (percorso consigliato)
  // ---------------------------------------------------------------------------

  /**
   * Crea un'istanza di FatturaElettronica rilevando automaticamente il tipo
   * tramite validazione XSD.
   *
   * @param {string} xmlString - Documento XML della fattura
   * @returns {Promise<FatturaElettronica>}
   */
  static async from(xmlString) {
    const instance = new FatturaElettronica(xmlString);
    await instance.detectType();
    return instance;
  }

  // ---------------------------------------------------------------------------
  // Rilevamento tipo
  // ---------------------------------------------------------------------------

  /**
   * Valida il documento contro gli schemi XSD e imposta this.type.
   * Può essere chiamato manualmente se si usa il costruttore diretto.
   *
   * @returns {Promise<'ordinaria' | 'semplificata'>}
   */
  async detectType() {
    this.type = await detectType(this.raw);
    return this.type;
  }

  // ---------------------------------------------------------------------------
  // Trasformatori
  // ---------------------------------------------------------------------------

  /**
   * Serializza la fattura in formato JSON.
   * @returns {string} Stringa JSON indentata
   */
  toJSON() {
    return toJSON(this.data);
  }

  /**
   * Trasforma la fattura in HTML applicando il foglio XSLT ufficiale.
   *
   * In ambiente browser è necessario fornire il contenuto XSL come stringa
   * (caricato via fetch), altrimenti usare toHTMLFromXSL().
   *
   * @returns {Promise<string>} Stringa HTML
   */
  async toHTML() {
    this._requireType('toHTML');
    return toHTML(this.raw, this.type);
  }

  /**
   * Versione browser-friendly di toHTML(): riceve il contenuto XSL già caricato.
   *
   * @param {string} xslString - Contenuto del foglio di stile XSLT
   * @returns {string} Stringa HTML
   */
  toHTMLFromXSL(xslString) {
    return toHTMLFromXSL(this.raw, xslString);
  }

  /**
   * Converte la fattura in PDF.
   *
   * - Node.js : ritorna un Buffer (richiede puppeteer installato)
   * - Browser : apre il dialogo di stampa, ritorna null
   *
   * @returns {Promise<Buffer | null>}
   */
  async toPDF() {
    this._requireType('toPDF');
    const html = await toHTML(this.raw, this.type);
    return toPDF(html);
  }

  // ---------------------------------------------------------------------------
  // Validazione
  // ---------------------------------------------------------------------------

  /**
   * Valida il documento XML contro lo schema XSD corrispondente al tipo rilevato.
   *
   * @returns {Promise<{ valid: boolean | null, errors: string[] }>}
   */
  async validate() {
    this._requireType('validate');
    const schemaNome = this.type === 'semplificata' ? 'FatturaSemplificata' : 'FatturaOrdinaria';
    return validateXSD(this.raw, schemaNome);
  }

  // ---------------------------------------------------------------------------
  // Helpers privati
  // ---------------------------------------------------------------------------

  _requireType(metodo) {
    if (!this.type) {
      throw new Error(
        `[felkit] ${metodo}() richiede che il tipo sia stato rilevato. ` +
        `Usare FatturaElettronica.from() oppure chiamare detectType() prima.`
      );
    }
  }
}
