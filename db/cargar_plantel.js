/**
 * db/cargar_plantel.js
 * -----------------------------------------------------------------------------
 * Carga los grados y alumnos de una escuela desde un archivo de texto.
 *
 * Cargar 62 alumnos a mano por el formulario son 62 ventanas. Este script lee
 * la lista tal como viene del colegio y la mete de una sola vez.
 *
 *   node db/cargar_plantel.js db/planteles/1722-la-fundicion.txt
 *   node db/cargar_plantel.js db/planteles/1722-la-fundicion.txt --aplicar
 *
 * Con un guion en lugar del archivo, la lista se lee de la entrada estandar.
 * Eso es lo que permite cargar la base de Railway sin que la lista tenga que
 * pasar por el repositorio, que es publico:
 *
 *   railway ssh --service app "node db/cargar_plantel.js - --aplicar" < lista.txt
 *
 * SIN --aplicar no escribe nada: muestra lo que haría y termina. Siempre
 * conviene mirar ese informe antes de aplicar.
 *
 * Se puede correr DOS VECES sin duplicar nada:
 *
 *   - Los grados se identifican por (escuela, nombre), que en la base ya es
 *     una restriccion UNIQUE.
 *   - Un alumno se considera el mismo si ya existe otro con igual apellido y
 *     nombre en ese grado, sin distinguir mayusculas ni acentos.
 *
 * Asi, agregar un alumno que se sumo a mitad de año es escribirlo en el
 * archivo y volver a correr el script: los que ya estaban se saltean.
 *
 * NO borra ni desactiva a nadie que no figure en el archivo. Dar de baja es
 * una decision que se toma alumno por alumno, desde la aplicacion.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { consulta, enTransaccion, cerrarPool } = require('../backend/config/db');

/* ---------------------------------------------------------------------------
 * Lectura del archivo
 * ------------------------------------------------------------------------ */

/**
 * "GONZALEZ CADÍN" -> "Gonzalez Cadín"
 *
 * Las listas vienen de varias manos: algunos apellidos en mayuscula sostenida,
 * otros no. Sin unificar, la pantalla de alumnos queda con la mitad de los
 * nombres gritando. Los acentos se respetan tal como vinieron.
 */
function capitalizar(texto) {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toLocaleUpperCase('es') +
      palabra.slice(1).toLocaleLowerCase('es'))
    .join(' ');
}

