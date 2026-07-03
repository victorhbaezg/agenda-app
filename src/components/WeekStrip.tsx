// Cabecera con el mes y la tira de dias de la semana (estilo Structured).
// Se puede deslizar horizontalmente para cambiar de semana y tocar un dia
// para seleccionarlo.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors } from '../theme';
import {
  WEEKDAY_SHORT,
  addDays,
  dayOfMonth,
  formatMonthYear,
  isToday,
  startOfWeek,
  toISODate,
} from '../utils/date';

// Cuantas semanas hacia atras/adelante se pueden deslizar.
const WEEK_RANGE = 52;

interface Props {
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
}

export default function WeekStrip({ selectedDate, onSelectDate }: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);

  // Lista fija de lunes: 52 semanas atras + actual + 52 adelante.
  const weeks = useMemo(() => {
    const currentMonday = startOfWeek(toISODate(new Date()));
    return Array.from({ length: WEEK_RANGE * 2 + 1 }, (_, i) =>
      addDays(currentMonday, (i - WEEK_RANGE) * 7)
    );
  }, []);

  const selectedMonday = startOfWeek(selectedDate);
  const [visibleMonday, setVisibleMonday] = useState(selectedMonday);

  // Si la fecha seleccionada cambia de semana (ej. boton "hoy"),
  // desplazar la tira hasta esa semana.
  useEffect(() => {
    const index = weeks.indexOf(selectedMonday);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true });
      setVisibleMonday(selectedMonday);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonday]);

  // El mes mostrado se toma del jueves de la semana visible (dia central).
  const monthLabel = formatMonthYear(addDays(visibleMonday, 3));

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        {!isToday(selectedDate) ? (
          <Pressable
            onPress={() => onSelectDate(toISODate(new Date()))}
            hitSlop={8}
            style={styles.todayButton}
          >
            <Text style={styles.todayButtonText}>hoy</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={weeks}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(monday) => monday}
        initialScrollIndex={weeks.indexOf(selectedMonday)}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (weeks[index]) setVisibleMonday(weeks[index]);
        }}
        renderItem={({ item: monday }) => (
          <View style={[styles.weekRow, { width }]}>
            {WEEKDAY_SHORT.map((label, i) => {
              const date = addDays(monday, i);
              const selected = date === selectedDate;
              const today = isToday(date);
              return (
                <Pressable
                  key={date}
                  style={styles.dayCell}
                  onPress={() => onSelectDate(date)}
                >
                  <Text style={styles.dayName}>{label}</Text>
                  <View style={[styles.dayNumberWrap, selected && styles.dayNumberWrapSelected]}>
                    <Text
                      style={[
                        styles.dayNumber,
                        today && !selected && styles.dayNumberToday,
                        selected && styles.dayNumberSelected,
                      ]}
                    >
                      {dayOfMonth(date)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingBottom: 12,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  monthLabel: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  todayButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  todayButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  dayName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayNumberWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrapSelected: {
    backgroundColor: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayNumberToday: {
    color: colors.accent,
  },
  dayNumberSelected: {
    color: '#141416',
  },
});
