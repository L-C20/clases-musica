/**
 * backend/middleware/errores.js
 * -----------------------------------------------------------------------------
 * Manejo centralizado de errores. Los controladores no arman respuestas de
 * error a mano: simplemente lanzan (throw) y este archivo decide el codigo
 * HTTP y el mensaje.
 */

/**
 * Error con codigo HTTP. Se usa asi desde un controlador:
 *   throw new ErrorApi(404, 'La escuela no existe');
 */
class ErrorApi extends Error {
  constructor(estado, mensaje, detalle = null) {
    super(mensaje);
    this.estado = estado;
    this.detalle = detalle;
  }
}

/**
 * Mensajes claros para las restricciones de la base.
 *
 * Sin esto, chocar contra un indice unico devuelve "Ya existe un registro con
 * esos datos", que no le dice nada al usuario. La clave es el nombre de la
 * restriccion tal como figura en las migraciones.
 */
const MENSAJES_POR_RESTRICCION = {
  escuelas_codigo_unico: 'Ya existe una escuela con ese código',
  escuelas_nombre_unico: 'Ya existe una escuela con ese nombre',
  grados_nombre_por_escuela: 'Esa escuela ya tiene un grado con ese nombre',
  alumnos_documento_unico: 'Ya existe un alumno con ese documento',
  clases_grado_fecha_unica: 'Ese grado ya tiene una clase registrada en esa fecha',
  asistencias_clase_alumno_unica: 'Ese alumno ya figura en la asistencia de esa clase',
};

/**
 * Traduce los errores propios de PostgreSQL a respuestas entendibles.
 * Lista de codigos: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
function traducirErrorDePostgres(error) {
  switch (error.code) {
    case '23505': // unique_violation
      return new ErrorApi(
        409,
        MENSAJES_POR_RESTRICCION[error.constraint] || 'Ya existe un registro con esos datos',
        error.constraint
      );
    case '23503': // foreign_key_violation
      return new ErrorApi(400, 'El registro relacionado no existe', error.constraint);
    case '23502': // not_null_violation
      return new ErrorApi(400, `Falta el campo obligatorio: ${error.column}`);
    case '23514': // check_violation
      return new ErrorApi(400, 'Los datos no cumplen una validacion', error.constraint);
    case '22P02': // invalid_text_representation
      return new ErrorApi(400, 'Alguno de los valores enviados tiene un formato invalido');
    case 'ECONNREFUSED':
      return new ErrorApi(503, 'No se pudo conectar con la base de datos');
    default:
      return null;
  }
}

/** Ruta inexistente: responde 404 en JSON en vez de HTML. */
function noEncontrado(req, res, next) {
  next(new ErrorApi(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/**
 * Manejador final. Express lo reconoce porque recibe 4 parametros.
 * Debe ir montado DESPUES de todas las rutas.
 */
function manejadorDeErrores(error, req, res, next) { // eslint-disable-line no-unused-vars
  const traducido = error.estado ? error : traducirErrorDePostgres(error);
  const fallo = traducido || new ErrorApi(500, 'Error interno del servidor');

  // En consola siempre queda el error completo, para poder depurar.
  if (fallo.estado >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  } else {
    console.warn(`[${req.method} ${req.originalUrl}] ${fallo.estado} - ${fallo.message}`);
  }

  res.status(fallo.estado).json({
    ok: false,
    error: fallo.message,
    ...(fallo.detalle ? { detalle: fallo.detalle } : {}),
  });
}

module.exports = { ErrorApi, noEncontrado, manejadorDeErrores };
