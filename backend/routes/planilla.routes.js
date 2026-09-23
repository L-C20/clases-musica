/**
 * backend/routes/planilla.routes.js
 * -----------------------------------------------------------------------------
 * La pantalla mas usada de la aplicacion: dos rutas, nada mas.
 */

const express = require('express');
const controlador = require('../controllers/planilla.controller');

const router = express.Router();

router.get('/', controlador.obtener);
router.post('/', controlador.guardar);

module.exports = router;
