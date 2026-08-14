export const SIGNAL_WARNING_COLORS = {
  Red: '#EF4444',
  Yellow: '#F59E0B',
  Green: '#10B981',
  Blue: '#3B82F6',
  Gray: '#9CA3AF',
} as const;

export type SignalWarningColor = keyof typeof SIGNAL_WARNING_COLORS;

export type SignalWarningLocation = {
  latitude: number;
  longitude: number;
};

export type SignalWarning = {
  id: string;
  warning: SignalWarningColor;
  image: string;
  pinColor: string;
  location: SignalWarningLocation;
};

export const createSignalWarning = (
  warning: Exclude<SignalWarningColor, 'Gray'>,
  image: string,
  location: SignalWarningLocation,
): SignalWarning => ({
  id: `${warning}-${location.latitude}-${location.longitude}`,
  warning,
  image,
  pinColor: SIGNAL_WARNING_COLORS[warning],
  location,
});