/**
 * backend/middleware/auth.js
 * -----------------------------------------------------------------------------
 * Proteccion por contrasena, pensada para cuando la aplicacion esta publicada
 * en internet.
 *
 * COMO SE ACTIVA
 *   Se define la variable de entorno CLAVE_ACCESO.
 *   - Si NO esta definida (tu computadora): no pide nada, todo sigue igual.
 *   - Si esta definida (Railway): hay que escribir la clave una vez y queda
 *     una sesion guardada por 30 dias.
 *
 * COMO FUNCIONA
 *   No se guarda ninguna sesion en memoria ni en la base. Al entrar, el
 *   servidor entrega una cookie con un vencimiento y una FIRMA calculada con
 *   un secreto que solo el servidor conoce (HMAC-SHA256). En cada pedido se
 *   recalcula la firma: si no coincide, la cookie fue alterada.
 *
 *   Eso evita tener que instalar librerias de sesiones o de JWT para algo que
 *   con una sola contrasena se resuelve en unas pocas lineas.
 *
 * LIMITE A TENER EN CUENTA
 *   Es una sola clave para un solo docente. No es un sistema de usuarios.
 *   Alcanza para que la aplicacion no quede abierta a cualquiera que tenga
 *   la direccion, que es exactamente el problema a resolver al publicarla.
 */

const crypto = require('crypto');
const { ErrorApi } = require('./errores');

const NOMBRE_COOKIE = 'sesion';
const DURACION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/** La proteccion existe solo si hay una clave configurada. */
function estaProtegida() {
  return typeof process.env.CLAVE_ACCESO === 'string' && process.env.CLAVE_ACCESO.length > 0;
}

/**
 * Secreto para firmar. Si no se define SESION_SECRETO, se deriva de la clave:
 * asi las sesiones sobreviven a un reinicio del servidor sin tener que
 * configurar una segunda variable.
 */
function secreto() {
  return process.env.SESION_SECRETO || `derivado:${process.env.CLAVE_ACCESO}`;
}

function firmar(vencimiento) {
  return crypto.createHmac('sha256', secreto()).update(String(vencimiento)).digest('hex');
}

/** Compara dos textos sin filtrar informacion por el tiempo que tarda. */
function sonIguales(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/** Lee una cookie del encabezado, sin depender de cookie-parser. */
function leerCookie(req, nombre) {
  const crudo = req.headers.cookie;
  if (!crudo) return null;

  for (const parte of crudo.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}

/** ¿La cookie que trae el pedido es valida y esta vigente? */
function tieneSesionValida(req) {
  const cookie = leerCookie(req, NOMBRE_COOKIE);
  if (!cookie) return false;

  const [vencimiento, firma] = cookie.split('.');
  if (!vencimiento || !firma) return false;

  if (Number(vencimiento) < Date.now()) return false;

  return sonIguales(firma, firmar(vencimiento));
}

function darCookie(res) {
  const vencimiento = Date.now() + DURACION_MS;
  const valor = `${vencimiento}.${firmar(vencimiento)}`;

  const partes = [
    `${NOMBRE_COOKIE}=${valor}`,
    'Path=/',
    'HttpOnly',            // el JavaScript de la pagina no puede leerla
    'SameSite=Strict',     // no viaja desde otros sitios
    `Max-Age=${Math.floor(DURACION_MS / 1000)}`,
  ];

  // En produccion la cookie solo viaja por HTTPS.
  if (process.env.NODE_ENV === 'production') partes.push('Secure');

  res.setHeader('Set-Cookie', partes.join('; '));
}

function borrarCookie(res) {
  res.setHeader('Set-Cookie', `${NOMBRE_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
}

/**
 * Middleware. Deja pasar siempre que no haya clave configurada.
 * Las rutas de /api/sesion y /api/salud quedan fuera para poder entrar
 * y para poder diagnosticar el servidor.
 */
function exigirSesion(req, res, next) {
  if (!estaProtegida()) return next();
  if (req.path === '/sesion' || req.path === '/salud') return next();
  if (tieneSesionValida(req)) return next();

  next(new ErrorApi(401, 'Necesitás iniciar sesión'));
}

/** GET /api/sesion -> dice si hace falta clave y si ya hay sesion. */
function estado(req, res) {
  res.json({
    ok: true,
    datos: {
      protegida: estaProtegida(),
      autenticado: !estaProtegida() || tieneSesionValida(req),
    },
  });
}

/** POST /api/sesion { clave } -> entra. */
function entrar(req, res) {
  if (!estaProtegida()) {
    return res.json({ ok: true, datos: { autenticado: true } });
  }

  const clave = req.body?.clave;
  if (typeof clave !== 'string' || !sonIguales(clave, process.env.CLAVE_ACCESO)) {
    throw new ErrorApi(401, 'La contraseña no es correcta');
  }

  darCookie(res);
  res.json({ ok: true, datos: { autenticado: true } });
}

/** DELETE /api/sesion -> sale. */
function salir(req, res) {
  borrarCookie(res);
  res.json({ ok: true, datos: { autenticado: false } });
}

module.exports = { exigirSesion, estado, entrar, salir, estaProtegida };
