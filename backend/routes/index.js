/**
 * backend/routes/index.js
 * -----------------------------------------------------------------------------
 * Punto unico donde se montan todas las rutas de la API.
 *
 * A medida que avancen las fases, cada entidad va a tener su propio archivo
 * (escuelas.routes.js, grados.routes.js, ...) y se agrega una linea aca.
 */

const express = require('express');
const { verificarConexion } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// --- Sesion -----------------------------------------------------------------
// Solo hace algo si esta definida la variable CLAVE_ACCESO.
router.get('/sesion', auth.estado);
router.post('/sesion', auth.entrar);
router.delete('/sesion', auth.salir);

// A partir de aca, todo pide sesion (si la proteccion esta activada).
router.use(auth.exigirSesion);

/**
 * GET /api/salud
 * Diagnostico: confirma que el servidor responde y que la base contesta.
 */
router.get('/salud', async (req, res) => {
  const info = await verificarConexion();
  res.json({
    ok: true,
    servidor: 'funcionando',
    base_de_datos: info.base,
    hora_del_servidor: info.hora,
  });
});

// --- FASE 2 -----------------------------------------------------------------
router.use('/escuelas', require('./escuelas.routes'));
router.use('/grados', require('./grados.routes'));
router.use('/alumnos', require('./alumnos.routes'));

// --- FASE 3 -----------------------------------------------------------------
router.use('/planilla', require('./planilla.routes'));
router.use('/clases', require('./clases.routes'));

// --- FASE 5 -----------------------------------------------------------------
router.use('/notas', require('./notas.routes'));

module.exports = router;
