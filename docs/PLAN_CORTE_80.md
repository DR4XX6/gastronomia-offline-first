# Corte técnico 80% — Plan de aceptación (22 de noviembre de 2026)

## Línea base y protección de datos
- **60% documentado**: CRUD persistente de ingredientes y recetas, asociaciones,
  esquema SQLite v3 y 15 pruebas Vitest (con Worker simulado).
- **70% propuesto, no verificado**: rama `feat/pwa-offline-demo-70-20261110`.
  Su evidencia describe una incidencia de pantalla blanca al recargar offline.
  No convertir este avance en formal sin repetir las pruebas del documento
  `docs/DEMO_OFFLINE_70.md`.
- **Esta rama de trabajo**: `feat/costeo-80-20261122`, derivada del avance PWA.
  No se ha modificado el esquema SQL ni el contenido persistente en OPFS.

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
2. Verificar la PWA en compilación de producción, con alta, edición, asociación,
   recarga y consulta realmente desconectadas, preservando OPFS.
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
