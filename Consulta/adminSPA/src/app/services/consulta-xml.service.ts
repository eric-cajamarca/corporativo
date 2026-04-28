import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { saveAs } from 'file-saver';
import * as JSZip from 'jszip';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { global } from './global';

@Injectable({
  providedIn: 'root'
})
export class ConsultaXMLService {

  public url: any;
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    isArray: (name) => false,
    trimValues: true
  });



  // URL base de la API y token de autenticación
  // private apiUrl = 'https://api.factiliza.com/v1/sunat/xml';
  // private token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzODc0MiIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6ImNvbnN1bHRvciJ9.zSXlMD3Y18WbWFJCK79YKjI7IoVZ3n-1cIpqqnYLEpc';
  constructor(private http: HttpClient) { 
    this.url = global.url;
  }

  /**
   //* Obtiene un comprobante desde la API
  //  * @param ruc Número de RUC del emisor
  //  * @param tipoDocumento Tipo de documento (01=Factura, 03=Boleta, etc.)
  //  * @param serie Serie del documento
  //  * @param numero Número del documento
  //  * @returns Observable con la respuesta de la API
   **/

  // getComprobante(ruc: string, tipoDocumento: string, serie: string, numero: string): Observable<any> {
  //   const headers = new HttpHeaders({
  //     'Authorization': this.token
  //   });

  //   const documentoId = `${ruc}-${tipoDocumento}-${serie}-${numero}`;
  //   const url = `${this.apiUrl}/${documentoId}`;
    
  //   return this.http.get(url, { headers });
  // }

  // getComprobante1(ruc: string, tipoDocumento: string, serie: string, numero: string): Observable<any> {
  //   const headers = new HttpHeaders({
  //     'Authorization': this.token
  //   });

  //   const documentoId = `${ruc}-${tipoDocumento}-${serie}-${numero}`;
  //   const url = `${this.apiUrl}/${documentoId}`;
  //   console.log('url', url);
  //   return this.http.get(url, { headers });
  // }


  /**
   * Consulta comprobante SUNAT vía backend (Factiliza). El backend devuelve datos ya normalizados.
   * ruc, usuario, password son opcionales si la empresa tiene configurado EmpresaFactiliza.
   */
  consultarComprobanteSunat(
    body: { ruc?: string; usuario?: string; password?: string; proveedor: string; tipo_doc: string; serie: string; correlativo: string }
  ): Observable<{ message: string; data: any }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<{ message: string; data: any }>(
      this.url + 'consultar-comprobante-sunat',
      body,
      { headers, withCredentials: true }
    );
  }

  /**
   * Consulta el PDF del comprobante vía backend (Factiliza). El backend devuelve el ZIP en base64.
   */
  consultarComprobantePdf(
    body: { ruc?: string; usuario?: string; password?: string; proveedor: string; tipo_doc: string; serie: string; correlativo: string }
  ): Observable<{ message: string; data: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<{ message: string; data: string }>(
      this.url + 'factiliza/pdf',
      body,
      { headers, withCredentials: true }
    );
  }

  getComprobante(
    ruc: string,
    usuario: string,
    password: string,
    proveedor: string,
    tipo_doc: string,
    serie: string,
    correlativo: string
  ): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo };
    return this.http.post(this.url + 'xml', body, { headers, withCredentials: true });
  }


  /**
  //  * Procesa la respuesta del servidor y extrae/parsea el XML
  //  * @param respuesta Respuesta de la API (contiene ZIP en base64)
  //  * @returns Promesa con los datos parseados del XML
   */
  async procesarYMostrarXML(respuesta: any): Promise<any> {
    try {
      const xmlContent: string = respuesta.data; // ← ya es string XML
      if (!xmlContent) throw new Error('Sin XML en la respuesta');

      // 1. (opcional) descarga
      // this.descargarXML(xmlContent, 'comprobante.xml');

      // 2. convertir XML a Blob y luego a File
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const xmlFile = new File([blob], 'comprobante.xml', { type: 'application/xml' });

      // 3. usar tu función que ya ordena el comprobante
      return new Promise((resolve, reject) => {
        this.processXmlFile(xmlFile).subscribe({
          next: jsonData => resolve(jsonData),
          error: err => reject(err)
        });
      });
    } catch (error) {
      console.error('Error al procesar XML:', error);
      throw error;
    }
  }

  // async procesarYMostrarXML(respuesta: any): Promise<any> {
  //   console.log('procesarYMostrarXML respuesta', respuesta);

  //   try {
  //     // 1. respuesta.data ya es el string XML
  //     const xmlContent: string = respuesta.data;
  //     if (!xmlContent) throw new Error('Sin XML en la respuesta');

  //     // 2. (opcional) descargar
  //     this.descargarXML(xmlContent, 'comprobante.xml');

  //     // 3. convertir XML a JSON
  //     return this.parseXmlToJson(xmlContent); // o tu processXmlFile()
  //     // return new Promise((resolve, reject) => {
  //     //   this.processXmlFile(xmlContent).subscribe({
  //     //     next: jsonData => resolve(jsonData),
  //     //     error: err => reject(err)
  //     //   });
  //     // });
  //   } catch (error) {
  //     console.error('Error al procesar XML:', error);
  //     throw error;
  //   }

  //   // try {
  //   //   if (!respuesta?.data) {
  //   //     throw new Error('Respuesta del servidor inválida: sin datos');
  //   //   }

  //   //   // 1. Convertir base64 a Uint8Array
  //   //   const byteArray = this.base64ToUint8Array(respuesta.data);
      
  //   //   // 2. Extraer XML del ZIP
  //   //   const { xmlContent, xmlFilename } = await this.extraerXmlDeZip(byteArray);
      
  //   //   //  3. Descargar el XML automáticamente
  //   //   this.descargarXML(xmlContent, xmlFilename);

  //   //   ///------------------------------------------//
  //   //    // se agrega este codigo para manejarlo desde la api y la conversion correcta a json
  //   //   // 4. Convertir el string XML a un objeto File
  //   //   const xmlFile = new File([xmlContent], xmlFilename, { type: 'application/xml' });

  //   //   // 5. Usar processXmlFile para convertir a JSON (devuelve Observable)
  //   //   return new Promise((resolve, reject) => {
  //   //     this.processXmlFile(xmlFile).subscribe({
  //   //       next: jsonData => resolve(jsonData),
  //   //       error: err => reject(err)
  //   //     });
  //   //   });
  //   //   //-----------------------------------------------//
  //   //   //       // // 4. Parsear XML a JSON con fast-xml-parser
  //   //   // const jsonData = this.parseXmlToJson(xmlContent);
      
  //   //   //  return jsonData;
  //   // } catch (error) {
  //   //   console.error('Error al procesar XML:', error);
  //   //   //throw new Error(`Error al procesar el comprobante: ${error.message}`);
  //   // }
  // }

  /**
   * Convierte una cadena base64 a Uint8Array
   * @param base64Data Cadena en base64
   * @returns Uint8Array con los datos binarios
   */
  private base64ToUint8Array(base64Data: string): Uint8Array {
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      return new Uint8Array(byteNumbers);
    } catch (error) {
      throw new Error('Formato base64 inválido');
    }
  }

  /**
  //  * Extrae el contenido XML desde un archivo ZIP
  //  * @param byteArray Datos binarios del ZIP
  //  * @returns Objeto con el contenido XML y el nombre del archivo
   */
  private async extraerXmlDeZip(byteArray: Uint8Array): Promise<{ xmlContent: string, xmlFilename: string }> {
    try {
      const zip = await JSZip.loadAsync(byteArray);
      
      // Buscar el primer archivo XML en el ZIP (ignorando mayúsculas/minúsculas)
      const xmlFileEntry = Object.keys(zip.files).find(file => 
        file.toLowerCase().endsWith('.xml')
      );
      
      if (!xmlFileEntry) {
        throw new Error('No se encontró archivo XML en el ZIP descargado');
      }
      
      const xmlContent = await zip.files[xmlFileEntry].async('text');
      return { xmlContent, xmlFilename: xmlFileEntry };
    } catch (error) {
      throw new Error(`Error al extraer XML del ZIP: ${(error as any).message}`);
    }
  }

  /**
  //  * Descarga el XML como archivo en el navegador
  //  * @param xmlContent Contenido del XML como string
  //  * @param filename Nombre del archivo para descargar
   */
  private descargarXML(xmlContent: string, filename: string): void {
    try {
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      saveAs(blob, filename || `comprobante_${Date.now()}.xml`);
    } catch (error) {
      console.warn('No se pudo descargar el XML:', error);
      // No lanzamos error porque esto no debería detener el flujo principal
    }
  }

  /**
   * Descarga el PDF desde la respuesta del backend.
   * Acepta: (1) PDF en base64 directo (API sunat/reporte) o (2) ZIP en base64 que contiene un PDF (API sunat/pdf).
   */
  async descargarPdfDesdeRespuesta(respuesta: { data?: string }): Promise<void> {
    const base64 = respuesta?.data;
    if (!base64) {
      throw new Error('No se recibió PDF en la respuesta');
    }
    const bytes = this.base64ToUint8Array(base64);
    const isPdf = bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    if (isPdf) {
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([buffer], { type: 'application/pdf' });
      saveAs(blob, `comprobante_${Date.now()}.pdf`);
      return;
    }
    const zip = await JSZip.loadAsync(bytes);
    const pdfEntryName = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.pdf'));
    if (!pdfEntryName) {
      throw new Error('No se encontró archivo PDF en el ZIP descargado');
    }
    const pdfData = await zip.files[pdfEntryName].async('uint8array');
    const buffer = pdfData.buffer.slice(pdfData.byteOffset, pdfData.byteOffset + pdfData.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'application/pdf' });
    saveAs(blob, pdfEntryName || `comprobante_${Date.now()}.pdf`);
  }

  /**
  //  * Parsea XML a JSON usando fast-xml-parser con configuración optimizada
  //  * @param xmlString Cadena XML a parsear
  //  * @returns Objeto JSON con los datos estructurados
   */
  private parseXmlToJson(xmlString: string): any {
    // Validar primero el XML
    const validation = XMLValidator.validate(xmlString);
    if (validation !== true) {
      throw new Error(`XML inválido: ${validation.err?.msg}`);
    }

    // Configuración optimizada para facturas electrónicas SUNAT/UBL
    const parserOptions = {
      ignoreAttributes: false,      // Conservar atributos
      attributeNamePrefix: '@_',    // Prefijo para atributos
      textNodeName: '#text',        // Nombre para nodos de texto
      ignoreDeclaration: true,      // Ignorar <?xml...?>
      removeNSPrefix: false,        // Conservar namespaces (cac:, cbc:)
      isArray: (name: string) => {
        // Definir qué elementos siempre deben ser arrays
        return [
          'cac:InvoiceLine', 
          'InvoiceLine',
          'cac:TaxSubtotal',
          'cac:AdditionalProperty'
        ].includes(name);
      },
      trimValues: true,             // Limpiar espacios en valores
      parseAttributeValue: true     // Parsear atributos a tipos correctos
    };

    const parser = new XMLParser(parserOptions);
    try {
      const jsonResult = parser.parse(xmlString);
      return this.normalizeInvoiceData(jsonResult);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error al parsear XML: ${error.message}`);
      } else {
        throw new Error('Error al parsear XML: error desconocido');
      }
    }
  }

  /**
  //  * Normaliza los datos de la factura a una estructura consistente
  //  * @param jsonData Datos parseados del XML
  //  * @returns Estructura normalizada del comprobante
   */
  private normalizeInvoiceData(jsonData: any): any {
    // Buscar el nodo principal (Invoice, CreditNote, etc.)
    const invoice = jsonData.Invoice || jsonData['invoice:Invoice'] || 
                   jsonData.CreditNote || jsonData['creditnote:CreditNote'] ||
                   jsonData;

    if (!invoice) {
      throw new Error('No se encontró nodo principal en el XML');
    }

    // Extracción robusta de datos
    return {
      informacionGeneral: this.getGeneralInfo(invoice),
      emisor: this.getPartyData(invoice, 'AccountingSupplierParty'),
      cliente: this.getPartyData(invoice, 'AccountingCustomerParty'),
      items: this.getInvoiceLines(invoice),
      impuestos: this.getTaxSummary(invoice),
      // ... otros datos relevantes
    };
  }

  /**
   * Extrae información general del comprobante
   */
  private getGeneralInfo(invoiceNode: any): any {
    const getValue = (path: string[]) => path.reduce((obj, key) => 
      (obj && obj[key]) ? obj[key] : null, invoiceNode)?.['#text']?.trim() || '';

    return {
      tipoDocumento: getValue(['cbc:InvoiceTypeCode']) || 
                    getValue(['cbc:CreditNoteTypeCode']) || 
                    'Desconocido',
      serieNumero: getValue(['cbc:ID']),
      fechaEmision: getValue(['cbc:IssueDate']),
      moneda: getValue(['cbc:DocumentCurrencyCode']),
      
      // ... otros campos
    };
  }

  /**
  //  * Extrae datos de emisor/cliente
  //  * @param partyType 'AccountingSupplierParty' o 'AccountingCustomerParty'
   */
  private getPartyData(invoiceNode: any, partyType: string): any {
    const partyNode = invoiceNode[`cac:${partyType}`] || invoiceNode[partyType];
    if (!partyNode) return {};

    const party = partyNode['cac:Party'] || partyNode.Party;
    if (!party) return {};

    // Extraer RUC/DNI
    const partyIdNode = party['cac:PartyIdentification'] || party.PartyIdentification;
    const ruc = partyIdNode?.['cbc:ID']?.['#text']?.trim() || '';

    // Extraer razón social
    const partyName = party['cac:PartyName'] || party.PartyName;
    const razonSocial = partyName?.['cbc:Name']?.['#text']?.trim() || '';

    return { ruc, razonSocial };
  }

  /**
   * Extrae líneas de detalle del comprobante
   */
  private getInvoiceLines(invoiceNode: any): any[] {
    const lines = invoiceNode['cac:InvoiceLine'] || invoiceNode.InvoiceLine;
    if (!lines) return [];

    const normalizedLines = Array.isArray(lines) ? lines : [lines];
    
    return normalizedLines.map(line => ({
      descripcion: line['cac:Item']?.['cbc:Description']?.['#text']?.trim() || '',
      cantidad: line['cbc:InvoicedQuantity']?.['#text']?.trim() || '0',
      precioUnitario: line['cac:Price']?.['cbc:PriceAmount']?.['#text']?.trim() || '0',
      // ... otros campos de línea
    }));
  }

  /**
   * Extrae resumen de impuestos
   */
  private getTaxSummary(invoiceNode: any): any {
    const taxTotal = invoiceNode['cac:TaxTotal'] || invoiceNode.TaxTotal;
    if (!taxTotal) return {};

    return {
      totalIgv: taxTotal['cbc:TaxAmount']?.['#text']?.trim() || '0',
      // ... otros impuestos
    };
  }



  //////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////

   /**
  //  * Procesa un archivo XML subido por el usuario
  //  * @param file Archivo XML
  //  * @returns Observable con los datos parseados
   */
  processXmlFile(file: File): Observable<any> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const xmlString = e.target?.result as string;
          const jsonData = this.parseXml(xmlString);
          observer.next(jsonData);
          observer.complete();
        } catch (error) {
          observer.error('Error al procesar el XML: ');
        }
      };

      reader.onerror = () => {
        observer.error('Error al leer el archivo');
      };

      reader.readAsText(file);
    });
  }

  /**
   * Parsea XML a JSON
  //  * @param xmlString Contenido XML como string
  //  * @returns Objeto JSON con los datos
   */
  private parseXml(xmlString: string): any {
    try {
      const jsonObj = this.parser.parse(xmlString);
      return this.normalizeData(jsonObj);
    } catch (error) {
      throw new Error('XML inválido: ');
    }
  }

  /**
   * Normaliza los datos del XML a una estructura consistente
   */
  // En XmlService
  private normalizeData(xmlData: any): any {
  // Buscar el nodo Invoice en diferentes formatos y namespaces
  const invoice = 
    xmlData.Invoice || 
    xmlData['invoice:Invoice'] || 
    xmlData['ubl:Invoice'] || 
    xmlData['fe:Invoice'] || 
    xmlData['Invoice'];
  
  if (!invoice) throw new Error('No se encontró nodo Invoice');

  // Función auxiliar para obtener valores con múltiples posibles paths
  const getValue = (...paths: string[]) => {
    for (const path of paths) {
      const parts = path.split('.');
      let value = invoice;
      
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      
      if (value !== undefined) {
        return typeof value === 'object' ? value['#text'] || value : value;
      }
    }
    return undefined;
  };

  // Función para procesar líneas de detalle
  const processInvoiceLines = () => {
    const lines = invoice['cac:InvoiceLine'] || [];
    const linesArray = Array.isArray(lines) ? lines : [lines];
    
    return linesArray.map((line: any) => ({
      id: line['cbc:ID'],
      cantidad: line['cbc:InvoicedQuantity']?.['#text'],
      unidadMedida: line['cbc:InvoicedQuantity']?.['@_unitCode'],
      descripcion: line['cac:Item']?.['cbc:Description'],
      codigoProducto: line['cac:Item']?.['cac:SellersItemIdentification']?.['cbc:ID'],
      precioUnitario: line['cac:Price']?.['cbc:PriceAmount']?.['#text'],
      precioReferencial: line['cac:PricingReference']?.['cac:AlternativeConditionPrice']?.['cbc:PriceAmount']?.['#text'],
      tipoPrecio: line['cac:PricingReference']?.['cac:AlternativeConditionPrice']?.['cbc:PriceTypeCode']?.['#text'],
      valorVenta: line['cbc:LineExtensionAmount']?.['#text'],
      impuestos: processTaxes(line['cac:TaxTotal']),
      // Campos adicionales
      // almacen: getAdditionalItemData(line['cbc:ID'], 'ITEM_ALMACEN'),
      // bultos: getAdditionalItemData(line['cbc:ID'], 'ITEM_BULTOS')
    }));
  };

  // Función para procesar impuestos
  const processTaxes = (taxTotal: any) => {
    if (!taxTotal) return [];
    const taxes = taxTotal['cac:TaxSubtotal'] || [];
    const taxesArray = Array.isArray(taxes) ? taxes : [taxes];
    
    return taxesArray.map((tax: any) => ({
      codigo: tax['cac:TaxCategory']?.['cac:TaxScheme']?.['cbc:ID']?.['#text'],
      nombre: tax['cac:TaxCategory']?.['cac:TaxScheme']?.['cbc:Name']?.['#text'],
      tipo: tax['cac:TaxCategory']?.['cac:TaxScheme']?.['cbc:TaxTypeCode']?.['#text'],
      baseImponible: tax['cbc:TaxableAmount']?.['#text'],
      porcentaje: tax['cac:TaxCategory']?.['cbc:Percent']?.['#text'],
      importe: tax['cbc:TaxAmount']?.['#text'],
      afectacion: tax['cac:TaxCategory']?.['cbc:TaxExemptionReasonCode']?.['#text']
    }));
  };

  // Función para obtener datos adicionales de items
  const getAdditionalItemData = (lineId: string, propertyName: string) => {
    const extensions = invoice['cec:UBLExtensions']?.['cec:UBLExtension'] || [];
    const extensionsArray = Array.isArray(extensions) ? extensions : [extensions];
    
    for (const ext of extensionsArray) {
      const itemData = ext['cec:ExtensionContent']?.['fac:AdditionalData']?.['fac:AdditionalItemData'] || [];
      const itemDataArray = Array.isArray(itemData) ? itemData : [itemData];
      
      for (const item of itemDataArray) {
        if (item['fac:LineItem']?.['cbc:ID'] === lineId) {
          const columns = item['fac:AdditionalItemColumn'] || [];
          const columnsArray = Array.isArray(columns) ? columns : [columns];
          
          for (const col of columnsArray) {
            if (col['cbc:Name'] === propertyName) {
              return col['cbc:Value'];
            }
          }
        }
      }
    }
    return undefined;
  };

  // Función para obtener propiedades adicionales impresas
  const getAdditionalPrintedProperties = () => {
    const extensions = invoice['cec:UBLExtensions']?.['cec:UBLExtension'] || [];
    const extensionsArray = Array.isArray(extensions) ? extensions : [extensions];
    const result: Record<string, string> = {};
    
    for (const ext of extensionsArray) {
      const printedProps = ext['cec:ExtensionContent']?.['fac:AdditionalPrintedElement']?.['fac:AdditionalPrintedProperty'] || [];
      const printedPropsArray = Array.isArray(printedProps) ? printedProps : [printedProps];
      
      for (const prop of printedPropsArray) {
        if (prop['cbc:ID'] && prop['cbc:Value']) {
          result[prop['cbc:ID']] = prop['cbc:Value'];
        }
      }
    }
    return result;
  };

  //aqui transformo los datos
  // Procesar datos principales
  const additionalProps = getAdditionalPrintedProperties();
  
  return {
    informacionGeneral: {
      ublVersion: getValue('cbc:UBLVersionID'),
      customizationId: getValue('cbc:CustomizationID'),
      tipoDocumento: getValue('cbc:InvoiceTypeCode', 'InvoiceTypeCode'),
      serieNumero: getValue('cbc:ID', 'ID'),
      fechaEmision: getValue('cbc:IssueDate', 'IssueDate'),
      horaEmision: getValue('cbc:IssueTime', 'IssueTime'),
      fechaVencimiento: getValue('cbc:DueDate', 'DueDate'),
      moneda: getValue('cbc:DocumentCurrencyCode', 'DocumentCurrencyCode'),
      totalLineas: getValue('cbc:LineCountNumeric', 'LineCountNumeric'),
      tipoOperacion: getValue('cbc:ProfileID', 'ProfileID')
    },
    emisor: {
      ruc: getValue(
        'cac:AccountingSupplierParty.cac:Party.cac:PartyIdentification.cbc:ID',
        'AccountingSupplierParty.Party.PartyIdentification.ID'
      ),
      razonSocial: getValue(
        'cac:AccountingSupplierParty.cac:Party.cac:PartyName.cbc:Name',
        'AccountingSupplierParty.Party.PartyName.Name'
      ),
      nombreComercial: getValue(
        'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cbc:RegistrationName',
        'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationName'
      ),
      direccion: {
        ubigeo: getValue(
          'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cbc:ID',
          'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationAddress.ID'
        ),
        direccion: getValue(
          'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cbc:StreetName',
          'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationAddress.StreetName'
        ),
        urbanizacion: getValue(
          'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cbc:CitySubdivisionName',
          'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationAddress.CitySubdivisionName'
        ),
        provincia: getValue(
          'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cbc:CountrySubentity',
          'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationAddress.CountrySubentity'
        ),
        departamento: getValue(
          'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cbc:CityName',
          'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationAddress.CityName'
        ),
        distrito: getValue(
          'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cbc:District',
          'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationAddress.District'
        ),
        pais: getValue(
          'cac:AccountingSupplierParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cac:Country.cbc:IdentificationCode',
          'AccountingSupplierParty.Party.PartyLegalEntity.RegistrationAddress.Country.IdentificationCode'
        )
      }
    },
    cliente: {
      // Por defecto RUC, podría extraerse del schemeID
        numeroDocumento: getValue(
          'cac:AccountingCustomerParty.cac:Party.cac:PartyIdentification.cbc:ID',
          'AccountingCustomerParty.Party.PartyIdentification.ID'
        ),
        razonSocial: getValue(
          'cac:AccountingCustomerParty.cac:Party.cac:PartyLegalEntity.cbc:RegistrationName',
          'AccountingCustomerParty.Party.PartyLegalEntity.RegistrationName.#text'
        ),
        direccion: getValue(
          'cac:AccountingCustomerParty.cac:Party.cac:PhysicalLocation.cbc:Description',
          'cac:AccountingCustomerParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cac:AddressLine.cbc:Line',
          'AccountingCustomerParty.Party.PartyLegalEntity.RegistrationAddress.AddressLine.Line.#text'
        ),
        ubigeo: getValue(
          'cac:AccountingCustomerParty.cac:Party.cac:PhysicalLocation.cbc:CountrySubentityCode',
          'cac:AccountingCustomerParty.cac:Party.cac:PartyLegalEntity.cac:RegistrationAddress.cbc:CountrySubentityCode'
        )

       
          },
        totales: {
        totalValorVenta: getValue(
          'cac:LegalMonetaryTotal.cbc:LineExtensionAmount',
          'LegalMonetaryTotal.LineExtensionAmount'
        ),
        totalImpuestos: getValue(
          'cac:TaxTotal.cbc:TaxAmount.#text',
          'TaxTotal.TaxAmount.#text'
        ),
        totalVenta: getValue(
          'cac:LegalMonetaryTotal.cbc:TaxInclusiveAmount',
          'LegalMonetaryTotal.TaxInclusiveAmount'
        ),
        totalPagar: getValue(
          'cac:LegalMonetaryTotal.cbc:PayableAmount',
          'LegalMonetaryTotal.PayableAmount'
        )
          },
        impuestos:{
          total: getValue(
          'cac:TaxTotal.cbc:TaxAmount.#text',
          'TaxTotal.TaxAmount.#text'
          ),
          codigo: getValue(
            'cac:TaxTotal.cac:TaxSubtotal.cac:TaxCategory.cbc:ID.#text'
          ),
          tipo: getValue(
            'cac:TaxTotal.cac:TaxSubtotal.cac:TaxCategory.cac:TaxScheme.cbc:Name',
            
          ),
          
        },
    // impuestos:{
    //   codigo: getValue('cac:taxTotal.')
    // }
    detalles: processInvoiceLines(),
    informacionAdicional: {
      formaPago: getValue(
        'cac:PaymentTerms.cbc:PaymentMeansID',
        'PaymentTerms.PaymentMeansID'
      ),
      vendedor: additionalProps['VENDEDOR'],
      direccionEntrega: additionalProps['DIRECCION_ENTREGA'],
      plantilla: additionalProps['DCL_PLANTILLA'],
      email: additionalProps['DCL_EMAIL'],
      // firmaDigital: {
      //   id: getValue('cac:Signature.cbc:ID', 'Signature.ID'),
      //   rucFirmante: getValue(
      //     'cac:Signature.cac:SignatoryParty.cac:PartyIdentification.cbc:ID.#text',
      //     'Signature.SignatoryParty.PartyIdentification.ID.#text'
      //   ),
      //   razonSocialFirmante: getValue(
      //     'cac:Signature.cac:SignatoryParty.cac:PartyName.cbc:Name.#text',
      //     'Signature.SignatoryParty.PartyName.Name.#text'
      //   ),
      //   uri: getValue(
      //     'cac:Signature.cac:DigitalSignatureAttachment.cac:ExternalReference.cbc:URI',
      //     'Signature.DigitalSignatureAttachment.ExternalReference.URI'
      //   )
      // }
    }
  };
}
}
