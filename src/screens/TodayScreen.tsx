import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AgendaList from '../components/AgendaList';
import WeekStrip from '../components/WeekStrip';
import { getCategories } from '../db/categoryRepository';
import { getTasksForDate, setTaskCompletedForDate } from '../db/taskRepository';
import type { Category, Task } from '../types';
import { colors } from '../theme';
import { toISODate } from '../utils/date';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

export default function TodayScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
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
    await setTaskCompletedForDate(db, task, date, !task.isCompleted);
    loadData();
  }

  function handleOpenTask(task: Task) {
    navigation.navigate('TaskForm', { date, taskId: task.id });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <WeekStrip selectedDate={date} onSelectDate={setDate} />

      {/* Tarjeta gris redondeada con la lista de tareas del dia */}
      <View style={styles.sheet}>
        <AgendaList
          tasks={tasks}
          categoryById={categoryById}
          onPressTask={handleOpenTask}
          onToggleComplete={handleToggleComplete}
        />
      </View>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.navigate('TaskForm', { date, taskId: undefined })}
      >
        <Ionicons name="add" size={30} color={colors.fabIcon} />
      </Pressable>

      <Pressable
        style={[styles.categoriesLink, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.navigate('Categories')}
      >
        <Ionicons name="pricetags-outline" size={22} color={colors.textSecondary} />
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
});
