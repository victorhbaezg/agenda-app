import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getTasksForDate } from '../db/taskRepository';
import { getRemindersEnabled } from '../db/settingsRepository';
import { addDays, toISODate } from '../utils/date';

// Estrategia: en vez de usar triggers repetitivos del sistema (que no
// respetan fecha de fin ni completados por dia), cada vez que algo cambia
// se cancelan TODAS las notificaciones programadas y se reprograman las
// ocurrencias de los proximos dias. Se llama al abrir la app y tras
// crear/editar/borrar/completar tareas. Igual que hacen apps tipo
// Structured: mientras abras la app de vez en cuando, siempre hay
// recordatorios programados por delante.

const DAYS_AHEAD = 7;
// iOS solo permite 64 notificaciones programadas; nos quedamos por debajo.
const MAX_SCHEDULED = 60;

// Como debe comportarse una notificacion que llega con la app abierta.
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Canal de Android (obligatorio en Android 8+). Idempotente.
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Recordatorios de tareas',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

// Pide permiso de notificaciones si aun no esta concedido.
export async function ensurePermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Fecha+hora local de una ocurrencia, restando los minutos de antelacion.
function reminderDateTime(isoDate: string, time: string, minutesBefore: number): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes - minutesBefore, 0, 0);
}

function reminderBody(startTime: string, minutesBefore: number): string {
  if (minutesBefore === 0) return `Empieza ahora (${startTime})`;
  if (minutesBefore < 60) return `Empieza en ${minutesBefore} min (${startTime})`;
  return `Empieza en 1 h (${startTime})`;
}

// Reprograma todos los recordatorios pendientes a partir del estado actual
// de la base de datos. Seguro de llamar en cualquier momento.
export async function resyncReminders(db: SQLiteDatabase): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!(await getRemindersEnabled(db))) return;

    await ensureAndroidChannel();

    const now = new Date();
    const today = toISODate(now);
    let scheduled = 0;

    for (let offset = 0; offset < DAYS_AHEAD && scheduled < MAX_SCHEDULED; offset++) {
      const date = addDays(today, offset);
      const tasks = await getTasksForDate(db, date);

      for (const task of tasks) {
        if (task.reminderMinutesBefore == null || task.isCompleted) continue;

        const fireAt = reminderDateTime(date, task.startTime, task.reminderMinutesBefore);
        if (fireAt.getTime() <= now.getTime()) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: task.title,
            body: reminderBody(task.startTime, task.reminderMinutesBefore),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            channelId: 'reminders',
          },
        });

        scheduled++;
        if (scheduled >= MAX_SCHEDULED) break;
      }
    }
  } catch (error) {
    // Si algo falla (p. ej. permisos revocados) la app debe seguir usable.
    console.warn('No se pudieron reprogramar los recordatorios:', error);
  }
}
