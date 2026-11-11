# Demostración del avance Offline-First — 70% propuesto

**Corte de trabajo:** 10 de noviembre de 2026. **Estado:** funcionalidad incorporada en una rama; pendiente de validación en el navegador del responsable.

## Qué se agregó
- Generación automática de un Service Worker de precaché durante `npm run build`, con lista de recursos de producción (JS, CSS, WASM y archivos públicos).
- Caché versionada por contenido para actualizar los archivos de la aplicación.
- Registro del Service Worker en producción y visualización del estado de conexión y preparación.
- Manifiesto web preliminar para PWA.
- Sin modificaciones al esquema SQLite versión 3 ni a las tablas de recetas e ingredientes.

## Pasos para verificar en Windows (PowerShell)
1. Descarga o cambia a la rama `feat/pwa-offline-demo-70-20261110`. Conserva una copia de seguridad de cualquier trabajo local sin confirmar antes de cambiar de rama.
2. En la raíz del proyecto ejecuta `npm ci`, luego `npm run build`. Debe aparecer “Service Worker generado” y la ruta `dist/service-worker.js`.
3. Ejecuta `npm run preview -- --host 127.0.0.1 --port 4173` y abre exactamente `http://127.0.0.1:4173/`.
4. Con conexión, espera a que aparezca “PWA lista para uso sin internet”. Registra ingredientes y una receta, y relaciónalos. Recarga para comprobar persistencia.
5. En DevTools (F12), pestaña **Application → Service Workers**, confirma que hay un Service Worker activo y que **Bypass for network** está desmarcado. Abre **Network → Offline**.
6. **Con la simulación offline activa**, recarga la misma URL. Comprueba que aparecen los ingredientes y recetas guardados y realiza una **alta, una edición y una asociación**.
7. Recarga nuevamente **sin conexión** y verifica que permanecen los cambios. Regresa a Network → No throttling al terminar.
8. Conserva capturas con la pestaña Network mostrando Offline, interfaz y datos guardados, Application → Cache Storage, y resultado de `npm run build`.

**Criterio de aceptación:** los pasos 2, 4, 6 y 7 son satisfactorios. Si no se cumplen, el avance offline aún no está verificado y no debe afirmarse que se completó.

**Precauciones:** `npm run dev` es un servidor de desarrollo y no prueba esta integración. Usa producción/preview en el mismo origen y puerto durante toda la demostración. Una base de datos en localhost:5173 no aparece automáticamente en localhost:4173: OPFS está aislado por origen. No borres los datos del sitio ni caches de un perfil que contenga información valiosa. La caché de archivos no es una copia de seguridad de SQLite. Una prueba en un navegador no demuestra compatibilidad universal.

## Cómo describirlo en el reporte, una vez probado
“Se incorporó una capa PWA con Service Worker para guardar los recursos de la aplicación, incluyendo sus módulos JavaScript y SQLite WebAssembly. En la prueba de la compilación de producción, la interfaz abrió después de desconectar la red y las operaciones de ingredientes y recetas continuaron usando la base SQLite/OPFS local. Se conservaron evidencias de recarga, consulta y modificación sin red. Se mantiene pendiente la validación académica de cálculos, exportación PDF, respaldos, pruebas de otros dispositivos y piloto con estudiantes”.

El porcentaje 70% es una **estimación interna** condicionada a la evidencia de funcionamiento; no representa aprobación institucional ni el 70% de una lista de módulos.

## Recuperación ante pantalla blanca y JS/CSS no disponibles sin red
Si Network indica que `index.html` fue servido por el Service Worker pero `assets/index-*.js` o `assets/index-*.css` fallan:
1. Vuelve a **No throttling** y detén el preview con Ctrl+C.
2. En la rama `feat/pwa-offline-demo-70-20261110`, ejecuta `git pull --ff-only` y `npm run build`.
3. En Edge DevTools → Application → Service Workers, pulsa **Unregister** para el Service Worker de `http://127.0.0.1:4173/`. En Application → Cache Storage elimina únicamente los cachés llamados `gestor-gastronomico-offline-*`.
4. **Nunca pulses «Clear site data» ni «Clear storage»: eso también puede borrar SQLite/OPFS.**
5. Vuelve a ejecutar `npm run preview -- --host 127.0.0.1 --port 4173`, abre la URL exacta y, con conexión, recarga una vez. Espera el mensaje **PWA lista para uso sin internet**, ahora condicionado a la verificación del precaché.
6. Cambia Network → Offline y recarga. Prueba las operaciones y su persistencia.
7. Si persiste la pantalla blanca, inspecciona Application → Cache Storage y compara las rutas JS/CSS con las solicitadas por Network antes de borrar nada adicional.

La lógica del Service Worker conserva una caché anterior y busca recursos entre las cachés disponibles, para reducir fallos por versiones de activos diferentes.
