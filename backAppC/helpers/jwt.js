// jwt.js
const jwt = require('jsonwebtoken');
const moment = require('moment');
const secret = process.env.JWT_SECRET || 'erik@./Eog_DEV_CHANGE_IN_PRODUCTION';

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