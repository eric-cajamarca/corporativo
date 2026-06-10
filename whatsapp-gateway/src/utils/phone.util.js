function toWhatsAppJid(number) {
  const raw = String(number || '').trim();
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) throw new Error('Numero de destino invalido');
  return `${digits}@s.whatsapp.net`;
}

function jidToPhone(jid) {
  const raw = String(jid || '').trim();
  if (!raw || raw.endsWith('@lid')) return '';
  const base = raw.split('@')[0];
  return base.split(':')[0].replace(/\D/g, '') || '';
}

function isIndividualChatJid(jid) {
  const raw = String(jid || '');
  return raw.endsWith('@s.whatsapp.net') || raw.endsWith('@lid');
}

function resolveInboundSender(message, lidMaps, telefonoVinculado) {
  const key = message?.key || {};
  const remoteJid = String(key.remoteJid || '');
  const remoteJidAlt = String(key.remoteJidAlt || '');
  const senderPn = key.senderPn || key.participantPn;

  // WhatsApp moderno usa @lid: hay que responder al MISMO JID o el celular muestra
  // "Esperando mensaje" (fallo de descifrado E2E).
  if (remoteJid.endsWith('@lid')) {
    let logId = remoteJid.split('@')[0];
    let phone = '';
    if (senderPn) phone = jidToPhone(senderPn);
    if (!phone && remoteJidAlt.endsWith('@s.whatsapp.net')) {
      phone = jidToPhone(remoteJidAlt);
    }
    if (!phone) {
      const mappedJid = lidMaps?.lidToJid?.get(remoteJid);
      if (mappedJid) phone = jidToPhone(mappedJid);
    }
    if (!phone) {
      const mappedPhone = lidMaps?.lidToPhone?.get(remoteJid);
      if (mappedPhone) phone = mappedPhone;
    }
    if (!phone && key.fromMe && telefonoVinculado) {
      phone = String(telefonoVinculado).replace(/\D/g, '');
    }
    if (phone) logId = phone;
    return { replyTo: remoteJid, logId };
  }

  if (senderPn) {
    const phone = jidToPhone(senderPn);
    return {
      replyTo: phone || senderPn,
      logId: phone || String(senderPn).split('@')[0]
    };
  }

  if (remoteJidAlt.endsWith('@s.whatsapp.net')) {
    const phoneAlt = jidToPhone(remoteJidAlt);
    if (phoneAlt) {
      return { replyTo: phoneAlt, logId: phoneAlt };
    }
  }

  if (remoteJid.endsWith('@s.whatsapp.net')) {
    const phone = jidToPhone(remoteJid);
    if (phone) return { replyTo: phone, logId: phone };
  }

  return null;
}

/**
 * JID de salida: si conocemos el @lid del contacto, usarlo en lugar de @s.whatsapp.net.
 */
function resolveOutboundJid(number, lidMaps) {
  const raw = String(number || '').trim();
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) throw new Error('Numero de destino invalido');
  const lid = lidMaps?.phoneToLid?.get(digits);
  if (lid) return lid;
  return `${digits}@s.whatsapp.net`;
}

module.exports = {
  toWhatsAppJid,
  jidToPhone,
  isIndividualChatJid,
  resolveInboundSender,
  resolveOutboundJid
};
