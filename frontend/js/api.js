/**
 * frontend/js/api.js
 * -----------------------------------------------------------------------------
 * Unico lugar del frontend que habla con el backend.
 *
 * Todas las vistas usan estas funciones en vez de llamar a fetch() sueltas,
 * asi el manejo de errores queda en un solo sitio.
 */

const BASE = '/api';

/**
 * Llamada generica.
 * El backend responde siempre { ok, datos } o { ok:false, error, detalle }.
 * Esta funcion devuelve directamente "datos", o lanza un Error con el
 * mensaje que mando el servidor.
 */
async function pedir(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
  } catch {
    throw new Error('No se pudo contactar al servidor. Verifica que este encendido.');
  }

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    // 401 = la sesion vencio o nunca existio. sesion.js escucha este aviso
    // y vuelve a pedir la contrasena sin que se pierda la pagina.
    if (respuesta.status === 401 && ruta !== '/sesion') {
      document.dispatchEvent(new Event('sesion-expirada'));
    }
    // detalle es la lista de errores de validacion, cuando la hay.
    const detalle = Array.isArray(cuerpo?.detalle) ? cuerpo.detalle.join('. ') : null;
    throw new Error(detalle || cuerpo?.error || `Error ${respuesta.status}`);
  }

  return cuerpo?.datos !== undefined ? cuerpo.datos : cuerpo;
}

/** Arma una query string a partir de un objeto, salteando lo vacio. */
function query(parametros = {}) {
  const partes = Object.entries(parametros)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return partes.length ? `?${partes.join('&')}` : '';
}

const metodos = {
  get: (ruta) => pedir(ruta),
  post: (ruta, cuerpo) => pedir(ruta, { method: 'POST', body: JSON.stringify(cuerpo) }),
  put: (ruta, cuerpo) => pedir(ruta, { method: 'PUT', body: JSON.stringify(cuerpo) }),
  patch: (ruta, cuerpo) => pedir(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  delete: (ruta) => pedir(ruta, { method: 'DELETE' }),
};

export const api = {
  ...metodos,

  salud: () => pedir('/salud'),

  escuelas: {
    listar: (filtros) => metodos.get(`/escuelas${query(filtros)}`),
    obtener: (id) => metodos.get(`/escuelas/${id}`),
    crear: (datos) => metodos.post('/escuelas', datos),
    actualizar: (id, datos) => metodos.put(`/escuelas/${id}`, datos),
    cambiarEstado: (id, activo) => metodos.patch(`/escuelas/${id}/activo`, { activo }),
  },

  grados: {
    listar: (filtros) => metodos.get(`/grados${query(filtros)}`),
    obtener: (id) => metodos.get(`/grados/${id}`),
    crear: (datos) => metodos.post('/grados', datos),
    actualizar: (id, datos) => metodos.put(`/grados/${id}`, datos),
    cambiarEstado: (id, activo) => metodos.patch(`/grados/${id}/activo`, { activo }),
  },

  alumnos: {
    listar: (filtros) => metodos.get(`/alumnos${query(filtros)}`),
    obtener: (id) => metodos.get(`/alumnos/${id}`),
    crear: (datos) => metodos.post('/alumnos', datos),
    actualizar: (id, datos) => metodos.put(`/alumnos/${id}`, datos),
    cambiarEstado: (id, activo) => metodos.patch(`/alumnos/${id}/activo`, { activo }),
  },
};
