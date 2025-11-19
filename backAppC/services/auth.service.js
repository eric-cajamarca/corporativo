const bcrypt = require('bcryptjs');
const jwt = require('../helpers/jwt');
const empresaRepository = require('../repositories/empresa.repository');
const usuarioRepository = require('../repositories/usuario.repository');

exports.adminLogin = async (pool, email, password, ruc) => {
  // 1. Validar RUC
  const empresa = await empresaRepository.buscarPorRuc(pool, ruc);
  if (!empresa) {
    throw new Error('RUC no existe');
  }

  console.log('Empresa encontrada:', empresa);
  // 2. Validar email y obtener usuario con rol
  const usuario = await usuarioRepository.buscarPorEmailYRuc(pool, email, empresa.idEmpresa);
  if (!usuario) {
    throw new Error('El email no existe o no tiene permisos para acceder');
  }

  console.log('Usuario encontrado:', usuario);
  // 3. Verificar contraseña
  const isMatch = await bcrypt.compare(password, usuario.password);
  if (!isMatch) {
    throw new Error('La contraseña es incorrecta');
  }

  // 4. Verificar estado activo
  if (!usuario.estado) {
    throw new Error('Usuario inactivo');
  }

  // 5. Retornar datos del usuario para token
  return {
    idUsuario: usuario.idUsuario,
    idEmpresa: usuario.idEmpresa,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    rol: usuario.rol
  };
};