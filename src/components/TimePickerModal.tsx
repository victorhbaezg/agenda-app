// Selector de hora tipo "rueda" (horas y minutos), sin dependencias externas.
// Se abre como un panel inferior sobre un fondo oscurecido.

import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { colors } from '../theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface WheelProps {
  data: number[];
  initialValue: number;
  onChange: (value: number) => void;
}

// Una columna deslizable que "encaja" en el valor centrado.
// El valor resaltado se actualiza en vivo mientras se desliza (onScroll),
// porque en Android el evento de "fin de scroll" no siempre se dispara.
function Wheel({ data, initialValue, onChange }: WheelProps) {
  const ref = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);
  const [selected, setSelected] = useState(initialValue);

  function indexFromOffset(offsetY: number): number {
    return Math.min(data.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
  }

  // Actualiza el valor resaltado en vivo mientras la rueda se mueve.
  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const value = data[indexFromOffset(e.nativeEvent.contentOffset.y)];
    if (value !== selected) {
      setSelected(value);
      onChange(value);
    }
  }

  // Si el usuario suelta sin impulso, encajamos la rueda manualmente.
  function handleDragEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = indexFromOffset(e.nativeEvent.contentOffset.y);
    ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  }

  return (
    <View style={styles.wheel}>
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={styles.wheelContent}
        onScroll={handleScroll}
        onScrollEndDrag={handleDragEnd}
        // Colocar la rueda en el valor inicial cuando el contenido ya tiene
        // tamano (mas fiable dentro de un Modal que hacerlo al montar).
        onContentSizeChange={() => {
          if (didInitialScroll.current) return;
          didInitialScroll.current = true;
          const index = Math.max(0, data.indexOf(initialValue));
          ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
        }}
      >
        {data.map((n) => (
          <View key={n} style={styles.wheelItem}>
            <Text style={[styles.wheelText, n === selected && styles.wheelTextSelected]}>
              {pad(n)}
            </Text>
          </View>
        ))}
      </ScrollView>
      {/* Marco que resalta la fila central; no captura toques. */}
      <View pointerEvents="none" style={styles.wheelHighlight} />
    </View>
  );
}

interface Props {
  visible: boolean;
  initialTime: string; // "HH:MM"
  title?: string;
  onCancel: () => void;
  onConfirm: (time: string) => void;
}

export default function TimePickerModal({
  visible,
  initialTime,
  title,
  onCancel,
  onConfirm,
}: Props) {
  // Los valores elegidos se guardan en refs actualizados por las ruedas;
  // no hace falta re-renderizar el modal al girarlas.
  const hourRef = useRef(9);
  const minuteRef = useRef(0);
  const [initial, setInitial] = useState({ hour: 9, minute: 0 });

  // Al abrirse, tomar la hora inicial (los minutos se redondean al multiplo
  // de 5 mas cercano, que es el paso de la rueda).
  useEffect(() => {
    if (!visible) return;
    const match = /^(\d{2}):(\d{2})$/.exec(initialTime);
    const hour = match ? Math.min(23, parseInt(match[1], 10)) : 9;
    const minute = match ? Math.min(55, Math.round(parseInt(match[2], 10) / 5) * 5) : 0;
    hourRef.current = hour;
    minuteRef.current = minute;
    setInitial({ hour, minute });
  }, [visible, initialTime]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {/* Zona oscura: tocar fuera del panel cierra el modal. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <View style={styles.sheet}>
          <Text style={styles.title}>{title ?? 'Hora de inicio'}</Text>

          {visible ? (
            <View style={styles.wheelsRow}>
              <Wheel
                data={HOURS}
                initialValue={initial.hour}
                onChange={(v) => (hourRef.current = v)}
              />
              <Text style={styles.separator}>:</Text>
              <Wheel
                data={MINUTES}
                initialValue={initial.minute}
                onChange={(v) => (minuteRef.current = v)}
              />
            </View>
          ) : null}

          <View style={styles.buttonsRow}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={styles.confirmButton}
              onPress={() => onConfirm(`${pad(hourRef.current)}:${pad(minuteRef.current)}`)}
            >
              <Text style={styles.confirmText}>Aceptar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  wheel: {
    height: WHEEL_HEIGHT,
    width: 80,
  },
  wheelContent: {
    paddingVertical: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 22,
    color: colors.textMuted,
  },
  wheelTextSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  wheelHighlight: {
    position: 'absolute',
    top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  separator: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
