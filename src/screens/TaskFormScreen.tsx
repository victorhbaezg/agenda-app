import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getCategories } from '../db/categoryRepository';
import {
  createTask,
  deleteTask,
  getSubtasks,
  getTaskById,
  replaceSubtasks,
  updateTask,
} from '../db/taskRepository';
import { archiveNote } from '../db/noteRepository';
import { ensurePermissions, resyncReminders } from '../services/reminders';
import type { Category, RecurrenceType, SubtaskDraft } from '../types';
import TimePickerModal from '../components/TimePickerModal';
import { colors } from '../theme';
import { minutesToTime, timeToMinutes, weekdayOfDate } from '../utils/date';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

// Opciones de recordatorio: null = sin aviso, 0 = a la hora exacta,
// N = minutos de antelacion.
const REMINDER_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Sin aviso' },
  { value: 0, label: 'En punto' },
  { value: 5, label: '5 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 h antes' },
];

const RECURRENCE_OPTIONS: Array<{ value: RecurrenceType; label: string }> = [
  { value: 'none', label: 'Nunca' },
  { value: 'daily', label: 'Diaria' },
  { value: 'weekdays', label: 'Laborables' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'custom', label: 'Personalizada' },
];

// Dias para el selector personalizado, empezando en lunes (valor = getDay()).
const CUSTOM_DAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// "45 min", "1 h", "1 h 30 min"...
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default function TaskFormScreen({ route, navigation }: Props) {
  const { date, taskId, initialStartTime, initialTitle, initialNotes, initialCategoryId, noteId } =
    route.params;
  const db = useSQLiteContext();
  const isEditing = taskId != null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(initialTitle ?? '');
  const [startTime, setStartTime] = useState(initialStartTime ?? '09:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);
  // La fecha de la serie: al editar una recurrente conserva su fecha de inicio.
  const [seriesDate, setSeriesDate] = useState(date);

  useEffect(() => {
    (async () => {
      const cats = await getCategories(db);
      setCategories(cats);
      if (isEditing && taskId != null) {
        const task = await getTaskById(db, taskId);
        if (task) {
          setTitle(task.title);
          setStartTime(task.startTime);
          setDurationMinutes(task.durationMinutes);
          setCategoryId(task.categoryId);
          setNotes(task.notes ?? '');
          setReminderMinutes(task.reminderMinutesBefore);
          setRecurrenceType(task.recurrenceType);
          setSeriesDate(task.date);
          if (task.recurrenceDaysOfWeek) {
            try {
              setCustomDays(JSON.parse(task.recurrenceDaysOfWeek));
            } catch {
              setCustomDays([]);
            }
          }
          setSubtasks(
            (await getSubtasks(db, taskId)).map((s) => ({ title: s.title, isDone: s.isDone }))
          );
        }
      } else if (initialCategoryId != null && cats.some((c) => c.id === initialCategoryId)) {
        // Viene de "planificar" una nota: conserva su categoria.
        setCategoryId(initialCategoryId);
      } else if (cats.length > 0) {
        setCategoryId(cats[0].id);
      }
    })();
  }, [db, isEditing, taskId, initialCategoryId]);

  function isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
  }

  function toggleCustomDay(day: number) {
    setCustomDays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    );
  }

  async function handleSave() {
    if (title.trim().length === 0) {
      Alert.alert('Falta el título', 'Escribe un título para la tarea.');
      return;
    }
    if (!isValidTime(startTime)) {
      Alert.alert('Hora inválida', 'Usa el formato HH:MM, por ejemplo 09:30.');
      return;
    }
    if (recurrenceType === 'custom' && customDays.length === 0) {
      Alert.alert('Faltan dias', 'Elige al menos un dia de la semana para la repeticion.');
      return;
    }

    const cleanSubtasks = subtasks
      .map((s) => ({ ...s, title: s.title.trim() }))
      .filter((s) => s.title.length > 0);

    const input = {
      title: title.trim(),
      date: recurrenceType === 'none' ? date : seriesDate,
      startTime,
      durationMinutes,
      categoryId,
      notes: notes.trim().length > 0 ? notes.trim() : null,
      reminderMinutesBefore: reminderMinutes,
      recurrenceType,
      recurrenceDaysOfWeek: recurrenceType === 'custom' ? customDays : null,
      recurrenceEndDate: null,
    };

    // Si la tarea lleva aviso, pedimos permiso de notificaciones aqui
    // (primer momento en que de verdad hace falta).
    if (reminderMinutes != null) {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(
          'Notificaciones desactivadas',
          'La tarea se guardará, pero el aviso no sonará hasta que permitas las notificaciones en los ajustes del teléfono.'
        );
      }
    }

    let id = taskId;
    if (isEditing && taskId != null) {
      await updateTask(db, taskId, input);
    } else {
      id = await createTask(db, input);
    }
    if (id != null) {
      await replaceSubtasks(db, id, cleanSubtasks);
    }
    // Si la tarea nace de una nota, la nota ya cumplió su función: se archiva.
    if (!isEditing && noteId != null) {
      await archiveNote(db, noteId);
    }
    await resyncReminders(db);
    navigation.goBack();
  }

  async function handleDelete() {
    if (taskId == null) return;
    const message =
      recurrenceType === 'none'
        ? 'Esta acción no se puede deshacer.'
        : 'Se borrará la tarea y todas sus repeticiones.';
    Alert.alert('Borrar tarea', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(db, taskId);
          await resyncReminders(db);
          navigation.goBack();
        },
      },
    ]);
  }

  const weeklyHint = `Se repite cada ${WEEKDAY_NAMES[weekdayOfDate(isEditing ? seriesDate : date)]}.`;

  // Hora de fin derivada del inicio + duracion. Si cambias la hora de
  // inicio, la duracion se mantiene y el fin se desplaza con ella.
  const endTime = minutesToTime(timeToMinutes(startTime) + durationMinutes);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Barrita de agarre + titulo (la hoja inferior no tiene cabecera nativa) */}
      <View style={styles.grabber} />
      <Text style={styles.formTitle}>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</Text>

      <Text style={styles.label}>Título</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Ej. Reunión con el equipo"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Horario</Text>
      <View style={styles.timeFieldsRow}>
        <Pressable style={styles.timeField} onPress={() => setTimePickerVisible(true)}>
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.timeFieldText}>{startTime}</Text>
        </Pressable>
        <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
        <Pressable style={styles.timeField} onPress={() => setEndPickerVisible(true)}>
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.timeFieldText}>{endTime}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Duración: {formatDuration(durationMinutes)}</Text>
      <TimePickerModal
        visible={timePickerVisible}
        title="Hora de inicio"
        initialTime={startTime}
        onCancel={() => setTimePickerVisible(false)}
        onConfirm={(time) => {
          setStartTime(time);
          setTimePickerVisible(false);
        }}
      />
      <TimePickerModal
        visible={endPickerVisible}
        title="Hora de fin"
        initialTime={endTime}
        onCancel={() => setEndPickerVisible(false)}
        onConfirm={(time) => {
          setEndPickerVisible(false);
          const minutes = timeToMinutes(time) - timeToMinutes(startTime);
          if (minutes <= 0) {
            Alert.alert(
              'Hora de fin inválida',
              'La hora de fin debe ser posterior a la de inicio.'
            );
            return;
          }
          setDurationMinutes(minutes);
        }}
      />

      <Text style={styles.label}>Duración rápida</Text>
      <View style={styles.optionsRow}>
        {DURATION_OPTIONS.map((minutes) => (
          <Pressable
            key={minutes}
            style={[styles.chip, durationMinutes === minutes && styles.chipSelected]}
            onPress={() => setDurationMinutes(minutes)}
          >
            <Text style={[styles.chipText, durationMinutes === minutes && styles.chipTextSelected]}>
              {minutes} min
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Recordatorio</Text>
      <View style={styles.optionsRow}>
        {REMINDER_OPTIONS.map((option) => {
          const selected = reminderMinutes === option.value;
          return (
            <Pressable
              key={option.label}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setReminderMinutes(option.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Repetición</Text>
      <View style={styles.optionsRow}>
        {RECURRENCE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.chip, recurrenceType === option.value && styles.chipSelected]}
            onPress={() => setRecurrenceType(option.value)}
          >
            <Text
              style={[
                styles.chipText,
                recurrenceType === option.value && styles.chipTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {recurrenceType === 'weekly' ? <Text style={styles.hint}>{weeklyHint}</Text> : null}
      {recurrenceType === 'custom' ? (
        <View style={styles.daysRow}>
          {CUSTOM_DAYS.map((day) => (
            <Pressable
              key={day.value}
              style={[styles.dayChip, customDays.includes(day.value) && styles.chipSelected]}
              onPress={() => toggleCustomDay(day.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  customDays.includes(day.value) && styles.chipTextSelected,
                ]}
              >
                {day.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.optionsRow}>
        {categories.map((category) => {
          const selected = categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              style={[
                styles.categoryChip,
                { borderColor: category.color },
                selected && { backgroundColor: category.color },
              ]}
              onPress={() => setCategoryId(category.id)}
            >
              <Ionicons
                name={(category.icon ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap}
                size={14}
                color={selected ? '#fff' : category.color}
              />
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Subtareas</Text>
      {subtasks.map((subtask, index) => (
        <View key={index} style={styles.subtaskRow}>
          <Pressable
            hitSlop={8}
            onPress={() =>
              setSubtasks((list) =>
                list.map((s, i) => (i === index ? { ...s, isDone: !s.isDone } : s))
              )
            }
          >
            <Ionicons
              name={subtask.isDone ? 'checkbox' : 'square-outline'}
              size={22}
              color={subtask.isDone ? colors.success : colors.textMuted}
            />
          </Pressable>
          <TextInput
            style={[styles.input, styles.subtaskInput, subtask.isDone && styles.subtaskDone]}
            value={subtask.title}
            onChangeText={(text) =>
              setSubtasks((list) =>
                list.map((s, i) => (i === index ? { ...s, title: text } : s))
              )
            }
            placeholder={`Subtarea ${index + 1}`}
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            hitSlop={8}
            onPress={() => setSubtasks((list) => list.filter((_, i) => i !== index))}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      <Pressable
        style={styles.addSubtaskButton}
        onPress={() => setSubtasks((list) => [...list, { title: '', isDone: false }])}
      >
        <Ionicons name="add" size={18} color={colors.accent} />
        <Text style={styles.addSubtaskText}>Añadir subtarea</Text>
      </Pressable>

      <Text style={styles.label}>Notas</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Opcional"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Guardar</Text>
      </Pressable>

      {isEditing ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Borrar tarea</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sheet,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginTop: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 14,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.textPrimary,
  },
  timeFieldsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 120,
  },
  timeFieldText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  subtaskInput: {
    flex: 1,
    paddingVertical: 8,
  },
  subtaskDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  addSubtaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  addSubtaskText: {
    color: colors.accent,
    fontSize: 14,
  },
  saveButton: {
    marginTop: 28,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 15,
  },
});
