/**
 * backend/services/comun.js
 * -----------------------------------------------------------------------------
 * Ayudas compartidas por los servicios.
 */

/**
 * Arma la parte SET de un UPDATE a partir de un objeto de datos ya validado.
 *
 *   armarSet({ nombre: 'Juan', activo: false })
 *   -> { clausula: 'nombre = $1, activo = $2', valores: ['Juan', false], siguiente: 3 }
 *
 * SEGURIDAD: los nombres de columna salen de las claves del objeto, y ese
 * objeto lo construyen los validators, que solo asignan claves conocidas.
 * Nunca llega aca una clave arbitraria mandada por el usuario. Los VALORES,
 * en cambio, siempre viajan como parametros ($1, $2, ...), nunca concatenados.
 */
function armarSet(datos, desde = 1) {
  const columnas = Object.keys(datos);
  const clausula = columnas.map((col, i) => `${col} = $${desde + i}`).join(', ');
  const valores = columnas.map((col) => datos[col]);
  return { clausula, valores, siguiente: desde + columnas.length };
}

module.exports = { armarSet };
