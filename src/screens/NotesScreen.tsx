import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getCategories } from '../db/categoryRepository';
import {
  archiveNote,
  createNote,
  deleteNote,
  getActiveNotes,
  getArchivedNotes,
  setNotePinned,
  unarchiveNote,
  updateNote,
} from '../db/noteRepository';
import type { Category, Note } from '../types';
import { colors } from '../theme';
import { toISODate } from '../utils/date';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Notes'>;

type IconName = keyof typeof Ionicons.glyphMap;

// "hoy", "ayer", "hace 3 días"... createdAt viene en UTC (datetime('now')).
function formatRelativeDate(createdAtUtc: string): string {
  const created = new Date(createdAtUtc.replace(' ', 'T') + 'Z');
  if (isNaN(created.getTime())) return '';
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(created).getTime()) / 86400000
  );
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return created.toLocaleDateString();
}

export default function NotesScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);
  // Nota expandida: muestra su fila de acciones (planificar, archivar...).
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Formulario de captura (crea o, si editingId != null, edita).
  const [draft, setDraft] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Manejo manual del teclado: KeyboardAvoidingView calcula mal el
  // solapamiento en Android con edge-to-edge. Aqui medimos exactamente
  // cuanto tapa el teclado (alto de pantalla - borde superior del teclado)
  // y lo aplicamos como padding inferior. Al ocultarse, vuelve a 0.
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    // En iOS los eventos "will" permiten animar a la par del teclado.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const windowHeight = Dimensions.get('window').height;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardPad(Math.max(0, windowHeight - e.endCoordinates.screenY));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardPad(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadData = useCallback(async () => {
    const [noteRows, categoryRows] = await Promise.all([
      showArchived ? getArchivedNotes(db) : getActiveNotes(db),
      getCategories(db),
    ]);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotes(noteRows);
    setCategories(categoryRows);
  }, [db, showArchived]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const visibleNotes =
    filterCategoryId == null
      ? notes
      : notes.filter((n) => n.categoryId === filterCategoryId);

  function resetForm() {
    setDraft('');
    setDraftCategoryId(null);
    setEditingId(null);
  }

  async function handleSaveDraft() {
    const content = draft.trim();
    if (content.length === 0) return;
    if (editingId != null) {
      await updateNote(db, editingId, content, draftCategoryId);
    } else {
      await createNote(db, content, draftCategoryId);
    }
    resetForm();
    loadData();
  }

  function startEditing(note: Note) {
    setEditingId(note.id);
    setDraft(note.content);
    setDraftCategoryId(note.categoryId);
    setExpandedId(null);
  }

  async function handleTogglePin(note: Note) {
    await setNotePinned(db, note.id, !note.isPinned);
    loadData();
  }

  // Convertir en tarea: primera linea como titulo, el resto como notas.
  // La nota se archiva automaticamente al guardar la tarea.
  function handlePlan(note: Note) {
    const [firstLine, ...rest] = note.content.split('\n');
    navigation.navigate('TaskForm', {
      date: toISODate(new Date()),
      initialTitle: firstLine.trim().slice(0, 120),
      initialNotes: rest.join('\n').trim() || undefined,
      initialCategoryId: note.categoryId ?? undefined,
      noteId: note.id,
    });
    setExpandedId(null);
  }

  async function handleArchive(note: Note) {
    await archiveNote(db, note.id);
    if (editingId === note.id) resetForm();
    setExpandedId(null);
    loadData();
  }

  async function handleUnarchive(note: Note) {
    await unarchiveNote(db, note.id);
    setExpandedId(null);
    loadData();
  }

  function handleDelete(note: Note) {
    Alert.alert('Borrar nota', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(db, note.id);
          if (editingId === note.id) resetForm();
          setExpandedId(null);
          loadData();
        },
      },
    ]);
  }

  function renderNote({ item }: { item: Note }) {
    const category = item.categoryId != null ? categoryById.get(item.categoryId) : null;
    const expanded = expandedId === item.id;
    return (
      <Pressable
        style={[styles.noteCard, expanded && styles.noteCardExpanded]}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpandedId(expanded ? null : item.id);
        }}
      >
        <View style={styles.noteHeader}>
          <Text style={styles.noteContent}>{item.content}</Text>
          {!showArchived ? (
            <Pressable hitSlop={10} onPress={() => handleTogglePin(item)}>
              <Ionicons
                name={item.isPinned ? 'pin' : 'pin-outline'}
                size={18}
                color={item.isPinned ? colors.accent : colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.noteMeta}>
          {category ? (
            <View style={styles.noteCategory}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={styles.noteMetaText}>{category.name}</Text>
            </View>
          ) : null}
          <Text style={styles.noteMetaText}>{formatRelativeDate(item.createdAt)}</Text>
        </View>

        {expanded ? (
          <View style={styles.actionsRow}>
            {showArchived ? (
              <NoteAction icon="arrow-undo-outline" label="Restaurar" onPress={() => handleUnarchive(item)} />
            ) : (
              <>
                <NoteAction icon="calendar-outline" label="Planificar" accent onPress={() => handlePlan(item)} />
                <NoteAction icon="create-outline" label="Editar" onPress={() => startEditing(item)} />
                <NoteAction icon="archive-outline" label="Archivar" onPress={() => handleArchive(item)} />
              </>
            )}
            <NoteAction icon="trash-outline" label="Borrar" danger onPress={() => handleDelete(item)} />
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: keyboardPad }]}>
      {/* Activas / Archivadas */}
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segment, !showArchived && styles.segmentSelected]}
          onPress={() => setShowArchived(false)}
        >
          <Text style={[styles.segmentText, !showArchived && styles.segmentTextSelected]}>
            Activas
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, showArchived && styles.segmentSelected]}
          onPress={() => setShowArchived(true)}
        >
          <Text style={[styles.segmentText, showArchived && styles.segmentTextSelected]}>
            Archivadas
          </Text>
        </Pressable>
      </View>

      {/* Filtro por categoria */}
      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            style={[styles.filterChip, filterCategoryId == null && styles.filterChipSelected]}
            onPress={() => setFilterCategoryId(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterCategoryId == null && styles.filterChipTextSelected,
              ]}
            >
              Todas
            </Text>
          </Pressable>
          {categories.map((category) => {
            const selected = filterCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                style={[
                  styles.filterChip,
                  { borderColor: category.color },
                  selected && { backgroundColor: category.color },
                ]}
                onPress={() => setFilterCategoryId(selected ? null : category.id)}
              >
                <Ionicons
                  name={(category.icon ?? 'ellipse-outline') as IconName}
                  size={12}
                  color={selected ? '#fff' : category.color}
                />
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <FlatList
        data={visibleNotes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNote}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {showArchived
              ? 'No hay notas archivadas.'
              : 'Anota aquí lo que aún no puedas planear.\nCuando llegue el momento, conviértelo en tarea.'}
          </Text>
        }
      />

      {/* Captura rapida (crea o edita) */}
      {!showArchived ? (
        <View style={styles.captureSection}>
          {editingId != null ? (
            <View style={styles.editingHeader}>
              <Text style={styles.editingLabel}>Editando nota</Text>
              <Pressable onPress={resetForm} hitSlop={8}>
                <Text style={styles.cancelEdit}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.captureRow}>
            <TextInput
              style={styles.captureInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Anota algo rápido…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Pressable
              style={[styles.sendButton, draft.trim().length === 0 && styles.sendButtonDisabled]}
              onPress={handleSaveDraft}
            >
              <Ionicons
                name={editingId != null ? 'checkmark' : 'arrow-up'}
                size={22}
                color="#fff"
              />
            </Pressable>
          </View>
          <View style={styles.draftCategoryRow}>
            {categories.map((category) => {
              const selected = draftCategoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.draftCategoryDot,
                    { borderColor: category.color },
                    selected && { backgroundColor: category.color },
                  ]}
                  onPress={() => setDraftCategoryId(selected ? null : category.id)}
                >
                  <Ionicons
                    name={(category.icon ?? 'ellipse-outline') as IconName}
                    size={14}
                    color={selected ? '#fff' : category.color}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function NoteAction({
  icon,
  label,
  onPress,
  accent,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  const color = accent ? colors.accent : danger ? colors.danger : colors.textSecondary;
  return (
    <Pressable style={styles.action} onPress={onPress} hitSlop={6}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sheet,
  },
  segmentRow: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 10,
    gap: 10,
  },
  noteCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
  },
  noteCardExpanded: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  noteHeader: {
    flexDirection: 'row',
    gap: 10,
  },
  noteContent: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  noteCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noteMetaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 40,
    lineHeight: 20,
  },
  captureSection: {
    padding: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  editingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  editingLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cancelEdit: {
    fontSize: 12,
    color: colors.accent,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  captureInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  draftCategoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  draftCategoryDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
