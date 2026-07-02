import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TodayScreen from '../screens/TodayScreen';
import TaskFormScreen from '../screens/TaskFormScreen';
import CategoriesScreen from '../screens/CategoriesScreen';

export type RootStackParamList = {
  Today: undefined;
  TaskForm: { date: string; taskId?: number };
  Categories: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTintColor: '#212529' }}>
        <Stack.Screen name="Today" component={TodayScreen} options={{ title: 'Agenda' }} />
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
