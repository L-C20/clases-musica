/**
 * backend/routes/alumnos.routes.js
 * -----------------------------------------------------------------------------
 * Solo define URLs y a que controlador va cada una. Sin logica.
 */

const express = require("express");
const controlador = require("../controllers/alumnos.controller");
const clasesControlador = require("../controllers/clases.controller");

const router = express.Router();

router.get("/", controlador.listar);
router.get("/:id", controlador.obtener);
// Historial de asistencia del alumno, con sus estadisticas.
router.get("/:id/asistencias", clasesControlador.historialDeAlumno);
// Ficha completa: datos + asistencia + notas, todo junto.
router.get("/:id/ficha", controlador.obtenerFicha);
router.post("/", controlador.crear);
router.put("/:id", controlador.actualizar);
router.patch("/:id/activo", controlador.cambiarEstado);

module.exports = router;
