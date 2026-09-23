/**
 * frontend/js/vistas/reportes.js
 * -----------------------------------------------------------------------------
 * Reportes: por escuela, por grado y por alumno.
 *
 * Los tres comparten el mismo rango de fechas y la misma forma: unos pocos
 * números grandes arriba, un gráfico para comparar de un vistazo, y la tabla
 * completa debajo con todos los datos.
 *
 * El gráfico y la tabla muestran lo mismo a propósito: el gráfico sirve para
 * ver quién está mejor o peor, la tabla para leer los números exactos y para
 * que la información siga siendo accesible sin depender del color.
 *
 * Todo se puede descargar en CSV para abrirlo en Excel.
 */

import { api } from '../api.js';
import { opcionesEscuelas, estado as cache } from '../estado.js';
import { navegar } from '../app.js';
import {
  el, vaciar, agregar, encabezado, boton, tabla, cargando, vacio, aviso, plural,
} from '../ui.js';
import { graficoBarras, medidor } from '../graficos.js';
import { icono } from '../iconos.js';
import { hoy, rangoDelMes, formatear } from '../fechas.js';

const PESTANAS = [
  { id: 'escuelas', texto: 'Por escuela' },
  { id: 'grados', texto: 'Por grado' },
  { id: 'alumnos', texto: 'Por alumno' },
];

/* ---------------------------------------------------------------------------
 * Descarga en CSV
 * ------------------------------------------------------------------------ */

/**
 * Arma un CSV y lo descarga.
 *
 * Dos detalles que parecen menores y no lo son:
 *  - Separador ";" y no ",": el Excel en español espera punto y coma.
 *  - El archivo arranca con "﻿": sin esa marca, Excel abre los acentos
 *    como símbolos raros (María aparece como MarÃ­a).
 */
function descargarCSV(nombreArchivo, columnas, filas) {
  const escapar = (valor) => {
    if (valor === null || valor === undefined) return '';
    const texto = String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const lineas = [
    columnas.map((c) => escapar(c.titulo)).join(';'),
    ...filas.map((fila) => columnas.map((c) => escapar(c.valor(fila))).join(';')),
  ];

  const contenido = `﻿${lineas.join('\r\n')}`;
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));

  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------------------
 * Vista
 * ------------------------------------------------------------------------ */

