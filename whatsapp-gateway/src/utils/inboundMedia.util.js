const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const MAX_ATTACHMENT_BYTES =
  Number(process.env.WHATSAPP_INBOUND_MAX_ATTACHMENT_BYTES) || 4 * 1024 * 1024;

function extractMessageText(message) {
  const content = message?.message;
  if (!content) return '';
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.buttonsResponseMessage?.selectedDisplayText) {
    return content.buttonsResponseMessage.selectedDisplayText;
  }
  if (content.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return content.listResponseMessage.singleSelectReply.selectedRowId;
  }
  if (content.listResponseMessage?.title) return content.listResponseMessage.title;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.documentMessage?.caption) return content.documentMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  if (content.audioMessage) return '[audio]';
  if (content.stickerMessage) return '[sticker]';
  if (content.imageMessage) return '[imagen]';
  if (content.videoMessage) return '[video]';
  if (content.locationMessage || content.liveLocationMessage) return '[ubicacion]';
  if (content.contactMessage) return '[contacto]';
  return '';
}

function extractAttachmentMeta(message) {
  const content = message?.message;
  if (!content) return null;

  if (content.documentMessage) {
    return {
      kind: 'document',
      mimeType: content.documentMessage.mimetype || 'application/octet-stream',
      fileName: content.documentMessage.fileName || 'documento',
      caption: content.documentMessage.caption || ''
    };
  }
  if (content.imageMessage) {
    return {
      kind: 'image',
      mimeType: content.imageMessage.mimetype || 'image/jpeg',
      fileName: 'imagen.jpg',
      caption: content.imageMessage.caption || ''
    };
  }
  return null;
}

function esArchivoListaSoportado(meta) {
  if (!meta || meta.kind === 'image') return false;
  const fn = String(meta.fileName || '').toLowerCase();
  const mime = String(meta.mimeType || '').toLowerCase();
  if (fn.endsWith('.xlsx')) return true;
  if (mime.includes('spreadsheetml')) return true;
  if (fn.endsWith('.pdf') || mime === 'application/pdf') return true;
  return false;
}

function inboundTieneContenido(message) {
  const text = String(extractMessageText(message) || '').trim();
  const meta = extractAttachmentMeta(message);
  if (text) return true;
  return esArchivoListaSoportado(meta);
}

async function descargarAdjunto(message, sock, logger) {
  const meta = extractAttachmentMeta(message);
  if (!meta || !esArchivoListaSoportado(meta)) return null;

  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: logger || { level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => logger },
        reuploadRequest: sock?.updateMediaMessage
      }
    );
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return null;
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      return { tooLarge: true, meta };
    }
    return {
      kind: meta.kind,
      mimeType: meta.mimeType,
      fileName: meta.fileName,
      base64: buffer.toString('base64'),
      sizeBytes: buffer.length,
      caption: meta.caption || ''
    };
  } catch (err) {
    console.error('inboundMedia descargarAdjunto:', err.message);
    return null;
  }
}

module.exports = {
  extractMessageText,
  extractAttachmentMeta,
  esArchivoListaSoportado,
  inboundTieneContenido,
  descargarAdjunto,
  MAX_ATTACHMENT_BYTES
};
