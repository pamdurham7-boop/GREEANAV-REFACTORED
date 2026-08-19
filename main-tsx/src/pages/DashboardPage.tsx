import { Animated, Platform, Pressable, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import PieChart from 'expo-charts/dist/PieChart';
import { SignalWarning } from '../interfaces/signal_warning';
import { styles } from './styles';

const LocationMap =
  Platform.OS === 'web'
    ? require('../components/LocationMap.web.js').default
    : require('../components/LocationMap.native.js').default;

type HeaderStyle = StyleProp<ViewStyle>;

type WarningPaletteItem = {
  label: string;
  value: number;
  color: string;
};

type DashboardPageProps = {
  headerStyle: HeaderStyle;
  isDesktop: boolean;
  panelWidth: number;
  chartWidth: number;
  mapHeight: number;
  totalWarnings: number;
  warningPalette: WarningPaletteItem[];
  showRedLocations: boolean;
  showYellowLocations: boolean;
  signalsRed: SignalWarning[];
  signalsYellow: SignalWarning[];
  location: { latitude: number; longitude: number } | null;
  pinColor: string;
  onToggleRed: () => void;
  onToggleYellow: () => void;
  onDeleteLocation: (id: string) => void;
};

export function DashboardPage({
  headerStyle,
  isDesktop,
  panelWidth,
  chartWidth,
  mapHeight,
  totalWarnings,
  warningPalette,
  showRedLocations,
  showYellowLocations,
  signalsRed,
  signalsYellow,
  location,
  pinColor,
  onToggleRed,
  onToggleYellow,
  onDeleteLocation,
}: DashboardPageProps) {
  return (
    <View style={styles.pageShell}>
      <Animated.View style={[styles.hero, isDesktop && styles.heroDesktop, headerStyle]}>
        <View style={[styles.heroTextBlock, isDesktop && styles.heroTextBlockDesktop]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>GreenAV</Text>
          <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
            Make the world greener and brighter
          </Text>
        </View>

        <Animated.View style={[styles.chartCard, { width: panelWidth }, isDesktop && styles.chartCardDesktop]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartEyebrow}>Warning balance</Text>
              <Text style={styles.chartTitle}>Signal distribution</Text>
            </View>
            <View style={styles.chartPill}>
              <Text style={styles.chartPillText}>
                {totalWarnings ? `${totalWarnings} active` : 'No warnings'}
              </Text>
            </View>
          </View>

          <PieChart
            data={warningPalette.map((item) => ({ label: item.label, value: item.value }))}
            width={chartWidth}
            height={240}
            colors={['#EF4444', '#F59E0B', '#10B981', '#3B82F6']}
            showLabels
            showPercentages
          />

          <View style={styles.legendGrid}>
            {warningPalette.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <View style={styles.legendCopy}>
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendValue}>{item.value.toFixed(0)}%</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={({ pressed }) => [styles.dropdownRow, pressed && styles.pressRow]} onPress={onToggleRed}>
            <Text style={styles.dropdownArrow}>{showRedLocations ? '▾' : '▸'}</Text>
            <Text style={styles.dropdownLabel}>Red locations</Text>
          </Pressable>
          {showRedLocations ? (
            <View style={styles.dropdownContent}>
              {signalsRed.map((signal) => (
                <View key={signal.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.dropdownText}>
                    {signal.location.latitude.toFixed(6)}, {signal.location.longitude.toFixed(6)}
                  </Text>
                  <Pressable onPress={() => onDeleteLocation(signal.id)} style={{ paddingVertical: 4 }}>
                    <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable style={({ pressed }) => [styles.dropdownRow, pressed && styles.pressRow]} onPress={onToggleYellow}>
            <Text style={styles.dropdownArrow}>{showYellowLocations ? '▾' : '▸'}</Text>
            <Text style={styles.dropdownLabel}>Yellow locations</Text>
          </Pressable>
          {showYellowLocations ? (
            <View style={styles.dropdownContent}>
              {signalsYellow.map((signal) => (
                <View key={signal.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.dropdownText}>
                    {signal.location.latitude.toFixed(6)}, {signal.location.longitude.toFixed(6)}
                  </Text>
                  <Pressable onPress={() => onDeleteLocation(signal.id)} style={{ paddingVertical: 4 }}>
                    <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.mapCard, { width: panelWidth, height: mapHeight }, isDesktop && styles.mapCardDesktop]}>
          {location ? (
            <LocationMap location={location} pinColor={pinColor} />
          ) : (
            <View style={styles.mapPlaceholder} />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}