/**
 * frontend/js/vistas/historial.js
 * -----------------------------------------------------------------------------
 * Consulta de clases ya dictadas, con filtros por escuela, grado y rango de
 * fechas, y el detalle alumno por alumno de cada clase.
 *
 * El historial individual de cada alumno esta en su ficha (#/alumno?id=7),
 * a la que se llega desde el detalle de cualquier clase.
 */

import { api } from '../api.js';
import { opcionesEscuelas, estado as cache } from '../estado.js';
import { navegar } from '../app.js';
import {
  el, vaciar, encabezado, boton, tabla, cargando, vacio, aviso,
} from '../ui.js';
import { formatear, formatearConDia, rangoDelMes, hoy } from '../fechas.js';
import { medidor } from '../graficos.js';

const COLOR_ESTADO = {
  presente: 'presente',
  ausente: 'ausente',
  tarde: 'tarde',
  justificado: 'justificado',
};

const TEXTO_ESTADO = {
  presente: 'Presente',
  ausente: 'Ausente',
  tarde: 'Tarde',
  justificado: 'Justificado',
};

function pastillaEstado(valor) {
  return el('span', { clase: `etiqueta-estado etiqueta-estado--${COLOR_ESTADO[valor] || 'apagado'}` },
    TEXTO_ESTADO[valor] || valor);
}

export async function vistaHistorial(contenedor, parametros = {}) {
  const mesActual = rangoDelMes(hoy());

  // El historial individual del alumno ahora vive en su ficha (Fase 6).
  // Los enlaces viejos con ?alumno=ID se redirigen alli.
  if (parametros.alumno) {
    navegar('/alumno', { id: parametros.alumno });
    return;
  }

  let escuelaSel = parametros.escuela || '';
  let gradoSel = parametros.grado || '';
  let desde = parametros.desde || mesActual.desde;
  let hasta = parametros.hasta || mesActual.hasta;

  const escuelas = await opcionesEscuelas();
  const todosLosGrados = await cache.grados();
  const panel = el('div', {});

  const selectorEscuela = el('select', {
    clase: 'control control--filtro',
    onChange: (e) => { escuelaSel = e.target.value; gradoSel = ''; llenarGrados(); refrescar(); },
  },
    el('option', { value: '' }, 'Todas las escuelas'),
    ...escuelas.map((o) =>
      el('option', { value: String(o.valor), selected: String(o.valor) === String(escuelaSel) }, o.texto))
  );

  const selectorGrado = el('select', {
    clase: 'control control--filtro',
    onChange: (e) => { gradoSel = e.target.value; refrescar(); },
  });

  const campoDesde = el('input', {
    clase: 'control control--filtro', type: 'date', value: desde,
    onChange: (e) => { desde = e.target.value; refrescar(); },
  });

  const campoHasta = el('input', {
    clase: 'control control--filtro', type: 'date', value: hasta,
    onChange: (e) => { hasta = e.target.value; refrescar(); },
  });

  function llenarGrados() {
    const grados = todosLosGrados.filter((g) => !escuelaSel || g.escuela_id === Number(escuelaSel));
    vaciar(selectorGrado);
    selectorGrado.append(
      el('option', { value: '' }, 'Todos los grados'),
      ...grados.map((g) =>
        el('option', { value: String(g.id), selected: String(g.id) === String(gradoSel) },
          escuelaSel ? g.nombre : `${g.escuela_nombre} - ${g.nombre}`))
    );
  }

  llenarGrados();

  vaciar(contenedor);
  contenedor.append(
    encabezado('Historial', 'Clases dictadas y asistencia registrada'),
    el('div', { clase: 'barra-filtros' },
      selectorEscuela,
      selectorGrado,
      el('label', { clase: 'campo-inline' }, 'Desde', campoDesde),
      el('label', { clase: 'campo-inline' }, 'Hasta', campoHasta)
    ),
    panel
  );


  async function dibujarClases() {
    const clases = await api.get(
      `/clases?escuela_id=${escuelaSel}&grado_id=${gradoSel}&desde=${desde}&hasta=${hasta}`
    );

    vaciar(panel);

    if (clases.length === 0) {
      panel.append(vacio('No hay clases registradas con estos filtros.'));
      return;
    }

    panel.append(
      el('p', { clase: 'conteo' }, `${clases.length} clase${clases.length === 1 ? '' : 's'}`),
      tabla([
        { titulo: 'Fecha', render: (c) => formatear(c.fecha) },
        { titulo: 'Escuela', render: (c) => c.escuela_nombre },
        { titulo: 'Grado', render: (c) => el('strong', {}, c.grado_nombre) },
        { titulo: 'Tema', render: (c) => c.tema || '—' },
        { titulo: 'Presentes', clase: 'col-numero', render: (c) => `${c.presentes}/${c.total}` },
        { titulo: 'Ausentes', clase: 'col-numero', render: (c) => String(c.ausentes) },
        { titulo: 'Asistencia', render: (c) => medidor(c.porcentaje) },
        {
          titulo: 'Acciones',
          clase: 'col-acciones',
          render: (clase) => el('div', { clase: 'acciones' },
            boton('Ver', { chico: true, onClick: () => verDetalle(clase.id) }),
            boton('Editar', {
              chico: true,
              titulo: 'Abrir la planilla de esta clase',
              onClick: () => navegar('/asistencia', { grado: clase.grado_id, fecha: clase.fecha }),
            })
          ),
        },
      ], clases)
    );
  }

  async function verDetalle(claseId) {
    const clase = await api.get(`/clases/${claseId}`);

    vaciar(panel);
    panel.append(
      el('div', { clase: 'clase-cabecera' },
        el('h2', {}, `${clase.escuela_nombre} — ${clase.grado_nombre}`),
        el('p', { clase: 'clase-cabecera__fecha' }, formatearConDia(clase.fecha)),
        clase.tema ? el('p', { clase: 'clase-cabecera__tema' }, `Tema: ${clase.tema}`) : null
      ),
      el('div', { clase: 'acciones' },
        boton('Volver al listado', { onClick: refrescar }),
        boton('Editar esta planilla', {
          tipo: 'primario',
          onClick: () => navegar('/asistencia', { grado: clase.grado_id, fecha: clase.fecha }),
        })
      ),
      el('div', { clase: 'separador' }),
      tabla([
        { titulo: 'Alumno', render: (a) => el('strong', {}, `${a.apellido}, ${a.nombre}`) },
        { titulo: 'Estado', render: (a) => pastillaEstado(a.estado) },
        { titulo: 'Observación', render: (a) => a.observacion || '—' },
        {
          titulo: 'Ficha',
          clase: 'col-acciones',
          render: (a) => boton('Ver alumno', {
            chico: true,
            titulo: 'Abrir la ficha completa del alumno',
            onClick: () => navegar('/alumno', { id: a.alumno_id }),
          }),
        },
      ], clase.asistencias)
    );
  }

  async function refrescar() {
    vaciar(panel);
    panel.append(cargando());

    try {
      await dibujarClases();
    } catch (error) {
      vaciar(panel);
      panel.append(el('p', { clase: 'mensaje mensaje--error' }, error.message));
      aviso(error.message, 'error');
    }
  }

  await refrescar();
}
