/**
 * backend/config/db.js
 * -----------------------------------------------------------------------------
 * Unico punto de conexion a PostgreSQL de toda la aplicacion.
 *
 * Usa un POOL: en vez de abrir y cerrar una conexion por cada consulta
 * (que es lento), mantiene un conjunto de conexiones reutilizables.
 *
 * La cadena de conexion NUNCA se escribe aca: se lee de la variable
 * de entorno DATABASE_URL, definida en el archivo .env.
 */

const { Pool, types } = require('pg');

/**
 * IMPORTANTE - fechas sin zona horaria.
 *
 * Por defecto el driver convierte las columnas DATE en objetos Date de
 * JavaScript, que SIEMPRE llevan hora y zona. La fecha 2026-09-23 guardada
 * en la base salia como "2026-09-23T03:00:00.000Z" (medianoche en Argentina
 * expresada en UTC), y al formatearla en otra zona horaria podia mostrarse
 * como el dia anterior.
 *
 * Esto importa de verdad al publicar en un servidor: Railway corre en UTC
 * y vos estas en UTC-3.
 *
 * La solucion es pedirle al driver que devuelva las DATE tal cual estan:
 * el texto "2026-09-23". Una fecha de calendario no tiene hora, y asi viaja
 * intacta desde la base hasta la pantalla.
 *
 * 1082 es el identificador del tipo DATE en PostgreSQL.
 */
types.setTypeParser(1082, (valor) => valor);

if (!process.env.DATABASE_URL) {
  console.error('\nFalta la variable DATABASE_URL.');
  console.error('Revisa que exista el archivo .env en la raiz del proyecto.\n');
  process.exit(1);
}

/**
 * SSL.
 *
 * - En tu computadora PostgreSQL no usa SSL: queda apagado.
 * - En Railway, conectando por la red interna (postgres.railway.internal),
 *   TAMPOCO hace falta SSL.
 * - Si algun dia conectas a una base remota por internet, se prende poniendo
 *   DATABASE_SSL=true en las variables de entorno.
 *
 * rejectUnauthorized: false es lo habitual con estos proveedores, porque usan
 * certificados propios que el sistema no conoce.
 */
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 10,                       // maximo de conexiones simultaneas
  idleTimeoutMillis: 30000,      // cierra conexiones ociosas a los 30s
  connectionTimeoutMillis: 10000, // falla si no conecta en 10s
});

// Si una conexion inactiva del pool falla, lo avisamos en vez de
// dejar que tire abajo el proceso entero.
pool.on('error', (error) => {
  console.error('Error inesperado en el pool de PostgreSQL:', error.message);
});

/**
 * Ejecuta una consulta parametrizada.
 *
 * IMPORTANTE - siempre usar parametros ($1, $2, ...), nunca concatenar
 * texto dentro del SQL. Asi se evita la inyeccion SQL:
 *
 *   BIEN:  consulta('SELECT * FROM alumnos WHERE id = $1', [id])
 *   MAL:   consulta('SELECT * FROM alumnos WHERE id = ' + id)
 *
 * @param {string} texto  SQL con parametros $1, $2, ...
 * @param {Array}  valores  valores para esos parametros
 */
async function consulta(texto, valores = []) {
  return pool.query(texto, valores);
}

/**
 * Ejecuta varias consultas dentro de una misma transaccion.
 * Si cualquiera falla, se revierte todo (ROLLBACK).
 * Lo vamos a usar en la Fase 3 para guardar la planilla de asistencia.
 *
 * @param {(cliente: import('pg').PoolClient) => Promise<any>} trabajo
 */
async function enTransaccion(trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

/** Comprueba que la base responda. Se llama al arrancar el servidor. */
async function verificarConexion() {
  const { rows } = await pool.query('SELECT current_database() AS base, now() AS hora');
  return rows[0];
}

/** Cierra el pool ordenadamente (al apagar el servidor o terminar un script). */
async function cerrarPool() {
  await pool.end();
}

module.exports = { pool, consulta, enTransaccion, verificarConexion, cerrarPool };
