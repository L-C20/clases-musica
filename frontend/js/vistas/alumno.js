/**
 * frontend/js/vistas/alumno.js
 * -----------------------------------------------------------------------------
 * FICHA DEL ALUMNO: el centro de informacion de una persona.
 *
 * Todo lo que se sabe del alumno en una sola pantalla y en una sola llamada
 * al servidor (/api/alumnos/:id/ficha):
 *
 *   - Quien es y a que escuela y grado pertenece
 *   - Su porcentaje de asistencia y su nota actual
 *   - El historial completo de clases, con el estado de cada una
 *   - El historial de notas
 *   - Las observaciones generales
 *
 * Direccion: #/alumno?id=7
 */

import { api } from '../api.js';
import { navegar } from '../app.js';
import {
  el, vaciar, agregar, boton, tabla, etiquetaEstado, cargando, aviso, plural,
} from '../ui.js';
import { formatear, formatearConDia } from '../fechas.js';
import { editarAlumno, cambiarEstadoAlumno } from './alumnos.js';

const TEXTO_ESTADO = {
  presente: 'Presente',
  ausente: 'Ausente',
  tarde: 'Tarde',
  justificado: 'Justificado',
};

function marcaEstado(valor) {
  return el('span', { clase: `marca marca--${valor}` }, TEXTO_ESTADO[valor] || valor);
}

/** Tarjeta grande con un numero y su etiqueta. */
function indicador(numero, etiqueta, { tono = null, ayuda = null } = {}) {
  return el('div', { clase: `indicador${tono ? ` indicador--${tono}` : ''}` },
    el('span', { clase: 'indicador__numero' }, numero),
    el('span', { clase: 'indicador__etiqueta' }, etiqueta),
    ayuda ? el('small', { clase: 'indicador__ayuda' }, ayuda) : null
  );
}

