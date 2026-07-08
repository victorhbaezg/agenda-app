import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { migrateDbIfNeeded } from './src/db/database';
import { configureNotifications, resyncReminders } from './src/services/reminders';
import { colors } from './src/theme';

// Comportamiento de las notificaciones con la app abierta: se configura
// una sola vez al arrancar.
configureNotifications();

// Al abrir la app se reprograman los recordatorios de los proximos dias
// (ver comentario en services/reminders.ts). No renderiza nada.
function ReminderSync() {
  const db = useSQLiteContext();
  useEffect(() => {
    resyncReminders(db);
  }, [db]);
  return null;
}

function LoadingFallback() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider databaseName="agenda.db" onInit={migrateDbIfNeeded}>
          <ReminderSync />
          <RootNavigator />
        </SQLiteProvider>
      </Suspense>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
