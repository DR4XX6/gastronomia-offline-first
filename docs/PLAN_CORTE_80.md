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


## Implementación de costeo v4 — 22/11/2026 (pendiente de ejecutar en navegador)
Se incorporó el módulo de configuración y cálculo en la rama de trabajo:
- `src/domain/costingSettings.ts`: datos y vista previa de costeo; prohíbe mostrar
  totales cuando falten precio, cantidad o porciones.
- `src/db/sqlite.worker.ts`: migración incremental de v3 a v4, con tres tablas
  nuevas: `ingredient_prices`, `recipe_servings`, `recipe_line_quantities`.
  No se borran ni reconstruyen tablas anteriores. Se mantienen claves foráneas.
- `src/db/database.ts`: mensajes nuevos del Worker y API tipada de costeo.
- `src/features/costing/CostingManager.tsx`: interfaz para precio de compra,
  presentación comercial, unidad y merma por ingrediente; porciones base
  y cantidad neta por asociación; merma específica opcional por receta;
  costo total y por porción en pesos mexicanos.
- `src/pages/HomePage.tsx`: incorpora la nueva sección.
- `src/domain/costingSettings.test.ts`: pruebas puras de escenarios completos,
  incompletos y errores de unidades.

### Reglas preliminares
- Cantidad bruta de compra = cantidad neta escalada / (1 - merma / 100).
- El precio se aplica con conversión g/kg o ml/l, o por pieza.
- No se convierten masa y volumen sin factor académico específico.
- La merma de receta, si existe, sustituye el valor por defecto del catálogo.
- Se muestra costo cero solo si el precio guardado es realmente cero.
- La vista previa no contabiliza empaques indivisibles ni gastos indirectos.
- No se asignan precios ni cantidades a las recetas antiguas automáticamente.

### Comprobaciones pendientes para aceptación
1. `git pull --ff-only`, `npm ci`, `npx vitest run`, `npm run build`.
   Guardar salidas. No se ha ejecutado el build desde esta sesión.
2. Lanzar `npm run preview -- --host 127.0.0.1 --port 4173` con red.
   Comprobar migración a esquema 4 en consola sin perder los registros previos.
3. Capturar un ingrediente: 1 kg de jitomate por $40, merma 20%.
   En una receta de cuatro porciones establecer 500 g netos.
   Esperado: 625 g de compra, $25 totales, $6.25 por porción.
4. Cambiar a ocho porciones: 1250 g brutos y $50 totales.
5. Activar modo Offline; editar y guardar costo, recargar y comprobar
   persistencia de precio, cantidad, merma y porciones.
6. Probar ingredient sin precio y receta anterior sin cantidad: deben
   mostrar pendientes, no costos inventados.
7. Retirar una asociación y verificar que solo su configuración de línea
   sea eliminada por cascada, sin borrar ingrediente ni su precio.
8. Registrar capturas de cada escenario. La validación institucional
   del modelo académico sigue pendiente.

**Precaución:** no utilizar Clear site data ni cambiar de origen. La migración
no constituye un respaldo; exportación y restauración siguen pendientes.

## Evidencia manual recibida — costeo v4 (22/11/2026)
- **Entorno:** Microsoft Edge, `127.0.0.1:4173`, DevTools configurado en modo **Offline** en la captura.
- **Migración:** la consola indica `Versión del esquema: 4` y `Base de datos OPFS abierta`, con SQLite 3.53.4 y marca de primera escritura conservada del 11/11/2026. Es evidencia de apertura local del esquema ampliado, no una prueba automatizada de migración desde un respaldo.
- **CRUD en la sesión:** el responsable informa que ingredientes, recetas y asociaciones continuaron operativos con y sin Internet. Se observan altas SQLite confirmadas para «Agua», «Sal» y «Aceite», con catálogo actualizado. No se atribuye a esta captura una batería automatizada.
- **Costeo visible:** la receta seleccionada presenta 1 porción, factor 1.000, costo total **$200.47 MXN** y costo por porción **$200.47 MXN**. El desglose visible contiene Harina (400 g, $24.00), Queso (4.211 piezas, $157.89), Agua (408.163 ml, $0.31), Salsa de tomate (631.579 ml, $17.37) y Aceite (20 ml, $0.90). El redondeo corresponde a la presentación; confirmar unidades comerciales, cantidades y número real de porciones con el área académica.
- **Consola:** aparece `AbortError: The play() request was interrupted by a call to pause()` y una advertencia `[Violation] 'click' handler took 843ms`. No se observa error SQLite en la captura. Investigar el origen de `play()/pause()` solo si persiste o afecta la aplicación.
- **Alcance:** la funcionalidad de costeo y su uso offline se consideran **verificados manualmente de forma preliminar** en este entorno. Falta conservar logs de `npm run build` y `npx vitest run`, verificar persistencia tras recarga offline con los mismos datos de costeo, validar escalado y fórmulas, y probar el caso de recetas incompletas.
- **Control del porcentaje:** el **80% es candidato funcional interno**, no validación institucional ni conclusión de todas las pruebas de aceptación. El PR sigue en borrador.

## Cierre del corte funcional interno del 80% — 22/11/2026

**Resultado:** 80% funcional interno sustentado con validación manual de uso offline y comprobación automatizada de integración, no equivalente a aprobación institucional ni a prueba piloto concluida.

### Evidencia automática obtenida de GitHub Actions
- Ejecución PR: https://github.com/DR4XX6/gastronomia-offline-first/actions/runs/45064665756
- Estado: `completed`, conclusión: `success`.
- Etapa `npx vitest run`: **3 archivos de pruebas y 28 pruebas aprobadas**.
- Etapa `npm run build`: compilación exitosa con TypeScript y Vite.
- Generación del Service Worker: **11 rutas en precaché** (revisión de esa compilación `49a7d853e41a`).
- Comprobación de artefactos: `index.html`, `service-worker.js`, `manifest.webmanifest` y SQLite WASM presentes.
- Ejecución adicional originada por `push`: https://github.com/DR4XX6/gastronomia-offline-first/actions/runs/45064664509 — finalizó correctamente.

### Evidencia manual de aceptación reportada
- El responsable recargó la aplicación en Edge con DevTools → Offline y verificó que las cantidades, mermas, precios y porciones previamente capturados seguían disponibles.
- El esquema local se mantuvo en v4, con seis tablas verificadas, SQLite 3.53.4 y OPFS abierto, sin errores ni advertencias de consola en la captura final.
- En la receta de pizza se registraron **5 porciones base** y se calcularon **11 deseadas**: factor 2.2, costo original mostrado de $200.47 MXN, costo escalado de $441.03 MXN, costo por porción mostrado de $40.09 MXN (cifras de interfaz, con redondeo).

### Alcance pendiente posterior al 80%
- Validación docente de criterios gastronómicos y redondeo comercial.
- PDF de fichas técnicas institucionales.
- Pruebas multiplataforma y con estudiantes; respaldo/restauración de OPFS.
- El PR continúa en borrador mientras se planifica la siguiente etapa; no mezclar a `main` sin revisión.
