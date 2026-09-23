/**
 * frontend/js/iconos.js
 * -----------------------------------------------------------------------------
 * Iconos en SVG, dibujados a mano y embebidos.
 *
 * No se usa ninguna librería de iconos: son unos pocos trazos. Traer una fuente de
 * iconos entera (cientos de kilobytes) para esto sería absurdo, y además
 * dejaría la aplicación dependiendo de que un servidor ajeno esté en línea.
 *
 * Todos comparten la misma rejilla de 24x24 y el mismo grosor de trazo, que
 * es lo que hace que se vean de la misma familia.
 */

const TRAZOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',

  asistencia:
    '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M9 3.5V2m6 1.5V2"/>' +
    '<path d="m8.5 12.5 2.2 2.2 4.8-4.8"/>',

  notas:
    '<path d="M12 3.2 14.4 8l5.3.8-3.85 3.75.91 5.3L12 15.35 7.24 17.85l.91-5.3L4.3 8.8 9.6 8z"/>',

  historial:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 1.9"/>',

  reportes:
    '<path d="M4 20h16"/><rect x="5.5" y="11" width="3.5" height="6" rx="1"/>' +
    '<rect x="10.5" y="7" width="3.5" height="10" rx="1"/>' +
    '<rect x="15.5" y="13" width="3.5" height="4" rx="1"/>',

  escuelas:
    '<path d="M3 20h18"/><path d="M5 20V9.5l7-4.5 7 4.5V20"/>' +
    '<path d="M10 20v-4.5h4V20"/><path d="M9.5 11h1.5m2 0h1.5"/>',

  grados:
    '<path d="m12 3.5 8.5 4.2-8.5 4.2-8.5-4.2z"/><path d="m4.2 12 7.8 3.8 7.8-3.8"/>' +
    '<path d="m4.2 16.2 7.8 3.8 7.8-3.8"/>',

  alumnos:
    '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8"/>' +
    '<path d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1"/><path d="M17.5 14.9c2.2.5 3.6 2.1 3.6 4.6"/>',

  alumno:
    '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-5.6 7-5.6s7 2.1 7 5.6"/>',

  calendario:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/>' +
    '<path d="M8 3.5V6m8-2.5V6"/>',

  descargar:
    '<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/>',

  editar:
    '<path d="M4 20h4L19 9a2.12 2.12 0 0 0-3-3L5 17v3z"/><path d="m15.5 6.5 3 3"/>',

  desactivar:
    '<circle cx="12" cy="12" r="8.5"/><path d="m6.5 6.5 11 11"/>',

  activar:
    '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.2 2.6 2.6L16.2 9"/>',

  anterior: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',

  siguiente: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',

  salir:
    '<path d="M14.5 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3.5"/>' +
    '<path d="M10 8.5 6.5 12 10 15.5"/><path d="M6.5 12H15"/>',
};

const NS = 'http://www.w3.org/2000/svg';

/**
 * Devuelve un elemento SVG listo para insertar.
 *
 * currentColor hace que el icono tome el color del texto que lo rodea, asi que
 * no hay que pasarle color: se pinta solo segun donde este.
 */
export function icono(nombre, { tamano = 20, clase = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(tamano));
  svg.setAttribute('height', String(tamano));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icono ${clase}`.trim());

  // Los trazos son constantes escritas en este archivo, nunca datos del
  // usuario: por eso innerHTML es seguro aca.
  svg.innerHTML = TRAZOS[nombre] || '';

  return svg;
}

export const NOMBRES_DE_ICONO = Object.keys(TRAZOS);
