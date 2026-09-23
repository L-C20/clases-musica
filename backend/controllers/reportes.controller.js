/**
 * backend/controllers/reportes.controller.js
 * -----------------------------------------------------------------------------
 *   GET /api/reportes/escuelas?desde&hasta
 *   GET /api/reportes/grados?escuela_id&desde&hasta
 *   GET /api/reportes/alumnos?escuela_id&grado_id&desde&hasta
 *
 * El de escuelas devuelve ademas los totales generales, para que la pantalla
 * pueda encabezarse sin hacer una segunda llamada.
 */

const servicio = require('../services/reportes.service');
const { Campos, idOpcional } = require('../validators/comun');

/** Los tres reportes aceptan el mismo rango de fechas. */
function leerRango(req) {
  const { desde, hasta } = new Campos(req.query)
    .fecha('desde', { etiqueta: 'fecha desde' })
    .fecha('hasta', { etiqueta: 'fecha hasta' })
    .fin();

  return { desde: desde ?? null, hasta: hasta ?? null };
}

async function porEscuela(req, res) {
  const rango = leerRango(req);
  const escuelas = await servicio.porEscuela(rango);

  res.json({
    ok: true,
    datos: { escuelas, totales: servicio.totales(escuelas) },
  });
}

async function porGrado(req, res) {
  const rango = leerRango(req);
  const grados = await servicio.porGrado({
    ...rango,
    escuelaId: idOpcional(req.query.escuela_id, 'id de escuela'),
  });

  res.json({ ok: true, datos: grados });
}

async function porAlumno(req, res) {
  const rango = leerRango(req);
  const alumnos = await servicio.porAlumno({
    ...rango,
    escuelaId: idOpcional(req.query.escuela_id, 'id de escuela'),
    gradoId: idOpcional(req.query.grado_id, 'id de grado'),
  });

  res.json({ ok: true, datos: alumnos });
}

module.exports = { porEscuela, porGrado, porAlumno };
