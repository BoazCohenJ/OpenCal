import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';

export const HiddenEventsListScreen: React.FC = () => {
  const {
    getEventsWithEffectiveColors,
    getEffectiveColor,
    calendars
  } = useCalendarContext();

  const [filters, setFilters] = useState({
    onlyRepeating: false,
    selectedCalendar: 'all', // 'all' or calendarId
    startDate: '',
    endDate: '',
    tag: ''
  });

  // Get events and apply filters
  const filteredEvents = getEventsWithEffectiveColors().filter(event => {
    if (!event) return false;

    // Filter by repeating events
    if (filters.onlyRepeating && !event.recurrenceRule) {
      return false;
    }

    // Filter by calendar
    if (filters.selectedCalendar !== 'all' && event.calendarId !== filters.selectedCalendar) {
      return false;
    }

    // Filter by date range (simplified - just checking if start date is in range)
    if (filters.startDate || filters.endDate) {
      const eventStart = new Date(event.startDate);
      const start = filters.startDate ? new Date(filters.startDate) : null;
      const end = filters.endDate ? new Date(filters.endDate) : null;

      if (start && eventStart < start) return false;
      if (end && eventStart > end) return false;
    }

    // Filter by tag (simplified)
    if (filters.tag && (!event.tags || !event.tags.includes(filters.tag))) {
      return false;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.filtersSection}>
        <Text style={styles.sectionTitle}>Filters</Text>

        {/* Only repeating events toggle */}
        <View style={styles.filterRow}>
          <Text>Only repeating events:</Text>
          {/* Placeholder for toggle - using text for now */}
          <Text>{filters.onlyRepeating ? 'On' : 'Off'}</Text>
        </View>

        {/* Calendar filter */}
        <View style={styles.filterRow}>
          <Text>By calendar:</Text>
          <TextInput
            placeholder="Select calendar"
            value={filters.selectedCalendar === 'all' ? 'All Calendars' : (calendars.find(c => c.id === filters.selectedCalendar)?.name || 'Unknown')}
            editable={false}
            style={styles.calendarInput}
          />
          {/* In a real app, we'd show a picker/modal here to select calendar */}
        </View>

        {/* Date range filter */}
        <View style={styles.filterRow}>
          <Text>Date range:</Text>
          <View style={styles.dateInputs}>
            <TextInput
              placeholder="Start date"
              value={filters.startDate}
              onChangeText={text => setFilters({...filters, startDate: text})}
              style={styles.dateInput}
            />
            <Text> to </Text>
            <TextInput
              placeholder="End date"
              value={filters.endDate}
              onChangeText={text => setFilters({...filters, endDate: text})}
              style={styles.dateInput}
            />
          </View>
        </View>

        {/* Tag filter */}
        <View style={styles.filterRow}>
          <Text>By tag:</Text>
          <TextInput
            placeholder="Enter tag"
            value={filters.tag}
            onChangeText={text => setFilters({...filters, tag: text})}
            style={styles.tagInput}
          />
        </View>
      </View>

      <View style={styles.eventsSection}>
        <Text style={styles.sectionTitle}>Events</Text>
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.eventItem,
                { borderLeftWidth: 4, borderLeftColor: getEffectiveColor(item) }
              ]}
              onPress={() => {
                // TODO: Navigate to event edit screen
                alert(`Edit event: ${item.title}`);
              }}
            >
              <View style={styles.eventContent}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDetails}>
                  {new Date(item.startDate).toLocaleDateString()} {new Date(item.startDate).toLocaleTimeString()} -
                  {new Date(item.endDate).toLocaleDateString()} {new Date(item.endDate).toLocaleTimeString()}
                </Text>
                {item.recurrenceRule && <Text style={styles.eventBadge}>Repeating</Text>}
                {item.emoji && <Text style={styles.eventBadge}>{item.emoji}</Text>}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text>No events match the current filters</Text>}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  filtersSection: {
    marginBottom: 20,
  },
  eventsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    width: 100,
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 4,
    marginHorizontal: 4,
  },
  calendarInput: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 4,
  },
  tagInput: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 4,
  },
  eventItem: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  eventContent: {
    flexDirection: 'column',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 14,
    color: '#666',
  },
  eventBadge: {
    fontSize: 12,
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 8,
  },
});