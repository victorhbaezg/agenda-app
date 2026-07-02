# Agenda App (Fase 1)

App de agenda personal tipo Structured. Construida con Expo + React Native + TypeScript, con los datos guardados solo en el dispositivo (SQLite, sin cuenta ni nube).

Usa **Expo SDK 54**, la version que corre la app "Expo Go" descargada desde la Play Store / App Store (Expo suele tardar en aprobar las versiones mas nuevas de Expo Go en las tiendas, asi que el proyecto se fija a la version que si esta disponible).

## Que incluye esta fase

- Vista "Hoy" con lista de tareas por hora y navegacion entre dias (flechas + volver a hoy).
- Crear, editar y borrar tareas (titulo, hora, duracion, categoria, notas).
- Marcar tareas como completadas.
- Pantalla de categorias (crear y borrar, con color).

Recurrencia, notificaciones, calendario del sistema y estadisticas llegan en las siguientes fases (ver `plan-app-agenda.md`).

## Como correrla en tu telefono

1. Instala Node.js (version 18 o superior) si no lo tienes.
2. Instala la app "Expo Go" en tu iPhone/Android desde la App Store / Play Store.
3. Abre una terminal en esta carpeta y ejecuta:

   ```
   npm install
   npx expo start
   ```

4. Escanea el codigo QR que aparece en la terminal con la camara (iPhone) o con la app Expo Go (Android).

La primera vez que abras la app se crean automaticamente 4 categorias de ejemplo (Trabajo, Personal, Salud, Estudio).

### Si ves "Project is incompatible with this version of Expo Go"

Significa que el proyecto usa un SDK de Expo mas nuevo que el que soporta la app Expo Go de la tienda (las tiendas suelen ir uno o dos SDKs por detras del ultimo lanzamiento). Este proyecto ya esta fijado en SDK 54, que es la version disponible en las tiendas al momento de escribir esto. Si el error vuelve a aparecer mas adelante (porque Expo Go se actualizo a un SDK mas nuevo y dejo de soportar el 54), la solucion es actualizar las dependencias del proyecto al SDK que indique la app Expo Go instalada.

## Estructura del proyecto

```
App.tsx                  Punto de entrada, inicializa la base de datos y la navegacion
src/types.ts             Tipos de datos (Task, Category)
src/db/database.ts       Creacion de tablas SQLite
src/db/taskRepository.ts CRUD de tareas
src/db/categoryRepository.ts CRUD de categorias
src/navigation/          Configuracion de pantallas
src/screens/             Pantallas: Hoy, Nueva/Editar tarea, Categorias
src/components/          Componentes reutilizables (TaskItem)
src/utils/date.ts        Utilidades de fecha
```
