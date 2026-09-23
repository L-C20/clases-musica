/**
 * backend/routes/reportes.routes.js
 */

const express = require('express');
const controlador = require('../controllers/reportes.controller');

const router = express.Router();

router.get('/escuelas', controlador.porEscuela);
router.get('/grados', controlador.porGrado);
router.get('/alumnos', controlador.porAlumno);

module.exports = router;
