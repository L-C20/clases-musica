/**
 * frontend/js/vistas/grados.js
 * -----------------------------------------------------------------------------
 * Pantalla de grados: listado filtrable por escuela, alta, edicion,
 * activar/desactivar y carga del horario semanal habitual.
 *
 * Acepta el parametro ?escuela=ID en la direccion, para poder llegar aca
 * desde la pantalla de escuelas ya filtrado.
 */

import { api } from '../api.js';
import { estado, opcionesEscuelas } from '../estado.js';
import { navegar } from '../app.js';
import {
  el, vaciar, encabezado, boton, tabla, etiquetaEstado,
  cargando, vacio, aviso, formulario, confirmar,
} from '../ui.js';

export const DIAS = [
  { valor: 1, texto: 'Lunes' },
  { valor: 2, texto: 'Martes' },
  { valor: 3, texto: 'Miércoles' },
  { valor: 4, texto: 'Jueves' },
  { valor: 5, texto: 'Viernes' },
  { valor: 6, texto: 'Sábado' },
  { valor: 0, texto: 'Domingo' },
];

export function nombreDia(numero) {
  return DIAS.find((d) => d.valor === numero)?.texto || null;
}

/** "Miércoles 10:00 (60 min)" o un guion si todavia no tiene horario. */
export function textoHorario(grado) {
  if (grado.dia_semana === null || !grado.hora_inicio) return '—';
  const hora = String(grado.hora_inicio).slice(0, 5);
  return `${nombreDia(grado.dia_semana)} ${hora} (${grado.duracion_min} min)`;
}

export async function vistaGrados(contenedor, parametros = {}) {
  let escuelaFiltro = parametros.escuela || '';
  let mostrarInactivos = false;

  const escuelas = await opcionesEscuelas();
  const lista = el('div', {});

  const selectorEscuela = el('select', {
    clase: 'control control--filtro',
    onChange: (e) => { escuelaFiltro = e.target.value; refrescar(); },
  },
    el('option', { value: '' }, 'Todas las escuelas'),
    ...escuelas.map((o) =>
      el('option', { value: String(o.valor), selected: String(o.valor) === String(escuelaFiltro) }, o.texto))
  );

  vaciar(contenedor);
  contenedor.append(
    encabezado(
      'Grados',
      'Cada grado pertenece a una escuela y tiene una clase por semana',
      boton('+ Nuevo grado', { tipo: 'primario', onClick: () => abrirFormulario() })
    ),
    el('div', { clase: 'barra-filtros' },
      selectorEscuela,
      el('label', { clase: 'casilla' },
        el('input', {
          type: 'checkbox',
          onChange: (e) => { mostrarInactivos = e.target.checked; refrescar(); },
        }),
        'Mostrar inactivos'
      )
    ),
    lista
  );

  async function refrescar() {
    vaciar(lista);
    lista.append(cargando());

    const grados = await api.grados.listar({
      escuela_id: escuelaFiltro || null,
      incluir_inactivos: mostrarInactivos,
    });

    vaciar(lista);

    if (grados.length === 0) {
      lista.append(vacio(
        escuelaFiltro ? 'Esta escuela todavía no tiene grados.' : 'Todavía no hay grados cargados.',
        boton('Crear un grado', { tipo: 'primario', onClick: () => abrirFormulario() })
      ));
      return;
    }

    lista.append(tabla([
      { titulo: 'Escuela', render: (g) => g.escuela_nombre },
      { titulo: 'Grado', render: (g) => el('strong', {}, g.nombre) },
      { titulo: 'Horario semanal', render: (g) => textoHorario(g) },
      { titulo: 'Alumnos', clase: 'col-numero', render: (g) => String(g.total_alumnos) },
      { titulo: 'Estado', render: (g) => etiquetaEstado(g.activo) },
      {
        titulo: 'Acciones',
        clase: 'col-acciones',
        render: (grado) => el('div', { clase: 'acciones' },
          boton('Alumnos', {
            chico: true,
            titulo: 'Ver los alumnos de este grado',
            onClick: () => navegar('/alumnos', { grado: grado.id }),
          }),
          boton('Editar', { chico: true, onClick: () => abrirFormulario(grado) }),
          boton(grado.activo ? 'Desactivar' : 'Activar', {
            chico: true,
            tipo: grado.activo ? 'peligro' : 'secundario',
            onClick: () => cambiarEstado(grado),
          })
        ),
      },
    ], grados));
  }

  function campos() {
    return [
      { nombre: 'escuela_id', etiqueta: 'Escuela', tipo: 'select', requerido: true,
        numerico: true, opciones: escuelas },
      { nombre: 'nombre', etiqueta: 'Nombre del grado', tipo: 'texto', requerido: true,
        ancho: 'mitad', marcador: '5to grado' },
      { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero', ancho: 'mitad', min: 0,
        ayuda: 'Para ordenar la lista (1, 2, 3...)' },
      { nombre: 'dia_semana', etiqueta: 'Día de clase', tipo: 'select', ancho: 'mitad',
        numerico: true, opciones: DIAS, textoVacio: 'Sin definir' },
      { nombre: 'hora_inicio', etiqueta: 'Hora', tipo: 'hora', ancho: 'mitad' },
      { nombre: 'duracion_min', etiqueta: 'Duración (minutos)', tipo: 'numero',
        ancho: 'mitad', min: 1, ayuda: 'Si se deja vacío, se usan 60' },
    ];
  }

  function abrirFormulario(grado = null) {
    const valores = grado
      ? { ...grado, hora_inicio: grado.hora_inicio ? String(grado.hora_inicio).slice(0, 5) : '' }
      : { escuela_id: escuelaFiltro || '', duracion_min: 60 };

    formulario({
      titulo: grado ? `Editar ${grado.nombre}` : 'Nuevo grado',
      campos: campos(),
      valores,
      alGuardar: async (datos) => {
        if (datos.duracion_min === null) datos.duracion_min = 60;
        if (datos.orden === null) datos.orden = 0;

        if (grado) await api.grados.actualizar(grado.id, datos);
        else await api.grados.crear(datos);

        estado.olvidar('grados', 'escuelas');
        aviso(grado ? 'Grado actualizado' : 'Grado creado');
        await refrescar();
      },
    });
  }

  async function cambiarEstado(grado) {
    if (grado.activo) {
      const sigue = await confirmar(
        `¿Desactivar "${grado.nombre}"? Sus alumnos y su historial se conservan.`,
        { textoOk: 'Desactivar', peligroso: true }
      );
      if (!sigue) return;
    }

    await api.grados.cambiarEstado(grado.id, !grado.activo);
    estado.olvidar('grados', 'escuelas');
    aviso(grado.activo ? 'Grado desactivado' : 'Grado activado');
    await refrescar();
  }

  await refrescar();
}
