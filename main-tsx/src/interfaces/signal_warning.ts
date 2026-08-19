export const SIGNAL_WARNING_COLORS = {
  Red: '#EF4444',
  Yellow: '#F59E0B',
  Green: '#10B981',
  Blue: '#3B82F6',
  Gray: '#9CA3AF',
} as const;

export interface SignalWarning {
  id: string;
  deviceId: string;
  color: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'NONE';
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
}