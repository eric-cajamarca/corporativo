function toWhatsAppJid(number) {
  const raw = String(number || '').trim();
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) throw new Error('Numero de destino invalido');
  return `${digits}@s.whatsapp.net`;
}
module.exports = { toWhatsAppJid };
