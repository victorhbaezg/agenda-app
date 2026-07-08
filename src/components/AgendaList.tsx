// Lista de tareas estilo Structured: cada tarea es una fila con una burbuja
// de icono (color de la categoria) unida a la siguiente por una linea
// vertical. La linea es continua entre tareas seguidas y discontinua cuando
// hay un hueco de tiempo entre una y otra.
//
// Gestos: deslizar una fila a la derecha la completa (o la des-completa) y
// deslizarla a la izquierda la borra. La burbuja hace una pequena animacion
// de rebote al cambiar de estado.

import { useEffect, useRef } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category, Task } from '../types';
import { colors } from '../theme';
import { timeToMinutes } from '../utils/date';

// Hueco (en minutos) a partir del cual la linea se dibuja discontinua.
const GAP_THRESHOLD_MINUTES = 30;

// Distancia (px) que hay que deslizar para disparar la accion.
const SWIPE_THRESHOLD = 90;

interface Props {
  tasks: Task[];
  categoryById: Map<number, Category>;
  onPressTask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
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

interface RowProps {
  info: RowInfo;
  category: Category | undefined;
  onPress: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function Row({ info, category, onPress, onToggle, onDelete }: RowProps) {
  const { task, topConnector, bottomConnector } = info;
  const color = category?.color ?? colors.accent;
  const icon = (category?.icon ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap;

  // Desplazamiento horizontal de la fila mientras se desliza.
  const pan = useRef(new Animated.Value(0)).current;
  // Escala de la burbuja (rebota al completar/des-completar).
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const prevCompleted = useRef(task.isCompleted);

  // Los callbacks se guardan en un ref para que el PanResponder (que se crea
  // una sola vez) siempre llame a la version mas reciente.
  const actions = useRef({ onToggle, onDelete });
  actions.current = { onToggle, onDelete };

  useEffect(() => {
    if (prevCompleted.current !== task.isCompleted) {
      prevCompleted.current = task.isCompleted;
      bubbleScale.setValue(0.5);
      Animated.spring(bubbleScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [task.isCompleted, bubbleScale]);

  const panResponder = useRef(
    PanResponder.create({
      // Solo capturamos el gesto si es claramente horizontal, para no
      // pelearnos con el scroll vertical de la lista.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_e, g) => pan.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          Animated.timing(pan, { toValue: 0, duration: 180, useNativeDriver: true }).start();
          actions.current.onToggle();
        } else if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(pan, { toValue: 0, duration: 180, useNativeDriver: true }).start();
          actions.current.onDelete();
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  // La fila se mueve algo menos que el dedo (efecto de resistencia).
  const translateX = pan.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [-140, 0, 140],
    extrapolate: 'clamp',
  });
  const completeOpacity = pan.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const deleteOpacity = pan.interpolate({
    inputRange: [-60, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.rowWrap}>
      {/* Fondo que se revela al deslizar */}
      <View style={styles.swipeBackground} pointerEvents="none">
        <Animated.View
          style={[styles.swipeAction, styles.swipeComplete, { opacity: completeOpacity }]}
        >
          <Ionicons
            name={task.isCompleted ? 'arrow-undo' : 'checkmark'}
            size={26}
            color="#FFFFFF"
          />
        </Animated.View>
        <Animated.View
          style={[styles.swipeAction, styles.swipeDelete, { opacity: deleteOpacity }]}
        >
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.rowForeground, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={onPress}
        >
          {/* Columna izquierda: linea + burbuja + linea */}
          <View style={styles.iconColumn}>
            <Connector style={topConnector} />
            <Animated.View
              style={[
                styles.iconBubble,
                { backgroundColor: task.isCompleted ? colors.card : color },
                { transform: [{ scale: bubbleScale }] },
              ]}
            >
              <Ionicons
                name={task.isCompleted ? 'checkmark' : icon}
                size={24}
                color={task.isCompleted ? colors.success : '#FFFFFF'}
              />
            </Animated.View>
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
              {task.reminderMinutesBefore != null ? (
                <Ionicons name="notifications-outline" size={13} color={colors.textSecondary} />
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
          <Pressable hitSlop={12} onPress={onToggle} style={styles.checkButton}>
            <Ionicons
              name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
              size={28}
              color={task.isCompleted ? colors.success : color}
            />
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function AgendaList({
  tasks,
  categoryById,
  onPressTask,
  onToggleComplete,
  onDeleteTask,
}: Props) {
  const rows = buildRows(tasks);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => String(row.task.id)}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <Row
          info={item}
          category={categoryById.get(item.task.categoryId ?? -1)}
          onPress={() => onPressTask(item.task)}
          onToggle={() => onToggleComplete(item.task)}
          onDelete={() => onDeleteTask(item.task)}
        />
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cafe-outline" size={34} color={colors.textMuted} />
          </View>
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
  rowWrap: {
    // Contenedor de una fila: fondo de acciones + contenido deslizable.
  },
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    marginVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
  },
  swipeComplete: {
    backgroundColor: colors.success,
    alignItems: 'flex-start',
    paddingLeft: 24,
  },
  swipeDelete: {
    backgroundColor: colors.danger,
    alignItems: 'flex-end',
    paddingRight: 24,
  },
  rowForeground: {
    backgroundColor: colors.sheet,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowPressed: {
    opacity: 0.8,
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
  checkButton: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
  emptyState: {
    paddingTop: 70,
    alignItems: 'center',
    gap: 6,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
