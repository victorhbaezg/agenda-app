import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TodayScreen from '../screens/TodayScreen';
import TaskFormScreen from '../screens/TaskFormScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Today: undefined;
  TaskForm: { date: string; taskId?: number; initialStartTime?: string };
  Categories: undefined;
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
        }}
      >
        {/* La pantalla Hoy dibuja su propia cabecera (mes + semana). */}
        <Stack.Screen name="Today" component={TodayScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="TaskForm"
          component={TaskFormScreen}
          options={({ route }) => ({
            title: route.params.taskId != null ? 'Editar tarea' : 'Nueva tarea',
            presentation: 'modal',
          })}
        />
        <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categorias' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
