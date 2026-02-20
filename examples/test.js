/**
 * Script di verifica manuale per felkit.
 *
 * Utilizza la fattura di esempio examples/IT01234567890_FPR02.xml
 *
 * Esecuzione: node examples/test.js
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { FatturaElettronica, parseXML, validateXSD } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xmlReale = await readFile(join(__dirname, 'IT01234567890_FPR02.xml'), 'utf8');

async function main() {
  console.log('=== felkit — test manuale ===\n');

  // 1. Parsing
  console.log('1) parseXML():');
  const parsed = parseXML(xmlReale);
  const rootKey = Object.keys(parsed).find((k) => k !== '?xml');
  console.log(`   Elemento radice: ${rootKey}`);
  console.log('   OK\n');

  // 2. Costruttore sincrono
  console.log('2) new FatturaElettronica():');
  const fatturaSync = new FatturaElettronica(xmlReale);
  console.log(`   type (prima di detectType): ${fatturaSync.type}`);
  console.log('   OK\n');

  // 3. toJSON()
  console.log('3) toJSON():');
  const json = fatturaSync.toJSON();
  const parsed2 = JSON.parse(json);
  const chiavi = Object.keys(parsed2).filter((k) => k !== '?xml');
  console.log(`   Chiavi fattura: ${chiavi.join(', ')}`);
  console.log('   OK\n');

  // 4. validateXSD diretto
  console.log('4) validateXSD() su fattura reale:');
  const valResult = await validateXSD(xmlReale, 'FatturaOrdinaria');
  console.log(`   valid: ${valResult.valid}`);
  if (!valResult.valid) {
    console.log(`   errori: ${valResult.errors.slice(0, 3).join('\n          ')}`);
  }
  console.log('   OK\n');

  // 5. FatturaElettronica.from() — rilevamento tipo via XSD
  console.log('5) FatturaElettronica.from() — rilevamento tipo:');
  try {
    const fattura = await FatturaElettronica.from(xmlReale);
    console.log(`   Tipo rilevato: ${fattura.type}`);
    console.log('   OK\n');

    // 6. validate()
    console.log('6) validate():');
    const vr = await fattura.validate();
    console.log(`   valid: ${vr.valid}`);
    if (!vr.valid && vr.errors.length > 0) {
      console.log(`   errori: ${vr.errors.slice(0, 3).join('\n          ')}`);
    }
    console.log('   OK\n');

    // 7. toHTML()
    console.log('7) toHTML():');
    try {
      const html = await fattura.toHTML();
      console.log(`   Lunghezza HTML: ${html.length} caratteri`);
      console.log('   OK\n');
    } catch (e) {
      console.log(`   Errore: ${e.message}\n`);
    }

  } catch (e) {
    console.log(`   Errore: ${e.message}\n`);
  }

  console.log('=== fine test ===');
}

main().catch(console.error);
