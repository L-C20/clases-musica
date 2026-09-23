/**
 * frontend/js/estado.js
 * -----------------------------------------------------------------------------
 * Memoria compartida entre pantallas.
 *
 * Las listas de escuelas y grados se usan en casi todas las vistas (filtros,
 * selectores de formulario). Guardarlas evita volver a pedirlas al servidor
 * cada vez que se cambia de pantalla.
 *
 * Cuando algo cambia, la vista que lo cambio llama a olvidar() para que la
 * proxima consulta traiga los datos frescos.
 */

import { api } from './api.js';

const cache = new Map();

/** Trae un recurso de la cache o lo pide al servidor la primera vez. */
async function traer(clave, cargador) {
  if (!cache.has(clave)) {
    cache.set(clave, cargador());
  }
  try {
    return await cache.get(clave);
  } catch (error) {
    cache.delete(clave); // si fallo, que el proximo intento vuelva a probar
    throw error;
  }
}

export const estado = {
  escuelas: () => traer('escuelas', () => api.escuelas.listar()),
  grados: () => traer('grados', () => api.grados.listar()),

  /** Invalida lo guardado. Sin argumentos, invalida todo. */
  olvidar(...claves) {
    if (claves.length === 0) cache.clear();
    else claves.forEach((c) => cache.delete(c));
  },
};

/** Opciones listas para un <select> de escuelas. */
export async function opcionesEscuelas() {
  const escuelas = await estado.escuelas();
  return escuelas.map((e) => ({
    valor: e.id,
    texto: e.codigo ? `${e.codigo} - ${e.nombre}` : e.nombre,
  }));
}

/** Opciones para un <select> de grados, opcionalmente de una sola escuela. */
export async function opcionesGrados(escuelaId = null) {
  const grados = await estado.grados();
  return grados
    .filter((g) => !escuelaId || g.escuela_id === Number(escuelaId))
    .map((g) => ({
      valor: g.id,
      texto: escuelaId ? g.nombre : `${g.escuela_nombre} - ${g.nombre}`,
    }));
}
