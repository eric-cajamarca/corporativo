const STOPWORDS_ES = new Set([
  'a', 'al', 'algo', 'algun', 'alguna', 'algunos', 'algunas', 'ante', 'antes', 'como', 'con', 'contra',
  'cual', 'cuales', 'cuando', 'de', 'del', 'desde', 'donde', 'durante', 'e', 'el', 'ella', 'ellas', 'ello',
  'ellos', 'en', 'entre', 'era', 'erais', 'eran', 'eras', 'eres', 'es', 'esa', 'esas', 'ese', 'eso', 'esos',
  'esta', 'estaba', 'estais', 'estan', 'estas', 'este', 'esto', 'estos', 'estoy', 'fin', 'fue', 'fueron',
  'ha', 'habia', 'han', 'has', 'hasta', 'hay', 'he', 'hola', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas',
  'me', 'mi', 'mis', 'mucho', 'muy', 'nada', 'ni', 'no', 'nos', 'nosotros', 'nuestra', 'nuestras', 'nuestro',
  'nuestros', 'o', 'os', 'otra', 'otras', 'otro', 'otros', 'para', 'pero', 'poco', 'por', 'porque', 'que',
  'quien', 'quienes', 'qué', 'se', 'sea', 'sean', 'ser', 'si', 'sido', 'sin', 'sobre', 'sois', 'solamente',
  'solo', 'somos', 'son', 'soy', 'su', 'sus', 'suya', 'suyas', 'suyo', 'suyos', 'tambien', 'tampoco', 'tan',
  'te', 'tendra', 'tendran', 'teneis', 'tener', 'tengo', 'ti', 'tiene', 'tienen', 'tienes', 'todo', 'todos',
  'tu', 'tus', 'tuya', 'tuyas', 'tuyo', 'tuyos', 'un', 'una', 'uno', 'unos', 'unas', 'usted', 'ustedes', 'va',
  'vais', 'valor', 'vamos', 'van', 'vosotras', 'vosotros', 'vuestra', 'vuestras', 'vuestro', 'vuestros', 'y',
  'ya', 'yo', 'buenos', 'dias', 'tardes', 'noches', 'porfavor', 'favor', 'tiene', 'tienen', 'hay', 'cuanto',
  'cuanta', 'cuesta', 'cuestan', 'precio', 'valor', 'dime', 'dame', 'quisiera', 'necesito', 'busco', 'buscar',
  'producto', 'productos', 'item', 'articulo', 'articulos', 'ver', 'mostrar', 'muestrame', 'deseo', 'quisera',
  'quiero', 'quisiera', 'quisera', 'necesito', 'compro', 'comprar', 'compras', 'comprame', 'comprarme',
  'vendes', 'vendas', 'vende', 'vender', 'vendan', 'vendeme', 'vendeme', 'venderme', 'vendernos',
  'podrias', 'podria', 'puedes', 'puede', 'pueden', 'podrian', 'podria', 'interesa', 'interesado',
  'mandame', 'mandar', 'envia', 'enviar', 'enviame', 'facturame', 'cotizame', 'regalame', 'traeme', 'traer',
  'algun', 'alguna', 'algunos', 'algunas', 'ese', 'esa', 'esos', 'esas', 'este', 'esta', 'estos', 'estas'
]);

module.exports = { STOPWORDS_ES };
