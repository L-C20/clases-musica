/**
 * frontend/js/app.js
 * -----------------------------------------------------------------------------
 * Router de la aplicacion.
 *
 * Es una SPA: hay un solo index.html y la pantalla se arma en JavaScript
 * segun lo que diga la direccion despues del #.
 *
 *   #/escuelas                        -> pantalla de escuelas
 *   #/grados?escuela=4                -> grados filtrados por escuela
 *   #/asistencia?grado=4&fecha=...    -> planilla de una clase
 *
 * Ventaja: navegar entre pantallas no recarga la pagina, asi que es
 * instantaneo incluso desde el celular.
 */

import { vaciar, el, aviso, cerrarModales, confirmar } from './ui.js';
import { asegurarSesion } from './sesion.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaEscuelas } from './vistas/escuelas.js';
import { vistaGrados } from './vistas/grados.js';
import { vistaAlumnos } from './vistas/alumnos.js';
import { vistaAsistencia } from './vistas/asistencia.js';
import { vistaHistorial } from './vistas/historial.js';

const RUTAS = {
  '/inicio': vistaInicio,
  '/escuelas': vistaEscuelas,
  '/grados': vistaGrados,
  '/alumnos': vistaAlumnos,
  '/asistencia': vistaAsistencia,
  '/historial': vistaHistorial,
};

const RUTA_POR_DEFECTO = '/inicio';

/* ---------------------------------------------------------------------------
 * Guardia de cambios sin guardar
 *
 * La pantalla de asistencia registra aca una funcion que avisa si hay una
 * planilla marcada y todavia sin guardar. Antes de cambiar de pantalla el
 * router pregunta, para que un toque equivocado no borre el trabajo.
 * ------------------------------------------------------------------------ */

let guardia = null;
let direccionActual = location.hash || `#${RUTA_POR_DEFECTO}`;
let restaurando = false;

export function ponerGuardia(fn) {
  guardia = fn;
}

/** Separa "#/grados?escuela=4" en { ruta: '/grados', parametros: {escuela:'4'} } */
function leerDireccion() {
  const bruto = location.hash.replace(/^#/, '') || RUTA_POR_DEFECTO;
  const [ruta, cadena] = bruto.split('?');
  const parametros = Object.fromEntries(new URLSearchParams(cadena || ''));
  return { ruta: ruta || RUTA_POR_DEFECTO, parametros };
}

/** Cambia de pantalla desde el codigo. */
export function navegar(ruta, parametros = {}) {
  const partes = Object.entries(parametros)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  location.hash = `#${ruta}${partes.length ? `?${partes.join('&')}` : ''}`;
}

function marcarEnlaceActivo(ruta) {
  document.querySelectorAll('.nav__enlace').forEach((enlace) => {
    const destino = enlace.getAttribute('href').replace(/^#/, '').split('?')[0];
    enlace.classList.toggle('nav__enlace--activo', destino === ruta);
  });
}

async function dibujar() {
  // Cuando se restaura la direccion tras cancelar una salida, no hay que
  // volver a dibujar ni volver a preguntar.
  if (restaurando) {
    restaurando = false;
    return;
  }

  if (guardia) {
    const advertencia = guardia();
    if (advertencia) {
      const salir = await confirmar(advertencia, { textoOk: 'Salir sin guardar', peligroso: true });
      if (!salir) {
        restaurando = true;
        location.hash = direccionActual;
        return;
      }
    }
  }

  guardia = null;
  direccionActual = location.hash || `#${RUTA_POR_DEFECTO}`;

  const { ruta, parametros } = leerDireccion();
  const contenedor = document.getElementById('vista');
  const vista = RUTAS[ruta];

  cerrarModales();
  marcarEnlaceActivo(ruta);

  if (!vista) {
    vaciar(contenedor);
    contenedor.append(el('p', { clase: 'mensaje mensaje--error' }, `La pantalla "${ruta}" no existe.`));
    return;
  }

  try {
    await vista(contenedor, parametros);
  } catch (error) {
    vaciar(contenedor);
    contenedor.append(el('p', { clase: 'mensaje mensaje--error' }, error.message));
    aviso(error.message, 'error');
  }

  window.scrollTo(0, 0);
}

// Aviso del navegador al cerrar la pestana con cambios sin guardar.
window.addEventListener('beforeunload', (evento) => {
  if (guardia && guardia()) {
    evento.preventDefault();
    evento.returnValue = '';
  }
});

window.addEventListener('hashchange', dibujar);

// Al abrir la aplicacion: primero la sesion (si el servidor la exige),
// y recien despues se dibuja la pantalla.
window.addEventListener('DOMContentLoaded', async () => {
  await asegurarSesion();
  dibujar();
});

// Si se abre sin hash, mandamos al inicio para que la URL quede prolija.
if (!location.hash) location.hash = `#${RUTA_POR_DEFECTO}`;
