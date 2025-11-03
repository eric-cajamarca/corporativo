const jwt = require('jsonwebtoken'); // Cambiado a jsonwebtoken
const moment = require('moment');
const secret = 'erik@./Eog';

exports.auth = function(req, res, next) {
    // if (!req.headers) {
    //     return res.status(403).send({ message: 'NoHeadersError' });
    // }

    //const token = req.headers.authorization.replace(/['"]+/g, '');
    const token = req.cookies.token; // Cambiado a cookies
    if (!token) {
        return res.status(403).send({ message: 'NoTokenError' });
    }

    try {
        // Verifica y decodifica el token con jsonwebtoken
        const payload = jwt.verify(token, secret);

        // Verifica si el token ha expirado
        if (payload.exp <= moment().unix()) {
            return res.status(403).send({ message: 'TokenExpirado' });
        }
        
        // Adjunta el payload decodificado a la solicitud (req.user)
        req.user = payload;

        next(); // Continúa al siguiente middleware/ruta
    } catch (error) {
        // Maneja errores (token inválido, expirado, etc.)
        return res.status(403).send({ message: 'InvalidToken' });
    }
};