import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { supabase } from '../lib/supabase';

const screenWidth = Dimensions.get('window').width;

const REASONS = ['all', 'expired', 'spoiled', 'unwanted', 'damaged'];
const pieColors = ['#FF6384', '#36A2EB', '#FFCE56', '#8BC34A', '#FF9800', '#9C27B0', '#00ACC1'];

export default function WasteStatsScreen() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({ labels: [], datasets: [{ data: [] }] });
  const [pieData, setPieData] = useState([]);
  const [selectedReason, setSelectedReason] = useState('all');

  useEffect(() => {
    fetchDiscardStats();
    fetchDiscardReasons();
  }, [selectedReason]);

  const fetchDiscardStats = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase
      .from('discarded_items')
      .select('discarded_at, reason')
      .eq('user_id', user.id);

    if (selectedReason !== 'all') {
      query = query.eq('reason', selectedReason);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading stats:', error);
      return;
    }

    const grouped = {};
    data.forEach((item) => {
      const date = new Date(item.discarded_at).toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    });

    const sortedDates = Object.keys(grouped).sort();

    setChartData({
      labels: sortedDates.map((d) => d.slice(5)), // MM-DD
      datasets: [{ data: sortedDates.map((d) => grouped[d]) }],
    });

    setLoading(false);
  };

  const fetchDiscardReasons = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) throw new Error('User not found');

      const { data, error } = await supabase
        .from('discarded_items')
        .select('reason')
        .eq('user_id', user.id);

      if (error) throw error;

      const reasonCounts = {};
      data.forEach((item) => {
        const reason = item.reason || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });

      const formattedData = Object.entries(reasonCounts).map(([reason, count], index) => ({
        name: reason,
        count,
        color: pieColors[index % pieColors.length],
        legendFontColor: '#333',
        legendFontSize: 12,
      }));

      setPieData(formattedData);
    } catch (err) {
      console.error('Error loading discard reasons:', err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📉 Waste Stats</Text>
      <Text style={styles.subtitle}>Number of items discarded per day</Text>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {REASONS.map((reason) => (
          <TouchableOpacity
            key={reason}
            style={[
              styles.filterButton,
              selectedReason === reason && styles.selectedFilterButton,
            ]}
            onPress={() => setSelectedReason(reason)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedReason === reason && styles.selectedFilterText,
              ]}
            >
              {reason.charAt(0).toUpperCase() + reason.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00C897" />
          <Text style={styles.loadingText}>Loading waste stats...</Text>
        </View>
      ) : (
        <BarChart
          data={chartData}
          width={screenWidth - 30}
          height={220}
          yAxisLabel=""
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#f8f8f8',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 200, 151, ${opacity})`,
            labelColor: () => '#333',
          }}
          style={{ marginVertical: 20, borderRadius: 8 }}
        />
      )}

      <Text style={[styles.subtitle, { marginTop: 20, marginBottom: 10 }]}>
        📊 Discard Reasons Breakdown
      </Text>

      {pieData.length > 0 && (
        <PieChart
          data={pieData}
          width={screenWidth - 30}
          height={220}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="10"
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 168, 107, ${opacity})`,
            labelColor: () => '#000',
          }}
          absolute
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#00A86B',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    margin: 4,
  },
  selectedFilterButton: {
    backgroundColor: '#00C897',
    borderColor: '#00C897',
  },
  filterButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedFilterText: {
    color: '#fff',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
