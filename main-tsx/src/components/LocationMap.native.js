import { Platform } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

export default function LocationMap({ location, pinColor }) {
  return (
    <MapView
      style={{ flex: 1 }}
      liteMode={Platform.OS === 'android'}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
    >
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
      <Marker coordinate={location} pinColor={pinColor} />
    </MapView>
  );
}
