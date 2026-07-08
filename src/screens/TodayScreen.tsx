import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AgendaList from '../components/AgendaList';
import WeekStrip from '../components/WeekStrip';
import { getCategories } from '../db/categoryRepository';
import { countActiveNotes } from '../db/noteRepository';
import { deleteTask, getTasksForDate, setTaskCompletedForDate } from '../db/taskRepository';
import { getRemindersEnabled, setRemindersEnabled } from '../db/settingsRepository';
import { ensurePermissions, resyncReminders } from '../services/reminders';
import type { Category, Task } from '../types';
import { colors } from '../theme';
import { toISODate } from '../utils/date';
import type { RootStackParamList } from '../navigation/RootNavigator';

// En Android hay que activar LayoutAnimation manualmente (en iOS ya viene
// activado). Anima suavemente los cambios de la lista (borrar, completar...).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

export default function TodayScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Notas sin planear: se muestra como badge en el boton de Notas.
  const [noteCount, setNoteCount] = useState(0);
  // Interruptor global de recordatorios (campana de abajo a la izquierda).
  const [remindersOn, setRemindersOn] = useState(true);

  // Opacidad de la lista: al cambiar de dia hace un pequeno fundido.
  const listOpacity = useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async () => {
    const [taskRows, categoryRows, notesTotal, remindersEnabled] = await Promise.all([
      getTasksForDate(db, date),
      getCategories(db),
      countActiveNotes(db),
      getRemindersEnabled(db),
    ]);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(taskRows);
    setCategories(categoryRows);
    setNoteCount(notesTotal);
    setRemindersOn(remindersEnabled);
  }, [db, date]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Fundido de entrada cada vez que cambia el dia seleccionado.
  useEffect(() => {
    listOpacity.setValue(0.3);
    Animated.timing(listOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [date, listOpacity]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  async function handleToggleComplete(task: Task) {
    await setTaskCompletedForDate(db, task, date, !task.isCompleted);
    loadData();
    // Al completar se cancela su aviso pendiente (y al desmarcar, vuelve).
    resyncReminders(db);
  }

  // Campana: enciende/apaga TODOS los recordatorios de golpe.
  async function handleToggleReminders() {
    const next = !remindersOn;
    if (next) {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(
          'Notificaciones desactivadas',
          'Permite las notificaciones en los ajustes del teléfono para que suenen los avisos.'
        );
      }
    }
    setRemindersOn(next);
    await setRemindersEnabled(db, next);
    await resyncReminders(db);
  }

  function handleDeleteTask(task: Task) {
    const message =
      task.recurrenceType === 'none'
        ? 'Esta acción no se puede deshacer.'
        : 'Se borrará la tarea y todas sus repeticiones.';
    Alert.alert(`Borrar "${task.title}"`, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(db, task.id);
          loadData();
          resyncReminders(db);
        },
      },
    ]);
  }

  function handleOpenTask(task: Task) {
    navigation.navigate('TaskForm', { date, taskId: task.id });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <WeekStrip selectedDate={date} onSelectDate={setDate} />

      {/* Tarjeta gris redondeada con la lista de tareas del dia */}
      <View style={styles.sheet}>
        <Animated.View style={{ flex: 1, opacity: listOpacity }}>
          <AgendaList
            tasks={tasks}
            categoryById={categoryById}
            onPressTask={handleOpenTask}
            onToggleComplete={handleToggleComplete}
            onDeleteTask={handleDeleteTask}
          />
        </Animated.View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 24 },
          pressed && styles.fabPressed,
        ]}
        onPress={() => navigation.navigate('TaskForm', { date, taskId: undefined })}
      >
        <Ionicons name="add" size={30} color={colors.fabIcon} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.categoriesLink,
          { bottom: insets.bottom + 24 },
          pressed && styles.fabPressed,
        ]}
        onPress={() => navigation.navigate('Categories')}
      >
        <Ionicons name="pricetags-outline" size={22} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.notesLink,
          { bottom: insets.bottom + 24 },
          pressed && styles.fabPressed,
        ]}
        onPress={() => navigation.navigate('Notes')}
      >
        <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
        {noteCount > 0 ? (
          <View style={styles.notesBadge}>
            <Text style={styles.notesBadgeText}>{noteCount > 99 ? '99+' : noteCount}</Text>
          </View>
        ) : null}
      </Pressable>

      {/* Campana: interruptor global de recordatorios */}
      <Pressable
        style={({ pressed }) => [
          styles.remindersLink,
          { bottom: insets.bottom + 24 },
          pressed && styles.fabPressed,
        ]}
        onPress={handleToggleReminders}
      >
        <Ionicons
          name={remindersOn ? 'notifications-outline' : 'notifications-off-outline'}
          size={22}
          color={remindersOn ? colors.textSecondary : colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.fabBackground,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85,
  },
  categoriesLink: {
    position: 'absolute',
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesLink: {
    position: 'absolute',
    left: 76,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindersLink: {
    position: 'absolute',
    left: 132,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
