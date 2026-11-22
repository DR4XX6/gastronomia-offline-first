# Corte técnico 80% — Plan de aceptación (22 de noviembre de 2026)

## Línea base y protección de datos
- **60% documentado**: CRUD persistente de ingredientes y recetas, asociaciones,
  esquema SQLite v3 y 15 pruebas Vitest (con Worker simulado).
- **70% provisional validado funcionalmente (22/11/2026)**: con base en las
  tres capturas compartidas por el responsable y sus pruebas manuales,
  la PWA carga tanto con red como en modo Offline en Microsoft Edge.
  Persisten limitaciones de alcance: no se ha probado aún en otros dispositivos
  ni con una batería automatizada E2E.
- **Esta rama de trabajo**: `feat/costeo-80-20261122`, derivada del avance PWA.
  No se ha modificado el esquema SQL ni el contenido persistente en OPFS.

## Verificación de la PWA — observación manual del 22/11/2026
- **Captura con conexión**: consola sin errores ni advertencias; SQLite 3.53.4,
  tablas `ingredients`, `recipes`, `recipe_ingredients`, esquema v3 y
  OPFS inicializado. Estado: «PWA lista para uso sin internet» con revisión
  visible `e62924513176` (transcrita de captura).
- **Captura Offline**: recarga del sitio con `Network → Offline`, respuesta
  200 para documento principal, JS, CSS, manifiesto y SQLite WASM; la columna
  «Fulfilled by» muestra Service Worker en recursos esenciales. La interfaz
  sigue disponible. No aparece el error de navegación anteriormente reportado.
- **Captura de operaciones Offline**: el responsable informó que pudo
  registrar/editar ingredientes y utilizar recetas y asociaciones. Se observa
  alta de «Chile jalapeño», confirmación de inserción SQLite y recuperación
  de 5 ingredientes, sin errores de consola. Dos advertencias «[Violation]»
  por duración de controladores de clic son indicadores de rendimiento, no
  fallos funcionales comprobados.
- **Restricción de integridad comprobada**: la eliminación de ingredientes
  libres funciona; los asociados a recetas quedan protegidos deliberadamente
  por `ON DELETE RESTRICT`. No debe quitarse esa protección.
- **Naturaleza de la evidencia**: capturas recibidas en la conversación y
  declaración de pruebas del responsable; guardar copias en el expediente
  antes de la entrega. No se documentan aquí pruebas Playwright ni
  compatibilidad multiplataforma.

**Resultado del hito:** se considera sustentado el 70% de avance funcional
interno para este entorno de prueba; no implica aprobación institucional.

## Funcionalidad incorporada en esta rama
- `src/domain/costing.ts`: motor preliminar de cálculo puro, independiente de React,
  conexión y SQLite. Admite g/kg, ml/l y pieza, merma, escalado, costo total y por porción.
- `src/domain/costing.test.ts`: pruebas de conversiones, merma, escalado,
  entradas inválidas y cálculo monetario.
- La fórmula es **propuesta técnica**, no validada institucionalmente.
  La academia debe definir cantidad neta/bruta, mermas, unidades y redondeos
  antes de declarar costeos oficiales.

## Pendiente para acreditar formalmente el 80%
1. Ejecutar `npm ci`, `npx vitest run`, `npm run build` y conservar salidas.
2. Conservar las tres capturas de verificación offline de Edge en el expediente
   y repetir la prueba en el dispositivo/navegador previsto para el piloto.
3. Acordar con docentes la ficha técnica, unidades comerciales, fórmula,
   tratamiento de mermas y costeo por porción.
4. Integrar de forma segura cantidades, unidades, precios, merma y porciones
   mediante nueva migración SQL transaccional (sin reescribir v1-v3).
5. Conectar el motor a la interfaz, comprobar CRUD real en SQLite/OPFS y
   ejecutar pruebas de regresión con datos existentes.
6. Guardar capturas, resultados de pruebas, commit(s) y reporte del corte.

**Criterio de control:** no declarar 80% formal hasta completar verificaciones
técnicas y evidencia académica pertinentes. La prueba piloto con estudiantes,
respaldo/restauración y ajustes finales quedan en el alcance posterior.

**Precaución:** no usar “Clear storage”, “Clear site data”, cambiar arbitrariamente
el origen ni borrar la base OPFS durante la depuración.
