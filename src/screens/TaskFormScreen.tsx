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
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getCategories } from '../db/categoryRepository';
import {
  createTask,
  deleteTask,
  getTaskById,
  updateTask,
} from '../db/taskRepository';
import type { Category } from '../types';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function TaskFormScreen({ route, navigation }: Props) {
  const { date, taskId } = route.params;
  const db = useSQLiteContext();
  const isEditing = taskId != null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

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
        }
      } else if (cats.length > 0) {
        setCategoryId(cats[0].id);
      }
    })();
  }, [db, isEditing, taskId]);

  function isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
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

    const input = {
      title: title.trim(),
      date,
      startTime,
      durationMinutes,
      categoryId,
      notes: notes.trim().length > 0 ? notes.trim() : null,
    };

    if (isEditing && taskId != null) {
      await updateTask(db, taskId, input);
    } else {
      await createTask(db, input);
    }
    navigation.goBack();
  }

  async function handleDelete() {
    if (taskId == null) return;
    Alert.alert('Borrar tarea', 'Esta accion no se puede deshacer.', [
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Titulo</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Ej. Reunion con el equipo"
        placeholderTextColor="#ADB5BD"
      />

      <Text style={styles.label}>Hora de inicio (HH:MM)</Text>
      <TextInput
        style={styles.input}
        value={startTime}
        onChangeText={setStartTime}
        placeholder="09:00"
        placeholderTextColor="#ADB5BD"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />

      <Text style={styles.label}>Duracion</Text>
      <View style={styles.optionsRow}>
        {DURATION_OPTIONS.map((minutes) => (
          <Pressable
            key={minutes}
            style={[
              styles.durationChip,
              durationMinutes === minutes && styles.durationChipSelected,
            ]}
            onPress={() => setDurationMinutes(minutes)}
          >
            <Text
              style={[
                styles.durationChipText,
                durationMinutes === minutes && styles.durationChipTextSelected,
              ]}
            >
              {minutes} min
            </Text>
          </Pressable>
        ))}
      </View>

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
                styles.categoryChipText,
                categoryId === category.id && styles.categoryChipTextSelected,
              ]}
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Notas</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Opcional"
        placeholderTextColor="#ADB5BD"
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
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    color: '#495057',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#212529',
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
  durationChip: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationChipSelected: {
    backgroundColor: '#4C6EF5',
    borderColor: '#4C6EF5',
  },
  durationChipText: {
    color: '#495057',
    fontSize: 13,
  },
  durationChipTextSelected: {
    color: '#fff',
  },
  categoryChip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipText: {
    color: '#495057',
    fontSize: 13,
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 28,
    backgroundColor: '#4C6EF5',
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
    color: '#FA5252',
    fontSize: 15,
  },
});
