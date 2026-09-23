import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, FlatList } from 'react-native';
import { CalendarProvider, useCalendarContext } from './src/context/CalendarContext';
import { v4 as uuidv4 } from 'uuid';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HiddenEventsListScreen } from './src/screens/HiddenEventsListScreen';

// Home screen (formerly CalendarUI)
const HomeScreen: React.FC = () => {
  const {
    calendars,
    events,
    addCalendar,
    addEvent,
    visibleCalendarIds,
    toggleCalendarVisibility,
    getVisibleCalendars,
    getEventsWithEffectiveColors,
    getEffectiveColor
  } = useCalendarContext();

  // For testing, we'll add a sample calendar and event on button press
  const handleAddSampleData = () => {
    // Add a calendar if none exists
    if (calendars.length === 0) {
      const newCalendar = {
        id: uuidv4(),
        name: 'Personal',
        color: '#ff0000',
      };
      addCalendar(newCalendar);
    }

    // Add a sample event
    const now = new Date();
    const startDate = now.toISOString();
    const endDate = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour later
    const newEvent = {
      id: uuidv4(),
      title: 'Sample Event',
      startDate,
      endDate,
      isAllDay: false,
      calendarId: calendars.length > 0 ? calendars[0].id : '',
      color: undefined,
      recurrenceRule: undefined,
      pauseWindows: [],
      reminders: [15],
      emoji: undefined,
      tags: [],
    };
    addEvent(newEvent);
  };

  return (
    <View style={styles.container}>
      <Button title="Add Sample Data" onPress={handleAddSampleData} />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calendars</Text>
        <FlatList
          data={calendars}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.calendarRow}>
              <View
                style={[
                  styles.colorIndicator,
                  { backgroundColor: item.color },
                  { opacity: visibleCalendarIds.includes(item.id) ? 1 : 0.5 },
                ]}
              />
              <Text style={styles.calendarName}>{item.name}</Text>
              <Button
                title={visibleCalendarIds.includes(item.id) ? 'Hide' : 'Show'}
                onPress={() => toggleCalendarVisibility(item.id)}
              />
            </View>
          )}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Events (from visible calendars)</Text>
        <FlatList
          data={getEventsWithEffectiveColors()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[
              styles.eventRow,
              { borderLeftWidth: 4, borderLeftColor: getEffectiveColor(item) }
            ]}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventTime}>
                {new Date(item.startDate).toLocaleTimeString()} - {new Date(item.endDate).toLocaleTimeString()}
              </Text>
            </View>
          )}
        />
      </View>
    </View>
  );
};

// Set up the navigator
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <CalendarProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Calendar' }}
          />
          <Stack.Screen
            name="HiddenEvents"
            component={HiddenEventsListScreen}
            options={{ title: 'Hidden Events' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </CalendarProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  section: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  calendarName: {
    flex: 1,
    fontSize: 16,
  },
  eventRow: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
  },
});