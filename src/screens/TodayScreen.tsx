import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import TaskItem from '../components/TaskItem';
import { getCategories } from '../db/categoryRepository';
import { getTasksForDate, setTaskCompleted } from '../db/taskRepository';
import type { Category, Task } from '../types';
import { addDays, formatDisplayDate, isToday, toISODate } from '../utils/date';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

export default function TodayScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadData = useCallback(async () => {
    const [taskRows, categoryRows] = await Promise.all([
      getTasksForDate(db, date),
      getCategories(db),
    ]);
    setTasks(taskRows);
    setCategories(categoryRows);
  }, [db, date]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  async function handleToggleComplete(task: Task) {
    await setTaskCompleted(db, task.id, !task.isCompleted);
    loadData();
  }

  function handleOpenTask(task: Task) {
    navigation.navigate('TaskForm', { date, taskId: task.id });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#212529" />
        </Pressable>
        <Pressable onPress={() => setDate(toISODate(new Date()))} style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{formatDisplayDate(date)}</Text>
          {isToday(date) ? <Text style={styles.todayBadge}>Hoy</Text> : null}
        </Pressable>
        <Pressable onPress={() => setDate((d) => addDays(d, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={24} color="#212529" />
        </Pressable>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            category={categoryById.get(item.categoryId ?? -1)}
            onToggleComplete={handleToggleComplete}
            onPress={handleOpenTask}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay tareas para este dia.</Text>
          </View>
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('TaskForm', { date, taskId: undefined })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <Pressable
        style={styles.categoriesLink}
        onPress={() => navigation.navigate('Categories')}
      >
        <Ionicons name="pricetags-outline" size={22} color="#495057" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateLabelWrap: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    textTransform: 'capitalize',
  },
  todayBadge: {
    fontSize: 11,
    color: '#4C6EF5',
    marginTop: 2,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#ADB5BD',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4C6EF5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  categoriesLink: {
    position: 'absolute',
    left: 20,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
