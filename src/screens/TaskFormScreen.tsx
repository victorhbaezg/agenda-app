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
import type { Category, RecurrenceType, SubtaskDraft } from '../types';
import { colors } from '../theme';
import { weekdayOfDate } from '../utils/date';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

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

export default function TaskFormScreen({ route, navigation }: Props) {
  const { date, taskId, initialStartTime } = route.params;
  const db = useSQLiteContext();
  const isEditing = taskId != null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(initialStartTime ?? '09:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
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
      } else if (cats.length > 0) {
        setCategoryId(cats[0].id);
      }
    })();
  }, [db, isEditing, taskId]);

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
      Alert.alert('Falta el titulo', 'Escribe un titulo para la tarea.');
      return;
    }
    if (!isValidTime(startTime)) {
      Alert.alert('Hora invalida', 'Usa el formato HH:MM, por ejemplo 09:30.');
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
      recurrenceType,
      recurrenceDaysOfWeek: recurrenceType === 'custom' ? customDays : null,
      recurrenceEndDate: null,
    };

    let id = taskId;
    if (isEditing && taskId != null) {
      await updateTask(db, taskId, input);
    } else {
      id = await createTask(db, input);
    }
    if (id != null) {
      await replaceSubtasks(db, id, cleanSubtasks);
    }
    navigation.goBack();
  }

  async function handleDelete() {
    if (taskId == null) return;
    const message =
      recurrenceType === 'none'
        ? 'Esta accion no se puede deshacer.'
        : 'Se borrara la tarea y todas sus repeticiones.';
    Alert.alert('Borrar tarea', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(db, taskId);
          navigation.goBack();
        },
      },
    ]);
  }

  const weeklyHint = `Se repite cada ${WEEKDAY_NAMES[weekdayOfDate(isEditing ? seriesDate : date)]}.`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Titulo</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Ej. Reunion con el equipo"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Hora de inicio (HH:MM)</Text>
      <TextInput
        style={styles.input}
        value={startTime}
        onChangeText={setStartTime}
        placeholder="09:00"
        placeholderTextColor={colors.textMuted}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />

      <Text style={styles.label}>Duracion</Text>
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

      <Text style={styles.label}>Repeticion</Text>
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

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.optionsRow}>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={[
              styles.categoryChip,
              { borderColor: category.color },
              categoryId === category.id && { backgroundColor: category.color },
            ]}
            onPress={() => setCategoryId(category.id)}
          >
            <Text
              style={[
                styles.chipText,
                categoryId === category.id && styles.chipTextSelected,
              ]}
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
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
        <Text style={styles.addSubtaskText}>Anadir subtarea</Text>
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
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
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
    borderRadius: 8,
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
