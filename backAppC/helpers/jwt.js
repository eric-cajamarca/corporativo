// jwt.js
const jwt = require('jsonwebtoken');
const moment = require('moment');
const secret = process.env.JWT_SECRET || 'erik@./Eog_DEV_CHANGE_IN_PRODUCTION';

/** Token para recuperación de contraseña (válido 15 min) */
exports.createResetToken = function(payload) {
  return jwt.sign(
    { ...payload, purpose: 'password_reset', iat: moment().unix(), exp: moment().add(15, 'minutes').unix() },
    secret
  );
};

exports.verifyResetToken = function(token) {
  const decoded = jwt.verify(token, secret);
  if (decoded.purpose !== 'password_reset') throw new Error('Token inválido');
  return decoded;
};

exports.createToken = function(user){
    //console.log('helpers jwt', user);
    var payload = {
        empresa: user.idEmpresa,
        sub: user.idUsuario,
        nombres: user.nombres,
        apellidos: user.apellidos,
        email: user.email,
        rol: user.rol,
        iat: moment().unix(),
        exp: moment().add(1,'day').unix()
    
        // exp: moment().add(7,'day').unix()
    }
    console.log('helpers jwt rol despues de agregar el payload', payload);

    return jwt.sign(payload,secret);
}