function leerPlantel(archivo) {
  // "-" significa leer de la entrada estandar (fd 0).
  const texto = fs.readFileSync(archivo === '-' ? 0 : archivo, 'utf8');
  const lineas = texto.split(/\r?\n/);

  let codigoEscuela = null;
  const grados = [];

  lineas.forEach((original, indice) => {
    const numero = indice + 1;

    // Se saca lo que va entre parentesis ("(1°)") y los comentarios.
    const linea = original.replace(/#.*$/, '').replace(/\([^)]*\)/g, '').trim();
    if (linea === '') return;

    const escuela = linea.match(/^escuela:\s*(.+)$/i);
    if (escuela) {
      codigoEscuela = escuela[1].trim();
      return;
    }

    if (!linea.includes(',')) {
      grados.push({ nombre: linea, alumnos: [] });
      return;
    }

    if (grados.length === 0) {
      throw new Error(`Linea ${numero}: hay un alumno antes del primer grado.`);
    }

    // Solo la PRIMERA coma separa apellido de nombre: "Garcia, Juan, Pablo"
    // es el apellido "Garcia" y el nombre "Juan Pablo".
    const corte = linea.indexOf(',');
    const apellido = capitalizar(linea.slice(0, corte).trim());
    const nombre = capitalizar(linea.slice(corte + 1).replace(/,/g, ' ').trim());

    if (!apellido || !nombre) {
      throw new Error(`Linea ${numero}: falta el apellido o el nombre en "${original.trim()}".`);
    }

    grados.at(-1).alumnos.push({ apellido, nombre });
  });

  if (!codigoEscuela) {
    throw new Error('El archivo no dice a que escuela pertenece. Falta la linea "escuela: 1722".');
  }
  if (grados.length === 0) {
    throw new Error('El archivo no tiene ningun grado.');
  }

  return { codigoEscuela, grados };
}

/* ---------------------------------------------------------------------------
 * Carga
 * ------------------------------------------------------------------------ */

/** Compara nombres ignorando mayusculas, acentos y espacios de mas. */
function clave(apellido, nombre) {
  return `${apellido}|${nombre}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function cargar(archivo, aplicar) {
  const { codigoEscuela, grados } = leerPlantel(archivo);

  const escuelas = await consulta(
    'SELECT id, nombre FROM escuelas WHERE codigo = $1', [codigoEscuela]);

  if (escuelas.rows.length === 0) {
    throw new Error(`No hay ninguna escuela con el codigo "${codigoEscuela}".`);
  }
  const escuela = escuelas.rows[0];

  console.log(`\nEscuela:  ${escuela.nombre} (codigo ${codigoEscuela})`);
  console.log(`Archivo:  ${archivo === '-' ? 'entrada estandar' : path.basename(archivo)}`);
  console.log(aplicar ? 'Modo:     APLICAR\n' : 'Modo:     ensayo (no se escribe nada)\n');

  const resumen = { gradosNuevos: 0, alumnosNuevos: 0, alumnosRepetidos: 0 };

  await enTransaccion(async (cliente) => {
    for (const [posicion, grado] of grados.entries()) {
      // ON CONFLICT sobre la UNIQUE (escuela_id, nombre): si el grado ya
      // existe se devuelve el que estaba, sin tocarle el horario.
      const filaGrado = await cliente.query(
        `INSERT INTO grados (escuela_id, nombre, orden)
              VALUES ($1, $2, $3)
         ON CONFLICT (escuela_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre
           RETURNING id, (xmax = 0) AS es_nuevo`,
        [escuela.id, grado.nombre, posicion + 1]
      );

      const gradoId = filaGrado.rows[0].id;
      if (filaGrado.rows[0].es_nuevo) resumen.gradosNuevos += 1;

      const existentes = await cliente.query(
        'SELECT apellido, nombre FROM alumnos WHERE grado_id = $1', [gradoId]);
      const yaEstan = new Set(existentes.rows.map((a) => clave(a.apellido, a.nombre)));

      const nuevos = grado.alumnos.filter((a) => !yaEstan.has(clave(a.apellido, a.nombre)));
      const repetidos = grado.alumnos.length - nuevos.length;

      resumen.alumnosNuevos += nuevos.length;
      resumen.alumnosRepetidos += repetidos;

      console.log(
        `  ${grado.nombre.padEnd(12)} ${String(nuevos.length).padStart(3)} alumnos nuevos` +
        (repetidos > 0 ? `  (${repetidos} ya estaban)` : '') +
        (filaGrado.rows[0].es_nuevo ? '   [grado creado]' : '')
      );

      if (nuevos.length > 0) {
        // Todos los alumnos del grado en un solo INSERT, no uno por uno.
        await cliente.query(
          `INSERT INTO alumnos (grado_id, apellido, nombre)
           SELECT $1, * FROM UNNEST($2::text[], $3::text[])`,
          [gradoId, nuevos.map((a) => a.apellido), nuevos.map((a) => a.nombre)]
        );
      }
    }

    if (!aplicar) {
      // Se hizo todo el trabajo de verdad para poder contar bien, pero se
      // deshace: asi el ensayo informa exactamente lo que va a pasar.
      throw new SoloEnsayo();
    }
  }).catch((error) => {
    if (!(error instanceof SoloEnsayo)) throw error;
  });

  console.log(`\n  Grados creados:   ${resumen.gradosNuevos}`);
  console.log(`  Alumnos cargados: ${resumen.alumnosNuevos}`);
  if (resumen.alumnosRepetidos > 0) {
    console.log(`  Ya estaban:       ${resumen.alumnosRepetidos}`);
  }

  console.log(aplicar
    ? '\nListo.\n'
    : '\nNo se escribio nada. Volvé a correrlo con --aplicar para cargarlo.\n');
}

/** Error interno para cortar la transaccion del ensayo. */
class SoloEnsayo extends Error {}

/* ------------------------------------------------------------------------ */

if (require.main === module) {
  const archivo = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');

  if (!archivo) {
    console.error('Falta el archivo. Ejemplo:\n' +
      '  node db/cargar_plantel.js db/planteles/1722-la-fundicion.txt\n');
    process.exit(1);
  }

  cargar(archivo === '-' ? '-' : path.resolve(archivo), aplicar)
    .catch((error) => {
      console.error(`\nError: ${error.message}\n`);
      process.exitCode = 1;
    })
    .finally(cerrarPool);
}

module.exports = { leerPlantel, capitalizar };
