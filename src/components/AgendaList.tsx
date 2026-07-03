// Lista de tareas estilo Structured: cada tarea es una fila con una burbuja
// de icono (color de la categoria) unida a la siguiente por una linea
// vertical. La linea es continua entre tareas seguidas y discontinua cuando
// hay un hueco de tiempo entre una y otra.

import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category, Task } from '../types';
import { colors } from '../theme';
import { timeToMinutes } from '../utils/date';

// Hueco (en minutos) a partir del cual la linea se dibuja discontinua.
const GAP_THRESHOLD_MINUTES = 30;

interface Props {
  tasks: Task[];
  categoryById: Map<number, Category>;
  onPressTask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}

// La linea entre dos filas se parte en dos mitades (inferior de una fila y
// superior de la siguiente); ambas usan el mismo estilo segun el hueco.
type ConnectorStyle = 'none' | 'solid' | 'dashed';

interface RowInfo {
  task: Task;
  topConnector: ConnectorStyle;
  bottomConnector: ConnectorStyle;
}

function buildRows(tasks: Task[]): RowInfo[] {
  const sorted = [...tasks].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  return sorted.map((task, i) => {
    let topConnector: ConnectorStyle = 'none';
    let bottomConnector: ConnectorStyle = 'none';
    if (i > 0) {
      const prev = sorted[i - 1];
      const gap =
        timeToMinutes(task.startTime) -
        (timeToMinutes(prev.startTime) + prev.durationMinutes);
      topConnector = gap > GAP_THRESHOLD_MINUTES ? 'dashed' : 'solid';
    }
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      const gap =
        timeToMinutes(next.startTime) -
        (timeToMinutes(task.startTime) + task.durationMinutes);
      bottomConnector = gap > GAP_THRESHOLD_MINUTES ? 'dashed' : 'solid';
    }
    return { task, topConnector, bottomConnector };
  });
}

// Linea vertical del conector. La discontinua se dibuja con el truco del
// borde (ancho 0 + borderWidth), que funciona bien en Android e iOS.
function Connector({ style }: { style: ConnectorStyle }) {
  if (style === 'none') return <View style={styles.connectorSpace} />;
  if (style === 'solid') {
    return (
      <View style={styles.connectorSpace}>
        <View style={styles.connectorSolid} />
      </View>
    );
  }
  return (
    <View style={styles.connectorSpace}>
      <View style={styles.connectorDashed} />
    </View>
  );
}

export default function AgendaList({
  tasks,
  categoryById,
  onPressTask,
  onToggleComplete,
}: Props) {
  const rows = buildRows(tasks);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => String(row.task.id)}
      contentContainerStyle={styles.listContent}
      renderItem={({ item: { task, topConnector, bottomConnector } }) => {
        const category = categoryById.get(task.categoryId ?? -1);
        const color = category?.color ?? colors.accent;
        const icon = (category?.icon ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap;
        return (
          <Pressable style={styles.row} onPress={() => onPressTask(task)}>
            {/* Columna izquierda: linea + burbuja + linea */}
            <View style={styles.iconColumn}>
              <Connector style={topConnector} />
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: task.isCompleted ? colors.card : color },
                ]}
              >
                <Ionicons
                  name={task.isCompleted ? 'checkmark' : icon}
                  size={24}
                  color={task.isCompleted ? colors.success : '#FFFFFF'}
                />
              </View>
              <Connector style={bottomConnector} />
            </View>

            {/* Contenido central */}
            <View style={styles.content}>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>
                  {task.startTime} · {task.durationMinutes} min
                </Text>
                {task.recurrenceType !== 'none' ? (
                  <Ionicons name="repeat" size={14} color={colors.textSecondary} />
                ) : null}
              </View>
              <Text
                style={[styles.title, task.isCompleted && styles.titleDone]}
                numberOfLines={2}
              >
                {task.title}
              </Text>
              <View style={styles.metaRow}>
                {task.subtaskTotal > 0 ? (
                  <View style={styles.subtaskBadge}>
                    <Ionicons name="checkbox-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.subtaskBadgeText}>
                      {task.subtaskDone}/{task.subtaskTotal}
                    </Text>
                  </View>
                ) : null}
                {task.notes ? (
                  <Ionicons name="reorder-two-outline" size={16} color={colors.textMuted} />
                ) : null}
              </View>
            </View>

            {/* Check de completado */}
            <Pressable
              hitSlop={12}
              onPress={() => onToggleComplete(task)}
              style={styles.checkButton}
            >
              <Ionicons
                name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                size={28}
                color={task.isCompleted ? colors.success : color}
              />
            </Pressable>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No hay tareas para este día.</Text>
          <Text style={styles.emptyHint}>Toca + para añadir la primera.</Text>
        </View>
      }
    />
  );
}

const BUBBLE_SIZE = 52;

const styles = StyleSheet.create({
  listContent: {
    paddingTop: 20,
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  iconColumn: {
    width: BUBBLE_SIZE + 8,
    alignItems: 'center',
  },
  iconBubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorSpace: {
    flex: 1,
    minHeight: 14,
    alignItems: 'center',
  },
  connectorSolid: {
    flex: 1,
    width: 2.5,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  connectorDashed: {
    flex: 1,
    width: 0,
    borderWidth: 1.25,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  timeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  subtaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subtaskBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  notesIcon: {
    marginTop: 4,
  },
  checkButton: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
