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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'autenticate.js:403',message:'NoTokenError',data:{path:req.path,method:req.method,url:req.originalUrl},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
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