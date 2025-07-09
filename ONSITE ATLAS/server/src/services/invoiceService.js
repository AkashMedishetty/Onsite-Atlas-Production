const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

/**
 * Generate invoice PDF for a payment.
 * @param {Object} opts { payment, registration, event }
 * @returns {Promise<string>} absolute path of pdf file
 */
module.exports = async function generateInvoice({ payment, registration, event }) {
  const outDir = path.join(__dirname, '../../public/invoices', event._id.toString());
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `invoice-${payment._id}.pdf`;
  const filePath = path.join(outDir, fileName);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  // Header
  doc.fontSize(18).text(event.name, { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Invoice #: ${payment._id}`);
  doc.text(`Date: ${new Date(payment.createdAt).toLocaleDateString()}`);
  doc.text(`Registration: ${registration.registrationId}`);
  doc.text(`Name: ${registration.personalInfo.firstName} ${registration.personalInfo.lastName}`);
  doc.moveDown();

  // Header and footer templates
  const headerHtml = event.paymentConfig?.extra?.invoiceHeader || '';
  const footerHtml = event.paymentConfig?.extra?.invoiceFooter || '';

  if(headerHtml){
    doc.fontSize(12).text(headerHtml, { align: 'center' });
    doc.moveDown();
  }

  // Table
  doc.text('Description');
  doc.text('----------------------------------------------');
  doc.text(`Event Registration  ₹ ${(payment.amountCents/100).toFixed(2)}`);

  // Taxes if any
  const gstPct = event.paymentConfig?.extra?.gstPercentage || 0;
  const vatPct = event.paymentConfig?.extra?.vatPercentage || 0;
  const inclusive = event.paymentConfig?.extra?.inclusiveTax === true;

  let net = payment.amountCents/100;
  if(inclusive && (gstPct||vatPct)){
    const taxFactor = 1 + (gstPct+vatPct)/100;
    net = net / taxFactor;
  }

  let taxTotal = 0;
  if(gstPct){
    const amt = net * gstPct/100;
    doc.text(`GST ${gstPct}%  ₹ ${amt.toFixed(2)}`);
    taxTotal += amt;
  }
  if(vatPct){
    const amt = net * vatPct/100;
    doc.text(`VAT ${vatPct}%  ₹ ${amt.toFixed(2)}`);
    taxTotal += amt;
  }

  doc.moveDown();
  doc.font('Helvetica-Bold').text(`Total: ₹ ${(net+taxTotal).toFixed(2)}`, { align: 'right' });

  if(footerHtml){
    doc.moveDown();
    doc.text('----------------------------------------------');
    doc.moveDown(0.5);
    doc.fontSize(10).text(footerHtml, { align: 'center' });
  }

  doc.end();

  return filePath;
} 