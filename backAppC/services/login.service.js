// const bcrypt = require('bcrypt');
// const empresaRepository = require('../repositories/empresa.repository');
// const usuarioRepository = require('../repositories/usuario.repository');

// exports.autenticar = async (pool, ruc, email, password) => {
//   // 1. Validar RUC y obtener empresa
//   const empresa = await empresaRepository.buscarPorRuc(pool, ruc);
//   if (!empresa) {
//     throw new Error('RUC no existe');
//   }

//   // 2. Validar usuario por email
//   const usuario = await usuarioRepository.buscarPorEmail(pool, email, empresa.idEmpresa);
//   if (!usuario) {
//     throw new Error('Usuario no existe');
//   }

//   // 3. Verificar que usuario pertenezca a la empresa
// //   if (usuario.idEmpresa !== empresa.idEmpresa) {
// //     throw new Error('Usuario no pertenece a esta empresa');
// //   }

//   // 4. Comparar contraseña (asumo que guardas hash con bcrypt)
//   const passwordValida = await bcrypt.compare(password, usuario.contraseña);
//   if (!passwordValida) {
//     throw new Error('Contraseña incorrecta');
//   }

//   // 5. Devolver datos necesarios para el token
//   return {
//     idUsuario: usuario.idUsuario,
//     idEmpresa: usuario.idEmpresa,
//     nombres: usuario.nombres,
//     apellidos: usuario.apellidos,
//     email: usuario.email,
//     rol: usuario.idRol,
//     razonSocial: empresa.razon_Social
//   };
// };