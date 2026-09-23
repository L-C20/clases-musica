/**
 * backend/routes/grados.routes.js
 * -----------------------------------------------------------------------------
 * Solo define URLs y a que controlador va cada una. Sin logica.
 */

const express = require("express");
const controlador = require("../controllers/grados.controller");

const router = express.Router();

router.get("/", controlador.listar);
router.get("/:id", controlador.obtener);
router.post("/", controlador.crear);
router.put("/:id", controlador.actualizar);
router.patch("/:id/activo", controlador.cambiarEstado);

module.exports = router;
