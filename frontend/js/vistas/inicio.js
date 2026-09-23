/**
 * frontend/js/vistas/inicio.js
 * -----------------------------------------------------------------------------
 * Pantalla de inicio.
 *
 * El bloque principal son las CLASES DE ESTA SEMANA: cada grado con horario
 * cargado aparece con la fecha que le toca, si su asistencia ya esta cargada
 * o no, y un toque lleva directo a la planilla.
 *
 * Ese es el recorrido diario completo: abrir, ver la clase, marcar, guardar.
 */

import { api } from '../api.js';
import { navegar } from '../app.js';
import { el, vaciar, encabezado, boton, cargando } from '../ui.js';
import { fechaDeEstaSemana, formatear, nombreDeDia, hoy } from '../fechas.js';

function tarjetaNumero(numero, etiqueta, alHacerClic) {
  return el('button', { clase: 'metrica', type: 'button', onClick: alHacerClic },
    el('span', { clase: 'metrica__numero' }, String(numero)),
    el('span', { clase: 'metrica__etiqueta' }, etiqueta)
  );
}

export async function vistaInicio(contenedor) {
  vaciar(contenedor);
  contenedor.append(encabezado('Inicio', 'Resumen general'), cargando());

  // La semana va de lunes a domingo; se pide el rango completo de una vez.
  const lunes = fechaDeEstaSemana(1);
  const domingo = fechaDeEstaSemana(0);

  const [escuelas, grados, alumnos, clasesDeLaSemana] = await Promise.all([
    api.escuelas.listar(),
    api.grados.listar(),
    api.alumnos.listar(),
    api.get(`/clases?desde=${lunes}&hasta=${domingo}`),
  ]);

  // Para saber rapido si un grado ya tiene cargada su clase de esta semana.
  const yaCargadas = new Set(clasesDeLaSemana.map((c) => `${c.grado_id}|${c.fecha}`));

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
  const hoyTexto = hoy();

  vaciar(contenedor);
  contenedor.append(
    encabezado('Inicio', 'Resumen general'),

    el('div', { clase: 'metricas' },
      tarjetaNumero(escuelas.length, escuelas.length === 1 ? 'Escuela' : 'Escuelas', () => navegar('/escuelas')),
      tarjetaNumero(grados.length, grados.length === 1 ? 'Grado' : 'Grados', () => navegar('/grados')),
      tarjetaNumero(alumnos.length, alumnos.length === 1 ? 'Alumno' : 'Alumnos', () => navegar('/alumnos')),
      tarjetaNumero(pendientes, 'Sin cargar esta semana', () => navegar('/asistencia'))
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
                  el('small', {}, ` · ${g.total_alumnos} ${g.total_alumnos === 1 ? 'alumno' : 'alumnos'}`)
                ),
                el('span', { clase: `etiqueta-estado etiqueta-estado--${g.cargada ? 'presente' : 'pendiente'}` },
                  g.cargada ? 'Cargada' : 'Pendiente')
              )
            )
          )
    ),

    el('div', { clase: 'accesos' },
      boton('Cargar asistencia', { tipo: 'primario', onClick: () => navegar('/asistencia') }),
      boton('Ver historial', { onClick: () => navegar('/historial') })
    )
  );
}
