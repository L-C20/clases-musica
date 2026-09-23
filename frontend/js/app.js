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
 *   #/alumno?id=7                     -> ficha completa de un alumno
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
import { vistaAlumno } from './vistas/alumno.js';
import { vistaAsistencia } from './vistas/asistencia.js';
import { vistaHistorial } from './vistas/historial.js';
import { vistaNotas } from './vistas/notas.js';
import { vistaReportes } from './vistas/reportes.js';
import { icono } from './iconos.js';

const RUTAS = {
  '/inicio': vistaInicio,
  '/escuelas': vistaEscuelas,
  '/grados': vistaGrados,
  '/alumnos': vistaAlumnos,
  '/alumno': vistaAlumno,
  '/asistencia': vistaAsistencia,
  '/historial': vistaHistorial,
  '/notas': vistaNotas,
  '/reportes': vistaReportes,
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

/**
 * Hasta que no se resuelva la sesion no se dibuja nada.
 *
 * Sin esto, al entrar a la direccion sin "#" el router arrancaba antes de
 * pedir la contrasena: la pantalla hacia su consulta, recibia un 401 y
 * dejaba el mensaje de error dibujado detras del formulario de acceso.
 */
let sesionLista = false;

export function ponerGuardia(fn) {
  guardia = fn;
}

/* ---------------------------------------------------------------------------
 * Vistas que terminan tarde
 *
 * Toda vista hace consultas al servidor ANTES de dibujar. Si se cambia de
 * pantalla mientras una consulta está en curso, esa vista vieja termina
 * después y escribe encima de la pantalla nueva: se veía el contenido de una
 * con la dirección de la otra, y el encabezado (con su botón) desaparecía.
 *
 * La solución son dos candados:
 *
 *  1. Cada dibujado recibe su PROPIO lienzo. Cuando llega el siguiente, el
 *     lienzo anterior se saca del documento, así que todo lo que la vista
 *     vieja dibuje después cae en un nodo suelto que nadie ve. No hizo falta
 *     tocar ninguna vista: siguen recibiendo "un contenedor" igual que antes.
 *     El lienzo usa display:contents, o sea que no agrega ninguna caja ni
 *     cambia el diseño.
 *
 *  2. reemplazarDireccion() solo deja cambiar la URL si la pantalla que la
 *     pide sigue siendo la que está a la vista.
 * ------------------------------------------------------------------------ */

/**
 * Cambia la dirección sin recargar, ignorando el pedido si viene de una
 * pantalla que ya no está. Las vistas deben usar esto en vez de
 * history.replaceState.
 */
export function reemplazarDireccion(hash) {
  const rutaPedida = hash.replace(/^#/, '').split('?')[0];
  if (rutaPedida !== leerDireccion().ruta) return;
  history.replaceState(null, '', hash);
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
  if (!sesionLista) return;

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
  const marco = document.getElementById('vista');
  const vista = RUTAS[ruta];

  cerrarModales();
  marcarEnlaceActivo(ruta);

  // Lienzo propio de este dibujado: si llega otro, este queda fuera del
  // documento y lo que la vista vieja haga después no se ve.
  vaciar(marco);
  const contenedor = el('div', { clase: 'lienzo' });
  marco.append(contenedor);

  if (!vista) {
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
/** Pone el icono que corresponde a cada enlace del menu. */
function ponerIconosEnLaNavegacion() {
  document.querySelectorAll('.nav__enlace[data-icono]').forEach((enlace) => {
    enlace.prepend(icono(enlace.dataset.icono, { tamano: 19 }));
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  ponerIconosEnLaNavegacion();
  await asegurarSesion();
  sesionLista = true;

  if (location.hash) {
    dibujar();
  } else {
    // Si se abre sin hash, mandamos al inicio para que la URL quede prolija.
    // El cambio de hash dispara dibujar() por si solo.
    location.hash = `#${RUTA_POR_DEFECTO}`;
  }
});
