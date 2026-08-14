import { View, StyleSheet } from 'react-native';

export default function LocationMap({ location, pinColor }) {
  const iframeSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.01}%2C${location.latitude - 0.01}%2C${location.longitude + 0.01}%2C${location.latitude + 0.01}&layer=mapnik&marker=${location.latitude}%2C${location.longitude}`;
  const Iframe = 'iframe';

  return (
    <View style={styles.container}>
      <Iframe src={iframeSrc} style={styles.iframe} title="Location map" loading="eager" />
      <View style={[styles.pin, { backgroundColor: pinColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  pin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
