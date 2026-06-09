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
  const senderPn = key.senderPn || key.participantPn;
  if (senderPn) {
    const phone = jidToPhone(senderPn);
    return {
      replyTo: phone || senderPn,
      logId: phone || String(senderPn).split('@')[0]
    };
  }

  // Baileys 6.7+: cuando remoteJid es @lid, remoteJidAlt suele traer el JID con telefono real.
  const remoteJidAlt = String(key.remoteJidAlt || '');
  if (remoteJidAlt.endsWith('@s.whatsapp.net')) {
    const phoneAlt = jidToPhone(remoteJidAlt);
    if (phoneAlt) {
      return { replyTo: phoneAlt, logId: phoneAlt };
    }
  }

  const remoteJid = String(key.remoteJid || '');
  if (remoteJid.endsWith('@s.whatsapp.net')) {
    const phone = jidToPhone(remoteJid);
    if (phone) return { replyTo: phone, logId: phone };
  }

  if (remoteJid.endsWith('@lid')) {
    const mappedJid = lidMaps?.lidToJid?.get(remoteJid);
    if (mappedJid) {
      const phone = jidToPhone(mappedJid);
      return {
        replyTo: phone || mappedJid,
        logId: phone || remoteJid.split('@')[0]
      };
    }
    const mappedPhone = lidMaps?.lidToPhone?.get(remoteJid);
    if (mappedPhone) {
      return { replyTo: mappedPhone, logId: mappedPhone };
    }
    // Chat consigo mismo / pruebas desde el mismo celular vinculado al bot (LID sin mapear).
    if (key.fromMe && telefonoVinculado) {
      const phone = String(telefonoVinculado).replace(/\D/g, '');
      if (phone) return { replyTo: phone, logId: phone };
    }
    return {
      replyTo: remoteJid,
      logId: remoteJid.split('@')[0]
    };
  }

  return null;
}

module.exports = {
  toWhatsAppJid,
  jidToPhone,
  isIndividualChatJid,
  resolveInboundSender
};
