/**
 * frontend/js/vistas/inicio.js
 * -----------------------------------------------------------------------------
 * PANEL DE INICIO.
 *
 * Está ordenado por lo que hay que HACER, no por lo que hay que mirar:
 *
 *   1. Próxima clase        -> lo primero, con el botón para cargarla
 *   2. Números del momento  -> alumnos, asistencia general, pendientes
 *   3. Clases de la semana  -> cuáles faltan cargar
 *   4. Asistencia baja      -> los alumnos a los que hay que prestar atención
 *
 * Toda la pantalla se arma con cuatro consultas que salen en paralelo.
 */

import { api } from '../api.js';
import { navegar } from '../app.js';
import { el, vaciar, agregar, encabezado, boton, cargando, plural } from '../ui.js';
import { icono } from '../iconos.js';
import { medidor } from '../graficos.js';
import { fechaDeEstaSemana, formatear, nombreDeDia, hoy, sumarDias } from '../fechas.js';

/** Umbral por debajo del cual un alumno entra en la lista de atención. */
const UMBRAL_ASISTENCIA = 75;

function tarjetaNumero(numero, etiqueta, alHacerClic) {
  return el('button', { clase: 'metrica', type: 'button', onClick: alHacerClic },
    el('span', { clase: 'metrica__numero' }, String(numero)),
    el('span', { clase: 'metrica__etiqueta' }, etiqueta)
  );
}

/**
 * La próxima clase de cada grado, contando desde hoy.
 *
 * Si la clase de esta semana ya pasó, se corre a la semana siguiente. Así el
 * panel nunca queda mostrando una clase vieja: el viernes ya propone la del
 * lunes que viene.
 */
