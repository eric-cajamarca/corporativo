const jwt = require('jsonwebtoken'); // Cambiado a jsonwebtoken
const moment = require('moment');
const secret = process.env.JWT_SECRET || 'erik@./Eog_DEV_CHANGE_IN_PRODUCTION';

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

/**
 * Mismo flujo que auth pero sin devolver 403: si no hay token o es inválido, solo llama next().
 * Sirve para rutas que deben responder siempre 200 y decidir en el controller (ej. getEmpresa_login).
 */
exports.optionalAuth = function (req, res, next) {
    const token = req.cookies && req.cookies.token;
    if (!token) {
        return next();
    }
    try {
        const payload = jwt.verify(token, secret);
        if (payload.exp <= moment().unix()) {
            return next();
        }
        req.user = payload;
    } catch (error) {
        // Token inválido o expirado; no asignar req.user, no 403
    }
    next();
};