import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../db/categoryRepository';
import type { Category } from '../types';
import { colors } from '../theme';

const COLOR_PALETTE = [
  '#4C6EF5',
  '#12B886',
  '#FA5252',
  '#F59F00',
  '#BE4BDB',
  '#15AABF',
  '#FD7E14',
  '#868E96',
];

// Set de iconos (nombres de Ionicons) para elegir al crear/editar.
const ICON_OPTIONS = [
  'briefcase',
  'person',
  'heart',
  'book',
  'barbell',
  'cart',
  'restaurant',
  'home',
  'car',
  'cash',
  'football',
  'musical-notes',
  'paw',
  'game-controller',
  'cafe',
  'laptop',
] as const;

type IconName = keyof typeof Ionicons.glyphMap;

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<string>(ICON_OPTIONS[0]);
  // Si hay una categoria seleccionada, el formulario la edita; si no, crea.
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadCategories = useCallback(async () => {
    setCategories(await getCategories(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  function startEditing(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setColor(category.color);
    setIcon(category.icon);
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setColor(COLOR_PALETTE[0]);
    setIcon(ICON_OPTIONS[0]);
  }

  async function handleSave() {
    if (name.trim().length === 0) return;
    if (editingId != null) {
      await updateCategory(db, editingId, name.trim(), color, icon);
    } else {
      await createCategory(db, name.trim(), color, icon);
    }
    resetForm();
    loadCategories();
  }

  async function handleDelete(category: Category) {
    Alert.alert('Borrar categoria', `Se borrara "${category.name}".`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteCategory(db, category.id);
          if (editingId === category.id) resetForm();
          loadCategories();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, editingId === item.id && styles.rowEditing]}
            onPress={() => startEditing(item)}
          >
            <View style={[styles.iconBubble, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon as IconName} size={16} color="#fff" />
            </View>
            <Text style={styles.name}>{item.name}</Text>
            <Pressable onPress={() => handleDelete(item)} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Aun no tienes categorias.</Text>
        }
      />

      <View style={styles.formSection}>
        <View style={styles.formHeader}>
          <Text style={styles.label}>
            {editingId != null ? 'Editar categoria' : 'Nueva categoria'}
          </Text>
          {editingId != null ? (
            <Pressable onPress={resetForm} hitSlop={8}>
              <Text style={styles.cancelEdit}>Cancelar</Text>
            </Pressable>
          ) : null}
        </View>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nombre"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.paletteRow}>
          {COLOR_PALETTE.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.paletteDot,
                { backgroundColor: c },
                color === c && styles.paletteDotSelected,
              ]}
            />
          ))}
        </View>
        <View style={styles.iconRow}>
          {ICON_OPTIONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              style={[
                styles.iconOption,
                icon === i && { backgroundColor: color },
              ]}
            >
              <Ionicons
                name={i as IconName}
                size={18}
                color={icon === i ? '#fff' : colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.addButton} onPress={handleSave}>
          <Text style={styles.addButtonText}>
            {editingId != null ? 'Guardar cambios' : 'Agregar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sheet,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowEditing: {
    backgroundColor: colors.card,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 40,
  },
  formSection: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cancelEdit: {
    fontSize: 13,
    color: colors.accent,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  paletteDotSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  iconOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
