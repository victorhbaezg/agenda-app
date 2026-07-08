import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TodayScreen from '../screens/TodayScreen';
import TaskFormScreen from '../screens/TaskFormScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import NotesScreen from '../screens/NotesScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Today: undefined;
  TaskForm: {
    date: string;
    taskId?: number;
    initialStartTime?: string;
    // Al planificar una nota: prellenan el formulario y noteId
    // hace que la nota se archive cuando se guarda la tarea.
    initialTitle?: string;
    initialNotes?: string;
    initialCategoryId?: number;
    noteId?: number;
  };
  Categories: undefined;
  Notes: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Tema oscuro de navegacion basado en la paleta de la app.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    primary: colors.accent,
    border: colors.line,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.sheet },
          // Fondo oscuro del contenedor nativo de cada pantalla: evita el
          // destello blanco durante la transicion entre pantallas.
          contentStyle: { backgroundColor: colors.sheet },
        }}
      >
        {/* La pantalla Hoy dibuja su propia cabecera (mes + semana). */}
        <Stack.Screen
          name="Today"
          component={TodayScreen}
          options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
        />
        {/* Hoja inferior: el formulario sube como panel y deja ver la
            pantalla de hoy oscurecida detras. Se puede cerrar arrastrando
            hacia abajo. El titulo se dibuja dentro del propio formulario. */}
        <Stack.Screen
          name="TaskForm"
          component={TaskFormScreen}
          options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.95],
            sheetCornerRadius: 24,
            sheetGrabberVisible: true,
          }}
        />
        {/* Push estilo iPhone: entra desde la derecha y la pantalla anterior
            se desliza ligeramente (parallax). */}
        <Stack.Screen
          name="Categories"
          component={CategoriesScreen}
          options={{ title: 'Categorías', animation: 'ios_from_right' }}
        />
        <Stack.Screen
          name="Notes"
          component={NotesScreen}
          options={{ title: 'Notas', animation: 'ios_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
