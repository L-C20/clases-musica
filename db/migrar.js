/**
 * db/migrar.js
 * -----------------------------------------------------------------------------
 * Aplica las migraciones de db/migrations/ en orden alfabetico (001, 002, ...).
 *
 * Lleva el control en una tabla `migraciones`: cada archivo se ejecuta UNA
 * sola vez. Se puede correr las veces que haga falta sin romper nada.
 *
 * Se usa de dos maneras:
 *
 *   1. Desde la terminal:
 *        npm run db:migrar      aplica las migraciones pendientes
 *        npm run db:seed        ademas carga db/seed.sql
 *
 *   2. Desde backend/index.js al arrancar el servidor. Asi, al desplegar en
 *      Railway una version con una migracion nueva, se aplica sola: no hay
 *      que acordarse de entrar a correr nada a mano.
 */

// dotenv va antes que todo: config/db.js necesita DATABASE_URL al cargarse.
// Si ya fue cargado por backend/index.js, esta segunda llamada no hace nada.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, cerrarPool } = require('../backend/config/db');

const CARPETA_MIGRACIONES = path.join(__dirname, 'migrations');
const ARCHIVO_SEED = path.join(__dirname, 'seed.sql');

async function asegurarTablaDeControl(cliente) {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS migraciones (
      id          SERIAL PRIMARY KEY,
      archivo     TEXT NOT NULL UNIQUE,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Aplica las migraciones pendientes.
 *
 * @param {object} opciones
 * @param {boolean} opciones.conSeed    ademas carga los datos iniciales
 * @param {boolean} opciones.silencioso no imprime las que ya estaban aplicadas
 * @returns {Promise<number>} cuantas migraciones se aplicaron
 */
async function aplicarMigraciones({ conSeed = false, silencioso = false } = {}) {
  const cliente = await pool.connect();

  try {
    await asegurarTablaDeControl(cliente);

    const { rows } = await cliente.query('SELECT archivo FROM migraciones');
    const yaAplicadas = new Set(rows.map((r) => r.archivo));

    const archivos = fs
      .readdirSync(CARPETA_MIGRACIONES)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let aplicadas = 0;

    for (const archivo of archivos) {
      if (yaAplicadas.has(archivo)) {
        if (!silencioso) console.log(`  =  ${archivo} (ya aplicada)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(CARPETA_MIGRACIONES, archivo), 'utf8');

      // Cada migracion corre dentro de una transaccion: o se aplica entera,
      // o no se aplica nada.
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('INSERT INTO migraciones (archivo) VALUES ($1)', [archivo]);
        await cliente.query('COMMIT');
        console.log(`  +  ${archivo} aplicada`);
        aplicadas++;
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw new Error(`Fallo la migracion ${archivo}: ${error.message}`);
      }
    }

    if (conSeed) {
      await cliente.query(fs.readFileSync(ARCHIVO_SEED, 'utf8'));
      const { rows: escuelas } = await cliente.query(
        'SELECT codigo, nombre FROM escuelas ORDER BY codigo'
      );
      console.log('\nDatos iniciales cargados. Escuelas en la base:');
      escuelas.forEach((e) => console.log(`  - ${e.codigo} ${e.nombre}`));
    }

    return aplicadas;
  } finally {
    cliente.release();
  }
}

module.exports = { aplicarMigraciones };

/* --- Modo linea de comandos ------------------------------------------------ */
// require.main === module significa "se ejecuto este archivo directamente",
// no "otro archivo lo importo". Solo en ese caso cerramos el pool y salimos.
if (require.main === module) {
  aplicarMigraciones({ conSeed: process.argv.includes('--seed') })
    .then((aplicadas) => {
      console.log(
        aplicadas > 0
          ? `\nListo: ${aplicadas} migracion(es) aplicada(s).`
          : '\nListo: la base ya estaba al dia.'
      );
    })
    .catch((error) => {
      console.error('\nERROR:', error.message);
      process.exitCode = 1;
    })
    .finally(() => cerrarPool());
}
