/**
 * Converte una stringa HTML in un Buffer PDF.
 *
 * - Node.js  : usa puppeteer (peer dependency opzionale).
 *              Se non installato, lancia un errore con istruzioni.
 * - Browser  : apre il dialogo di stampa nativo (window.print()).
 *              Ritorna null; il PDF viene gestito dal browser.
 *
 * @param {string} htmlString - HTML da convertire (es. output di toHTML())
 * @returns {Promise<Buffer | null>}
 */
export async function toPDF(htmlString) {
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    return toPDFBrowser(htmlString);
  }
  return toPDFNode(htmlString);
}

async function toPDFNode(htmlString) {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    throw new Error(
      '[felkit] puppeteer non trovato. Installalo con:\n' +
      '  npm install puppeteer\n' +
      'oppure usa toHTML() e gestisci la stampa autonomamente.'
    );
  }

  const browser = await puppeteer.default.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

function toPDFBrowser(htmlString) {
  console.warn(
    '[felkit] toPDF() nel browser apre il dialogo di stampa del browser. ' +
    'Per generare un PDF programmatico usa toHTML() e una libreria come jsPDF.'
  );

  // Apre la stringa HTML in una nuova finestra e ne lancia la stampa
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(htmlString);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  return null;
}
