/**
 * frontend/js/fechas.js
 * -----------------------------------------------------------------------------
 * Manejo de fechas SIN zona horaria.
 *
 * Regla del proyecto: una fecha de clase es un dia de calendario, y viaja
 * siempre como texto "AAAA-MM-DD".
 *
 * NUNCA usar new Date(iso).toISOString() para volver a texto: eso convierte
 * a UTC y en Argentina (UTC-3) devuelve el dia anterior. Por eso todo lo de
 * aca trabaja con las partes locales de la fecha.
 */

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Convierte un Date local a texto AAAA-MM-DD. */
function aTexto(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Convierte "AAAA-MM-DD" a un Date en horario local (mediodia, para evitar bordes). */
function aFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 12, 0, 0);
}

/** La fecha de hoy, como texto. */
export function hoy() {
  return aTexto(new Date());
}

/** Numero de dia de la semana (0=domingo) de una fecha en texto. */
export function diaSemanaDe(texto) {
  return aFecha(texto).getDay();
}

export function nombreDeDia(numero) {
  return NOMBRES_DIA[numero] ?? '';
}

/** "2026-09-23" -> "23/09/2026" */
export function formatear(texto) {
  if (!texto) return '';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** "2026-09-23" -> "Miércoles 23/09/2026" */
export function formatearConDia(texto) {
  if (!texto) return '';
  return `${nombreDeDia(diaSemanaDe(texto))} ${formatear(texto)}`;
}

/** Suma (o resta, con numero negativo) dias a una fecha en texto. */
export function sumarDias(texto, dias) {
  const fecha = aFecha(texto);
  fecha.setDate(fecha.getDate() + dias);
  return aTexto(fecha);
}

/**
 * Devuelve la fecha del dia de la semana pedido dentro de la semana actual.
 * La semana se considera de lunes a domingo.
 *
 * Ejemplo: si hoy es viernes y se pide el miercoles, devuelve el miercoles
 * de esta misma semana (ya pasado), que es justo la clase que hay que cargar.
 */
export function fechaDeEstaSemana(diaSemana) {
  const ahora = new Date();
  const diaHoy = ahora.getDay();

  // Lunes como primer dia: el domingo (0) pasa a ser el septimo dia.
  const posicionHoy = diaHoy === 0 ? 7 : diaHoy;
  const posicionObjetivo = diaSemana === 0 ? 7 : diaSemana;

  const lunes = new Date(ahora);
  lunes.setDate(ahora.getDate() - (posicionHoy - 1));
  lunes.setDate(lunes.getDate() + (posicionObjetivo - 1));

  return aTexto(lunes);
}

/** Primer y ultimo dia del mes de una fecha dada. */
export function rangoDelMes(texto) {
  const [anio, mes] = texto.split('-').map(Number);
  const ultimo = new Date(anio, mes, 0).getDate();
  return {
    desde: `${anio}-${String(mes).padStart(2, '0')}-01`,
    hasta: `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`,
  };
}