function proximasClases(grados, hoyTexto) {
  return grados
    .filter((g) => g.dia_semana !== null && g.hora_inicio)
    .map((g) => {
      let fecha = fechaDeEstaSemana(g.dia_semana);
      if (fecha < hoyTexto) fecha = sumarDias(fecha, 7);
      return { ...g, fecha };
    })
    .sort((a, b) =>
      a.fecha.localeCompare(b.fecha) || String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
}

export async function vistaInicio(contenedor) {
  vaciar(contenedor);
  contenedor.append(encabezado('Inicio', 'Tu resumen de hoy'), cargando());

  const lunes = fechaDeEstaSemana(1);
  const domingo = fechaDeEstaSemana(0);
  const hoyTexto = hoy();

  // Las cuatro consultas no dependen entre sí: salen juntas.
  const [grados, clasesDeLaSemana, reporteEscuelas, reporteAlumnos] = await Promise.all([
    api.grados.listar(),
    api.get(`/clases?desde=${lunes}&hasta=${domingo}`),
    api.get('/reportes/escuelas'),
    api.get('/reportes/alumnos'),
  ]);

  const totales = reporteEscuelas.totales;
  const yaCargadas = new Set(clasesDeLaSemana.map((c) => `${c.grado_id}|${c.fecha}`));

  /* --- Agenda de la semana ------------------------------------------------ */

  const agenda = grados
    .filter((g) => g.dia_semana !== null && g.hora_inicio)
    .map((g) => {
      const fecha = fechaDeEstaSemana(g.dia_semana);
      return { ...g, fecha, cargada: yaCargadas.has(`${g.id}|${fecha}`) };
    })
    .sort((a, b) => {
      const diaA = a.dia_semana === 0 ? 7 : a.dia_semana;
      const diaB = b.dia_semana === 0 ? 7 : b.dia_semana;
      return diaA - diaB || String(a.hora_inicio).localeCompare(String(b.hora_inicio));
    });

  const pendientes = agenda.filter((g) => !g.cargada).length;

  /* --- Próxima clase ------------------------------------------------------- */

  const proxima = proximasClases(grados, hoyTexto)[0] || null;
  const proximaCargada = proxima && yaCargadas.has(`${proxima.id}|${proxima.fecha}`);

  function tarjetaProximaClase() {
    if (!proxima) {
      return el('section', { clase: 'proxima proxima--vacia' },
        el('div', { clase: 'proxima__cuerpo' },
          el('p', { clase: 'proxima__etiqueta' }, 'Próxima clase'),
          el('p', { clase: 'proxima__titulo' }, 'Todavía no hay horarios cargados'),
          el('p', { clase: 'proxima__detalle' },
            'Poné el día y la hora de cada grado y esta tarjeta te va a decir siempre qué sigue.')
        ),
        boton('Ir a Grados', { tipo: 'primario', onClick: () => navegar('/grados') })
      );
    }

    const esHoy = proxima.fecha === hoyTexto;
    const cuando = esHoy
      ? 'Hoy'
      : `${nombreDeDia(proxima.dia_semana)} ${formatear(proxima.fecha)}`;

    return el('section', { clase: 'proxima' },
      el('div', { clase: 'proxima__cuerpo' },
        el('p', { clase: 'proxima__etiqueta' },
          icono('calendario', { tamano: 15 }),
          esHoy ? 'Clase de hoy' : 'Próxima clase'
        ),
        el('p', { clase: 'proxima__titulo' },
          `${proxima.escuela_nombre} — ${proxima.nombre}`),
        el('p', { clase: 'proxima__detalle' },
          `${cuando} · ${String(proxima.hora_inicio).slice(0, 5)} · `,
          plural(proxima.total_alumnos, 'alumno')
        )
      ),
      el('div', { clase: 'proxima__acciones' },
        proximaCargada
          ? el('span', { clase: 'proxima__marca' }, 'Asistencia ya cargada')
          : null,
        boton(proximaCargada ? 'Ver planilla' : 'Cargar asistencia', {
          tipo: 'primario',
          onClick: () => navegar('/asistencia', { grado: proxima.id, fecha: proxima.fecha }),
        })
      )
    );
  }

  /* --- Alumnos con asistencia baja ----------------------------------------- */

  const enRiesgo = reporteAlumnos
    .filter((a) => a.porcentaje !== null && a.porcentaje < UMBRAL_ASISTENCIA)
    .sort((a, b) => a.porcentaje - b.porcentaje);

  function tarjetaRiesgo() {
    if (reporteAlumnos.length === 0) return null;

    if (enRiesgo.length === 0) {
      return el('section', { clase: 'tarjeta' },
        el('h2', { clase: 'tarjeta__titulo' }, 'Asistencia por alumno'),
        el('p', { clase: 'apagado' },
          `Ningún alumno está por debajo del ${UMBRAL_ASISTENCIA}%.`)
      );
    }

    return el('section', { clase: 'tarjeta tarjeta--atencion' },
      el('h2', { clase: 'tarjeta__titulo' },
        `Asistencia baja — ${plural(enRiesgo.length, 'alumno')} por debajo del ${UMBRAL_ASISTENCIA}%`),
      el('ul', { clase: 'riesgo' },
        ...enRiesgo.slice(0, 6).map((a) =>
          el('li', {
            clase: 'riesgo__fila',
            onClick: () => navegar('/alumno', { id: a.id }),
          },
            el('span', { clase: 'riesgo__nombre' },
              `${a.apellido}, ${a.nombre}`,
              el('small', {}, `${a.escuela_nombre} — ${a.grado_nombre}`)
            ),
            medidor(a.porcentaje, { umbral: UMBRAL_ASISTENCIA })
          ))
      ),
      enRiesgo.length > 6
        ? boton(`Ver los ${enRiesgo.length} en Reportes`, {
            chico: true,
            onClick: () => navegar('/reportes', { ver: 'alumnos' }),
          })
        : null
    );
  }

  /* --- Dibujo -------------------------------------------------------------- */

  vaciar(contenedor);
  agregar(contenedor,
    encabezado('Inicio', 'Tu resumen de hoy'),

    tarjetaProximaClase(),

    el('div', { clase: 'metricas' },
      tarjetaNumero(totales.alumnos, plural(totales.alumnos, 'Alumno').replace(/^\d+\s/, ''),
        () => navegar('/alumnos')),
      tarjetaNumero(
        totales.porcentaje === null ? '—' : `${totales.porcentaje}%`,
        'Asistencia general',
        () => navegar('/reportes')
      ),
      tarjetaNumero(pendientes, 'Sin cargar esta semana', () => navegar('/asistencia')),
      tarjetaNumero(
        totales.promedio_notas === null ? '—' : totales.promedio_notas,
        'Promedio de notas',
        () => navegar('/notas')
      )
    ),

    el('section', { clase: 'tarjeta' },
      el('h2', { clase: 'tarjeta__titulo' }, 'Clases de esta semana'),

      agenda.length === 0
        ? el('div', { clase: 'vacio' },
            el('p', {}, 'Todavía no cargaste el horario de ningún grado.'),
            el('p', { clase: 'campo__ayuda' },
              'Con el día y la hora de cada grado, esta lista arma sola tu semana.'),
            boton('Ir a Grados', { tipo: 'primario', onClick: () => navegar('/grados') })
          )
        : el('ul', { clase: 'agenda' },
            ...agenda.map((g) =>
              el('li', {
                clase: `agenda__fila agenda__fila--enlace${g.fecha === hoyTexto ? ' agenda__fila--hoy' : ''}`,
                onClick: () => navegar('/asistencia', { grado: g.id, fecha: g.fecha }),
              },
                el('span', { clase: 'agenda__dia' },
                  nombreDeDia(g.dia_semana),
                  el('small', {}, formatear(g.fecha))
                ),
                el('span', { clase: 'agenda__hora' }, String(g.hora_inicio).slice(0, 5)),
                el('span', { clase: 'agenda__clase' },
                  `${g.escuela_nombre} — ${g.nombre}`,
                  el('small', {}, ` · ${plural(g.total_alumnos, 'alumno')}`)
                ),
                el('span', { clase: `etiqueta-estado etiqueta-estado--${g.cargada ? 'presente' : 'pendiente'}` },
                  g.cargada ? 'Cargada' : 'Pendiente')
              )
            )
          )
    ),

    tarjetaRiesgo(),

    el('div', { clase: 'accesos' },
      boton('Cargar asistencia', { tipo: 'primario', onClick: () => navegar('/asistencia') }),
      boton('Ver reportes', { onClick: () => navegar('/reportes') })
    )
  );
}
