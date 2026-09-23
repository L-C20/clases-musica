/**
 * backend/routes/notas.routes.js
 * -----------------------------------------------------------------------------
 * Notas / evaluaciones.
 *
 * Las rutas fijas ("/planilla", "/resumen/:alumnoId") van ANTES que "/:id",
 * porque Express toma la primera que coincide y "/:id" se tragaria a las otras.
 */

const express = require('express');
const controlador = require('../controllers/notas.controller');

const router = express.Router();

router.get('/planilla', controlador.obtenerPlanilla);
router.post('/planilla', controlador.guardarPlanilla);
router.get('/resumen/:alumnoId', controlador.resumenDeAlumno);

router.get('/', controlador.listar);
router.delete('/:id', controlador.eliminar);

module.exports = router;
