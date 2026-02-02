/**
 * Normaliza el resultado de xml2js a la estructura esperada por el frontend
 * (informacionGeneral, emisor, cliente, totales, impuestos, detalles)
 * xml2js con explicitArray: false devuelve: { 'cbc:ID': 'F001-1', 'cac:InvoiceLine': { ... } }
 * Los textos pueden venir como string directo o en objeto con clave '_'
 */
function getVal(obj, ...pathStrings) {
  if (!obj) return undefined;
  for (const pathStr of pathStrings) {
    const parts = pathStr.split('.');
    let value = obj;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && '_' in value) return value._;
      if (typeof value === 'object' && '#text' in value) return value['#text'];
      return typeof value === 'object' ? undefined : value;
    }
  }
  return undefined;
}

function getValInvoice(invoice, ...paths) {
  for (const path of paths) {
    const parts = path.split('.');
    let value = invoice;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && '_' in value) return value._;
      if (typeof value === 'object' && '#text' in value) return value['#text'];
      return typeof value === 'object' ? undefined : value;
    }
  }
  return undefined;
}

function processInvoiceLines(invoice) {
  const lines = invoice['cac:InvoiceLine'] || invoice['InvoiceLine'];
  if (!lines) return [];
  const arr = Array.isArray(lines) ? lines : [lines];
  return arr.map((line) => {
    const qty = line['cbc:InvoicedQuantity'];
    const cantidad = typeof qty === 'object' ? (qty && (qty._ || qty['#text'])) : qty;
    const unitCode = typeof qty === 'object' && qty && qty['$'] ? qty['$'].unitCode : undefined;
    const price = line['cac:Price'] && line['cac:Price']['cbc:PriceAmount'];
    const precioUnitario = typeof price === 'object' ? (price && (price._ || price['#text'])) : price;
    const item = line['cac:Item'] || line['Item'];
    const desc = item && item['cbc:Description'];
    const descripcion = typeof desc === 'object' ? (desc && (desc._ || desc['#text'])) : desc;
    const sellerId = item && (item['cac:SellersItemIdentification'] || item['SellersItemIdentification']) && (item['cac:SellersItemIdentification'] || item['SellersItemIdentification'])['cbc:ID'];
    const codigoProducto = typeof sellerId === 'object' ? (sellerId && (sellerId._ || sellerId['#text'])) : sellerId;
    const lineExt = line['cbc:LineExtensionAmount'];
    const valorVenta = typeof lineExt === 'object' ? (lineExt && (lineExt._ || lineExt['#text'])) : lineExt;
    return {
      id: getVal(line, 'cbc:ID'),
      cantidad: cantidad || '0',
      unidadMedida: unitCode || 'NIU',
      descripcion: descripcion || '',
      codigoProducto: codigoProducto || '',
      precioUnitario: precioUnitario || '0',
      valorVenta: valorVenta || '0'
    };
  });
}

function normalizeData(xmlParsed) {
  const invoice = xmlParsed.Invoice || xmlParsed['invoice:Invoice'] || xmlParsed['ubl:Invoice'] || xmlParsed;
  if (!invoice) throw new Error('No se encontró nodo Invoice en el XML');

  const getV = (...paths) => getValInvoice(invoice, ...paths);

  return {
    informacionGeneral: {
      tipoDocumento: getV('cbc:InvoiceTypeCode'),
      serieNumero: getV('cbc:ID'),
      fechaEmision: getV('cbc:IssueDate'),
      horaEmision: getV('cbc:IssueTime'),
      fechaVencimiento: getV('cbc:DueDate'),
      moneda: getV('cbc:DocumentCurrencyCode')
    },
    emisor: {
      ruc: getVal(invoice, 'cac:AccountingSupplierParty.cac:Party.cac:PartyIdentification.cbc:ID') || getV('cac:AccountingSupplierParty.cac:Party.cac:PartyIdentification.cbc:ID'),
      razonSocial: getVal(invoice, 'cac:AccountingSupplierParty.cac:Party.cac:PartyName.cbc:Name') || getV('cac:AccountingSupplierParty.cac:Party.cac:PartyName.cbc:Name')
    },
    cliente: {
      numeroDocumento: invoice['cac:AccountingCustomerParty'] && getVal(invoice['cac:AccountingCustomerParty'], 'cac:Party', 'cac:PartyIdentification', 'cbc:ID'),
      razonSocial: invoice['cac:AccountingCustomerParty'] && getVal(invoice['cac:AccountingCustomerParty'], 'cac:Party', 'cac:PartyLegalEntity', 'cbc:RegistrationName')
    },
    totales: {
      totalValorVenta: getV('cac:LegalMonetaryTotal', 'cbc:LineExtensionAmount') || (invoice['cac:LegalMonetaryTotal'] && getVal(invoice['cac:LegalMonetaryTotal'], 'cbc:LineExtensionAmount')),
      totalImpuestos: getV('cac:TaxTotal', 'cbc:TaxAmount') || (invoice['cac:TaxTotal'] && getVal(invoice['cac:TaxTotal'], 'cbc:TaxAmount')),
      totalVenta: getV('cac:LegalMonetaryTotal', 'cbc:TaxInclusiveAmount') || (invoice['cac:LegalMonetaryTotal'] && getVal(invoice['cac:LegalMonetaryTotal'], 'cbc:TaxInclusiveAmount')),
      totalPagar: getV('cac:LegalMonetaryTotal', 'cbc:PayableAmount') || (invoice['cac:LegalMonetaryTotal'] && getVal(invoice['cac:LegalMonetaryTotal'], 'cbc:PayableAmount'))
    },
    impuestos: {
      total: getV('cac:TaxTotal', 'cbc:TaxAmount') || (invoice['cac:TaxTotal'] && getVal(invoice['cac:TaxTotal'], 'cbc:TaxAmount'))
    },
    detalles: processInvoiceLines(invoice),
    observacion: ''
  };
}

module.exports = { normalizeData, getValInvoice };
