import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { migrateDbIfNeeded } from './src/db/database';

function LoadingFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#4C6EF5" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider databaseName="agenda.db" onInit={migrateDbIfNeeded}>
          <RootNavigator />
        </SQLiteProvider>
      </Suspense>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
