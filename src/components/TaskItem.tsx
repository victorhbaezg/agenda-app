import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category, Task } from '../types';

interface Props {
  task: Task;
  category: Category | undefined;
  onToggleComplete: (task: Task) => void;
  onPress: (task: Task) => void;
}

export default function TaskItem({ task, category, onToggleComplete, onPress }: Props) {
  return (
    <Pressable style={styles.row} onPress={() => onPress(task)}>
      <Text style={styles.time}>{task.startTime}</Text>
      <View style={[styles.colorDot, { backgroundColor: category?.color ?? '#ADB5BD' }]} />
      <View style={styles.content}>
        <Text style={[styles.title, task.isCompleted && styles.titleDone]} numberOfLines={1}>
          {task.title}
        </Text>
        {category ? <Text style={styles.categoryLabel}>{category.name}</Text> : null}
      </View>
      <Pressable
        hitSlop={10}
        onPress={() => onToggleComplete(task)}
        style={styles.checkbox}
      >
        <Ionicons
          name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={task.isCompleted ? '#12B886' : '#CED4DA'}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9ECEF',
  },
  time: {
    width: 52,
    fontSize: 13,
    color: '#495057',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: '#212529',
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: '#ADB5BD',
  },
  categoryLabel: {
    fontSize: 12,
    color: '#868E96',
    marginTop: 2,
  },
  checkbox: {
    paddingLeft: 8,
  },
});
