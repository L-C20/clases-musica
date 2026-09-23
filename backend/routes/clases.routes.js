/**
 * backend/routes/clases.routes.js
 * -----------------------------------------------------------------------------
 * Historial de clases dictadas.
 */

const express = require('express');
const controlador = require('../controllers/clases.controller');

const router = express.Router();

router.get('/', controlador.listar);
router.get('/:id', controlador.obtener);
router.delete('/:id', controlador.eliminar);

module.exports = router;
