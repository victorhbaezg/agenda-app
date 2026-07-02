import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createCategory,
  deleteCategory,
  getCategories,
} from '../db/categoryRepository';
import type { Category } from '../types';

const COLOR_PALETTE = [
  '#4C6EF5',
  '#12B886',
  '#FA5252',
  '#F59F00',
  '#BE4BDB',
  '#15AABF',
  '#FD7E14',
  '#495057',
];

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  const loadCategories = useCallback(async () => {
    setCategories(await getCategories(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  async function handleAdd() {
    if (name.trim().length === 0) return;
    await createCategory(db, name.trim(), color, 'pricetag');
    setName('');
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
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={styles.name}>{item.name}</Text>
            <Pressable onPress={() => handleDelete(item)} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color="#ADB5BD" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Aun no tienes categorias.</Text>
        }
      />

      <View style={styles.formSection}>
        <Text style={styles.label}>Nueva categoria</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nombre"
          placeholderTextColor="#ADB5BD"
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
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Agregar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9ECEF',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: '#212529',
  },
  empty: {
    textAlign: 'center',
    color: '#ADB5BD',
    marginTop: 40,
  },
  formSection: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E9ECEF',
  },
  label: {
    fontSize: 13,
    color: '#495057',
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
    marginBottom: 12,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  paletteDotSelected: {
    borderWidth: 3,
    borderColor: '#212529',
  },
  addButton: {
    backgroundColor: '#4C6EF5',
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