export async function vistaAlumno(contenedor, parametros = {}) {
  const alumnoId = parametros.id;

  if (!alumnoId) {
    vaciar(contenedor);
    contenedor.append(
      el('p', { clase: 'mensaje mensaje--error' }, 'No se indicó qué alumno mostrar.'),
      boton('Ir a Alumnos', { tipo: 'primario', onClick: () => navegar('/alumnos') })
    );
    return;
  }

  vaciar(contenedor);
  contenedor.append(cargando('Buscando la ficha...'));

  async function dibujar() {
    const ficha = await api.get(`/alumnos/${alumnoId}/ficha`);
    const { alumno, asistencia, notas } = ficha;
    const est = asistencia.estadisticas;

    const porcentaje = est.porcentaje;
    const asistenciaBaja = porcentaje !== null && porcentaje < 75;

    vaciar(contenedor);
    agregar(contenedor,
      /* --- Cabecera ------------------------------------------------------ */
      el('div', { clase: 'ficha-volver' },
        boton('← Volver a Alumnos', { onClick: () => navegar('/alumnos', { grado: alumno.grado_id }) })
      ),

      el('header', { clase: 'ficha-cabecera' },
        el('div', {},
          el('h1', { clase: 'ficha-nombre' }, `${alumno.apellido}, ${alumno.nombre}`),
          el('p', { clase: 'ficha-sub' },
            alumno.escuela_codigo ? `${alumno.escuela_codigo} ${alumno.escuela_nombre}` : alumno.escuela_nombre,
            ` — ${alumno.grado_nombre}`,
            alumno.documento ? ` · DNI ${alumno.documento}` : ''
          )
        ),
        el('div', { clase: 'ficha-cabecera__acciones' },
          etiquetaEstado(alumno.activo),
          boton('Editar datos', { chico: true, onClick: () => editar(alumno) }),
          boton(alumno.activo ? 'Dar de baja' : 'Reactivar', {
            chico: true,
            tipo: alumno.activo ? 'peligro' : 'secundario',
            onClick: () => cambiarEstado(alumno),
          })
        )
      ),

      /* --- Indicadores --------------------------------------------------- */
      el('div', { clase: 'indicadores' },
        indicador(
          porcentaje === null ? '—' : `${porcentaje}%`,
          'Asistencia',
          {
            tono: porcentaje === null ? null : (asistenciaBaja ? 'malo' : 'bueno'),
            ayuda: asistenciaBaja ? 'Por debajo del 75%' : null,
          }
        ),
        indicador(
          notas.actual ? String(notas.actual.nota ?? notas.actual.concepto ?? '—') : '—',
          'Nota actual',
          { ayuda: notas.actual ? formatear(notas.actual.fecha) : 'Sin notas cargadas' }
        ),
        indicador(
          notas.resumen.promedio === null ? '—' : String(notas.resumen.promedio),
          'Promedio',
          { ayuda: plural(notas.resumen.cantidad, 'nota') }
        ),
        indicador(String(est.total), 'Clases', { ayuda: plural(est.ausentes, 'ausencia') })
      ),

      /* --- Observaciones generales --------------------------------------- */
      el('section', { clase: 'tarjeta' },
        el('h2', { clase: 'tarjeta__titulo' }, 'Observaciones generales'),
        alumno.observaciones
          ? el('p', { clase: 'ficha-observaciones' }, alumno.observaciones)
          : el('p', { clase: 'apagado' }, 'Sin observaciones cargadas.'),
        el('div', { clase: 'acciones' },
          boton(alumno.observaciones ? 'Editar observaciones' : 'Agregar observaciones', {
            chico: true,
            onClick: () => editar(alumno),
          })
        )
      ),

      /* --- Notas ---------------------------------------------------------- */
      el('section', { clase: 'tarjeta' },
        el('h2', { clase: 'tarjeta__titulo' },
          `Notas (${notas.lista.length})`),

        notas.lista.length === 0
          ? el('div', { clase: 'ficha-vacio' },
              el('p', { clase: 'apagado' }, 'Este alumno todavía no tiene notas.'),
              boton('Cargar notas del grado', {
                chico: true,
                onClick: () => navegar('/notas', { grado: alumno.grado_id }),
              })
            )
          : el('div', {},
              tabla([
                { titulo: 'Fecha', render: (n) => formatear(n.fecha) },
                {
                  titulo: 'Nota',
                  clase: 'col-numero',
                  render: (n) => el('strong', { clase: 'nota-valor' },
                    n.nota !== null ? String(n.nota) : (n.concepto || '—')),
                },
                { titulo: 'Período', render: (n) => n.periodo || '—' },
                { titulo: 'Observación', render: (n) => n.observacion || '—' },
              ], notas.lista),

              el('div', { clase: 'ficha-resumen' },
                `Mejor: ${notas.resumen.mejor ?? '—'}`,
                ' · ',
                `Más baja: ${notas.resumen.peor ?? '—'}`
              )
            )
      ),

      /* --- Asistencia ----------------------------------------------------- */
      el('section', { clase: 'tarjeta' },
        el('h2', { clase: 'tarjeta__titulo' }, `Historial de asistencia (${est.total})`),

        el('div', { clase: 'resumen resumen--ficha' },
          el('span', { clase: 'resumen__dato resumen__dato--presente' }, plural(est.presentes, 'presente')),
          el('span', { clase: 'resumen__dato resumen__dato--ausente' }, plural(est.ausentes, 'ausente')),
          el('span', { clase: 'resumen__dato resumen__dato--tarde' }, plural(est.tardes, 'tarde')),
          el('span', { clase: 'resumen__dato resumen__dato--justificado' }, plural(est.justificados, 'justificado'))
        ),

        asistencia.clases.length === 0
          ? el('div', { clase: 'ficha-vacio' },
              el('p', { clase: 'apagado' }, 'Todavía no hay asistencias registradas.'),
              boton('Cargar asistencia', {
                chico: true,
                onClick: () => navegar('/asistencia', { grado: alumno.grado_id }),
              })
            )
          : tabla([
              { titulo: 'Fecha', render: (c) => formatearConDia(c.fecha) },
              { titulo: 'Estado', render: (c) => marcaEstado(c.estado) },
              { titulo: 'Tema de la clase', render: (c) => c.tema || '—' },
              { titulo: 'Observación', render: (c) => c.observacion || '—' },
              {
                titulo: '',
                clase: 'col-acciones',
                render: (c) => boton('Abrir clase', {
                  chico: true,
                  onClick: () => navegar('/asistencia', { grado: alumno.grado_id, fecha: c.fecha }),
                }),
              },
            ], asistencia.clases)
      )
    );
  }

  async function editar(alumno) {
    await editarAlumno(alumno, { alTerminar: dibujar });
  }

  async function cambiarEstado(alumno) {
    await cambiarEstadoAlumno(alumno, { alTerminar: dibujar });
  }

  try {
    await dibujar();
  } catch (error) {
    vaciar(contenedor);
    contenedor.append(
      el('p', { clase: 'mensaje mensaje--error' }, error.message),
      boton('Volver a Alumnos', { tipo: 'primario', onClick: () => navegar('/alumnos') })
    );
    aviso(error.message, 'error');
  }
}