export async function vistaReportes(contenedor, parametros = {}) {
  const mes = rangoDelMes(hoy());

  let pestana = parametros.ver || 'escuelas';
  let desde = parametros.desde || mes.desde;
  let hasta = parametros.hasta || mes.hasta;
  let escuelaSel = parametros.escuela || '';
  let gradoSel = parametros.grado || '';

  /** Última respuesta del servidor, para poder exportarla sin volver a pedirla. */
  let filasActuales = [];

  const escuelas = await opcionesEscuelas();
  const todosLosGrados = await cache.grados();

  const panel = el('div', {});
  const cabeceraNumeros = el('div', { clase: 'metricas' });

  /* --- Filtros ----------------------------------------------------------- */

  const campoDesde = el('input', {
    clase: 'control control--filtro', type: 'date', value: desde,
    onChange: (e) => { desde = e.target.value; refrescar(); },
  });

  const campoHasta = el('input', {
    clase: 'control control--filtro', type: 'date', value: hasta,
    onChange: (e) => { hasta = e.target.value; refrescar(); },
  });

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

  /** Atajo: todo el período, sin filtrar por fecha. */
  function verTodo() {
    desde = '';
    hasta = '';
    campoDesde.value = '';
    campoHasta.value = '';
    refrescar();
  }

  function verEsteMes() {
    desde = mes.desde;
    hasta = mes.hasta;
    campoDesde.value = desde;
    campoHasta.value = hasta;
    refrescar();
  }

  /* --- Pestañas ----------------------------------------------------------- */

  const pestanas = el('div', { clase: 'pestanas', role: 'tablist' },
    ...PESTANAS.map((p) =>
      el('button', {
        clase: `pestana${p.id === pestana ? ' pestana--activa' : ''}`,
        type: 'button',
        role: 'tab',
        dataset: { id: p.id },
        onClick: () => {
          pestana = p.id;
          pestanas.querySelectorAll('.pestana').forEach((b) =>
            b.classList.toggle('pestana--activa', b.dataset.id === pestana));
          refrescar();
        },
      }, p.texto))
  );

  const botonCSV = boton('Descargar CSV', { onClick: () => exportar() });
  botonCSV.prepend(icono('descargar', { tamano: 17 }));

  vaciar(contenedor);
  contenedor.append(
    encabezado('Reportes', 'Asistencia y notas resumidas por escuela, grado y alumno', botonCSV),
    el('div', { clase: 'barra-filtros' },
      el('label', { clase: 'campo-inline' }, 'Desde', campoDesde),
      el('label', { clase: 'campo-inline' }, 'Hasta', campoHasta),
      boton('Este mes', { chico: true, onClick: verEsteMes }),
      boton('Todo', { chico: true, onClick: verTodo }),
      selectorEscuela,
      selectorGrado
    ),
    cabeceraNumeros,
    pestanas,
    panel
  );

  /* --- Números generales -------------------------------------------------- */

  function numero(valor, etiqueta) {
    return el('div', { clase: 'metrica metrica--estatica' },
      el('span', { clase: 'metrica__numero' }, valor),
      el('span', { clase: 'metrica__etiqueta' }, etiqueta)
    );
  }

  function dibujarTotales(t) {
    vaciar(cabeceraNumeros);
    cabeceraNumeros.append(
      numero(String(t.alumnos), 'Alumnos'),
      numero(String(t.clases), plural(t.clases, 'clase dictada', 'clases dictadas').replace(/^\d+\s/, '')),
      numero(t.porcentaje === null ? '—' : `${t.porcentaje}%`, 'Asistencia general'),
      numero(t.promedio_notas === null ? '—' : String(t.promedio_notas), 'Promedio de notas')
    );
  }

  /* --- Bloques comunes ---------------------------------------------------- */

  function bloqueGrafico(titulo, filas) {
    return el('section', { clase: 'tarjeta' },
      el('h2', { clase: 'tarjeta__titulo' }, titulo),
      graficoBarras({ filas, maximo: 100, sufijo: '%' }),
      el('p', { clase: 'grafico__pie' },
        'Asistencia = (presentes + tardes) ÷ (clases − justificadas). Pasá el mouse por una barra para ver el detalle.')
    );
  }

  function sinDatos(mensaje, accion = null) {
    return vacio(mensaje, accion);
  }

  /* --- Reporte por escuela ------------------------------------------------ */

  async function verEscuelas() {
    const respuesta = await api.get(`/reportes/escuelas${rango()}`);
    filasActuales = respuesta.escuelas;
    dibujarTotales(respuesta.totales);

    vaciar(panel);

    if (filasActuales.length === 0) {
      panel.append(sinDatos('No hay escuelas activas.'));
      return;
    }

    agregar(panel,
      bloqueGrafico('Asistencia por escuela', filasActuales.map((e) => ({
        etiqueta: e.nombre,
        valor: e.porcentaje,
        sinDatos: e.total === 0,
        detalle: `${e.nombre}: ${e.presentes} presentes, ${e.ausentes} ausentes, ${e.tardes} tarde, ${e.justificados} justificados`,
      }))),

      tabla([
        { titulo: 'Escuela', render: (e) => el('strong', {}, e.nombre) },
        { titulo: 'Código', render: (e) => e.codigo || '—' },
        { titulo: 'Grados', clase: 'col-numero', render: (e) => String(e.grados) },
        { titulo: 'Alumnos', clase: 'col-numero', render: (e) => String(e.alumnos) },
        { titulo: 'Clases', clase: 'col-numero', render: (e) => String(e.clases) },
        { titulo: 'Asistencia', render: (e) => medidor(e.porcentaje) },
        { titulo: 'Promedio', clase: 'col-numero', render: (e) => e.promedio_notas ?? '—' },
        {
          titulo: 'Ver',
          clase: 'col-acciones',
          render: (e) => boton('Grados', {
            chico: true,
            onClick: () => { escuelaSel = String(e.id); selectorEscuela.value = escuelaSel; llenarGrados(); pasarA('grados'); },
          }),
        },
      ], filasActuales)
    );
  }

  /* --- Reporte por grado -------------------------------------------------- */

  async function verGrados() {
    const grados = await api.get(`/reportes/grados${rango({ escuela_id: escuelaSel })}`);
    filasActuales = grados;

    vaciar(panel);

    if (grados.length === 0) {
      panel.append(sinDatos('No hay grados activos con estos filtros.'));
      return;
    }

    agregar(panel,
      bloqueGrafico('Asistencia por grado', grados.map((g) => ({
        etiqueta: `${g.escuela_nombre} — ${g.nombre}`,
        valor: g.porcentaje,
        sinDatos: g.total === 0,
        detalle: `${g.nombre}: ${g.presentes} presentes, ${g.ausentes} ausentes de ${g.clases} clases`,
      }))),

      tabla([
        { titulo: 'Escuela', render: (g) => g.escuela_nombre },
        { titulo: 'Grado', render: (g) => el('strong', {}, g.nombre) },
        { titulo: 'Alumnos', clase: 'col-numero', render: (g) => String(g.alumnos) },
        { titulo: 'Clases', clase: 'col-numero', render: (g) => String(g.clases) },
        { titulo: 'Asistencia', render: (g) => medidor(g.porcentaje) },
        { titulo: 'Promedio', clase: 'col-numero', render: (g) => g.promedio_notas ?? '—' },
        {
          titulo: 'Ver',
          clase: 'col-acciones',
          render: (g) => boton('Alumnos', {
            chico: true,
            onClick: () => {
              escuelaSel = String(g.escuela_id);
              selectorEscuela.value = escuelaSel;
              llenarGrados();
              gradoSel = String(g.id);
              selectorGrado.value = gradoSel;
              pasarA('alumnos');
            },
          }),
        },
      ], grados)
    );
  }

  /* --- Reporte por alumno ------------------------------------------------- */

  async function verAlumnos() {
    const alumnos = await api.get(
      `/reportes/alumnos${rango({ escuela_id: escuelaSel, grado_id: gradoSel })}`
    );
    filasActuales = alumnos;

    vaciar(panel);

    if (alumnos.length === 0) {
      panel.append(sinDatos('No hay alumnos activos con estos filtros.'));
      return;
    }

    // Los que peor vienen, primero: es la lista sobre la que hay que actuar.
    const enRiesgo = alumnos
      .filter((a) => a.porcentaje !== null && a.porcentaje < 75)
      .sort((a, b) => a.porcentaje - b.porcentaje);

    agregar(panel,
      enRiesgo.length > 0
        ? el('section', { clase: 'tarjeta tarjeta--atencion' },
            el('h2', { clase: 'tarjeta__titulo' },
              `Asistencia baja — ${plural(enRiesgo.length, 'alumno')} por debajo del 75%`),
            el('div', { clase: 'chips' },
              ...enRiesgo.slice(0, 12).map((a) =>
                el('button', {
                  clase: 'chip chip--riesgo',
                  type: 'button',
                  onClick: () => navegar('/alumno', { id: a.id }),
                }, `${a.apellido}, ${a.nombre} · ${a.porcentaje}%`))
            ),
            enRiesgo.length > 12
              ? el('p', { clase: 'campo__ayuda' }, `y ${enRiesgo.length - 12} más en la tabla.`)
              : null
          )
        : null,

      tabla([
        {
          titulo: 'Alumno',
          render: (a) => el('button', {
            clase: 'enlace-alumno',
            type: 'button',
            onClick: () => navegar('/alumno', { id: a.id }),
          }, `${a.apellido}, ${a.nombre}`),
        },
        { titulo: 'Escuela', render: (a) => a.escuela_nombre },
        { titulo: 'Grado', render: (a) => a.grado_nombre },
        { titulo: 'Clases', clase: 'col-numero', render: (a) => String(a.total) },
        { titulo: 'Ausencias', clase: 'col-numero', render: (a) => String(a.ausentes) },
        { titulo: 'Asistencia', render: (a) => medidor(a.porcentaje) },
        { titulo: 'Promedio', clase: 'col-numero', render: (a) => a.promedio_notas ?? '—' },
      ], alumnos)
    );
  }

  /* --- Exportación -------------------------------------------------------- */

  const COLUMNAS_CSV = {
    escuelas: [
      { titulo: 'Codigo', valor: (f) => f.codigo },
      { titulo: 'Escuela', valor: (f) => f.nombre },
      { titulo: 'Grados', valor: (f) => f.grados },
      { titulo: 'Alumnos', valor: (f) => f.alumnos },
      { titulo: 'Clases', valor: (f) => f.clases },
      { titulo: 'Presentes', valor: (f) => f.presentes },
      { titulo: 'Ausentes', valor: (f) => f.ausentes },
      { titulo: 'Tarde', valor: (f) => f.tardes },
      { titulo: 'Justificados', valor: (f) => f.justificados },
      { titulo: 'Asistencia %', valor: (f) => f.porcentaje },
      { titulo: 'Promedio notas', valor: (f) => f.promedio_notas },
    ],
    grados: [
      { titulo: 'Escuela', valor: (f) => f.escuela_nombre },
      { titulo: 'Grado', valor: (f) => f.nombre },
      { titulo: 'Alumnos', valor: (f) => f.alumnos },
      { titulo: 'Clases', valor: (f) => f.clases },
      { titulo: 'Presentes', valor: (f) => f.presentes },
      { titulo: 'Ausentes', valor: (f) => f.ausentes },
      { titulo: 'Asistencia %', valor: (f) => f.porcentaje },
      { titulo: 'Promedio notas', valor: (f) => f.promedio_notas },
    ],
    alumnos: [
      { titulo: 'Apellido', valor: (f) => f.apellido },
      { titulo: 'Nombre', valor: (f) => f.nombre },
      { titulo: 'Documento', valor: (f) => f.documento },
      { titulo: 'Escuela', valor: (f) => f.escuela_nombre },
      { titulo: 'Grado', valor: (f) => f.grado_nombre },
      { titulo: 'Clases', valor: (f) => f.total },
      { titulo: 'Presentes', valor: (f) => f.presentes },
      { titulo: 'Ausentes', valor: (f) => f.ausentes },
      { titulo: 'Tarde', valor: (f) => f.tardes },
      { titulo: 'Justificados', valor: (f) => f.justificados },
      { titulo: 'Asistencia %', valor: (f) => f.porcentaje },
      { titulo: 'Promedio notas', valor: (f) => f.promedio_notas },
    ],
  };

  function exportar() {
    if (filasActuales.length === 0) {
      aviso('No hay datos para descargar', 'error');
      return;
    }

    const periodo = desde || hasta
      ? `_${(desde || 'inicio').replace(/-/g, '')}-${(hasta || 'hoy').replace(/-/g, '')}`
      : '_todo';

    descargarCSV(`reporte_${pestana}${periodo}.csv`, COLUMNAS_CSV[pestana], filasActuales);
    aviso('Archivo descargado');
  }

  /* --- Coordinación ------------------------------------------------------- */

  /** Arma la query string con el rango y los filtros que correspondan. */
  function rango(extra = {}) {
    const partes = Object.entries({ desde, hasta, ...extra })
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return partes.length ? `?${partes.join('&')}` : '';
  }

  function pasarA(nueva) {
    pestana = nueva;
    pestanas.querySelectorAll('.pestana').forEach((b) =>
      b.classList.toggle('pestana--activa', b.dataset.id === pestana));
    refrescar();
  }

  async function refrescar() {
    // Los selectores de escuela y grado solo tienen sentido en su pestaña.
    selectorEscuela.parentElement.hidden = false;
    selectorEscuela.hidden = pestana === 'escuelas';
    selectorGrado.hidden = pestana !== 'alumnos';

    history.replaceState(null, '', `#/reportes?ver=${pestana}`);

    vaciar(panel);
    panel.append(cargando('Calculando...'));

    try {
      if (pestana === 'escuelas') await verEscuelas();
      else if (pestana === 'grados') await verGrados();
      else await verAlumnos();
    } catch (error) {
      vaciar(panel);
      panel.append(el('p', { clase: 'mensaje mensaje--error' }, error.message));
      aviso(error.message, 'error');
    }
  }

  // Los totales generales se muestran siempre, aunque la pestaña sea otra.
  try {
    const general = await api.get(`/reportes/escuelas${rango()}`);
    dibujarTotales(general.totales);
  } catch {
    // Si falla, refrescar() ya va a mostrar el error.
  }

  await refrescar();

  // El período se muestra abajo de todo, como pie del reporte.
  contenedor.append(
    el('p', { clase: 'reporte__pie' },
      desde || hasta
        ? `Período: ${desde ? formatear(desde) : 'inicio'} — ${hasta ? formatear(hasta) : 'hoy'}`
        : 'Período: todos los registros')
  );
}
