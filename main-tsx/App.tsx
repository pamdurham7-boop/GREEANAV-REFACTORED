import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SIGNAL_WARNING_COLORS, SignalWarning } from './src/interfaces/signal_warning';
import { UserAccount } from './src/interfaces/user_account';
import * as Location from 'expo-location';
import { DashboardPage } from './src/pages/DashboardPage';
import { LoginPage, RegisterPage } from './src/pages/AuthPages';
import { styles } from './src/pages/styles';

const AUTH_STORAGE_KEY = '@greenav/auth';
const USERS_STORAGE_KEY = '@greenav/users';
const LAST_LOCATION_STORAGE_KEY = '@greenav/last-location';

type AuthScreen = 'login' | 'register';
type StoredCredentials = {
  username: string;
  password: string;
};

export default function App() {
  const { width, height } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>([]);
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showRedLocations, setShowRedLocations] = useState(false);
  const [showYellowLocations, setShowYellowLocations] = useState(false);

  // Added dynamic signals state
  const [signals, setSignals] = useState<SignalWarning[]>([]);

  const isDesktop = Platform.OS === 'web' && width >= 900;
  const cardWidth = Math.min(width - 48, isDesktop ? 1080 : 420);
  const panelWidth = isDesktop ? Math.floor((cardWidth - 20) / 2) : cardWidth;
  const chartWidth = Math.max(panelWidth - 24, 280);
  const mapHeight = Math.round(Math.min(panelWidth, 520) * (isDesktop ? 0.78 : 0.82));

  // Derived signal categories
  const signalsRed = signals.filter(s => s.color === 'RED');
  const signalsYellow = signals.filter(s => s.color === 'YELLOW');
  const signalsGreen = signals.filter(s => s.color === 'GREEN');
  const signalsBlue = signals.filter(s => s.color === 'BLUE');

  const totalWarnings = signals.length;

  const pieData = [
    { label: 'Red', value: totalWarnings ? (signalsRed.length / totalWarnings) * 100 : 0 },
    { label: 'Yellow', value: totalWarnings ? (signalsYellow.length / totalWarnings) * 100 : 0 },
    { label: 'Green', value: totalWarnings ? (signalsGreen.length / totalWarnings) * 100 : 0 },
    { label: 'Blue', value: totalWarnings ? (signalsBlue.length / totalWarnings) * 100 : 0 },
  ];

  const warningPalette = totalWarnings > 0 
    ? [
        { label: 'Red', value: pieData[0].value, color: '#EF4444' },
        { label: 'Yellow', value: pieData[1].value, color: '#F59E0B' },
        { label: 'Green', value: pieData[2].value, color: '#10B981' },
        { label: 'Blue', value: pieData[3].value, color: '#3B82F6' },
      ]
    : [
        // Renders a single 100% gray slice so the math doesn't result in NaN
        { label: 'No Data', value: 100, color: '#E5E7EB' } 
      ];

  // Dynamic Map Pin Logic based on sensor data
  let mapLocation = location;
  let pinColor = SIGNAL_WARNING_COLORS.Gray;

  if (signals.length > 0) {
    const latestSignal = signals.reduce((prev, curr) => (prev.timestamp > curr.timestamp) ? prev : curr, signals[0]);
    mapLocation = latestSignal.location; // Forces map to sensor's location independent of the user
    switch (latestSignal.color) {
      case 'RED': pinColor = (SIGNAL_WARNING_COLORS as any).Red || '#EF4444'; break;
      case 'YELLOW': pinColor = (SIGNAL_WARNING_COLORS as any).Yellow || '#F59E0B'; break;
      case 'GREEN': pinColor = (SIGNAL_WARNING_COLORS as any).Green || '#10B981'; break;
      case 'BLUE': pinColor = (SIGNAL_WARNING_COLORS as any).Blue || '#3B82F6'; break;
      default: pinColor = (SIGNAL_WARNING_COLORS as any).Gray || '#9CA3AF';
    }
  }

  useEffect(() => {
    let active = true;

    async function hydrateAuth() {
      try {
        const [savedAuth, savedUsers] = await Promise.all([
          AsyncStorage.getItem(AUTH_STORAGE_KEY),
          AsyncStorage.getItem(USERS_STORAGE_KEY),
          AsyncStorage.getItem(LAST_LOCATION_STORAGE_KEY),
        ]);

        if (!active) return;

        if (savedAuth) {
          const parsedAuth = JSON.parse(savedAuth) as StoredCredentials;
          setUsername(parsedAuth.username);
          setPassword(parsedAuth.password);
        }

        if (savedUsers) {
          setRegisteredUsers(JSON.parse(savedUsers) as UserAccount[]);
        }

        if (savedAuth && savedUsers) {
          const savedLocation = await AsyncStorage.getItem(LAST_LOCATION_STORAGE_KEY);
          if (savedLocation) {
            const parsedLocation = JSON.parse(savedLocation) as { latitude: number; longitude: number };
            setLocation(parsedLocation);
          }
        }
      } catch {
        // Keep the screen usable even if local storage fails.
      }
    }

    hydrateAuth();
    return () => { active = false; };
  }, []);

  // Location Tracker
  useEffect(() => {
    if (!isLoggedIn) return;

    let subscription: Location.LocationSubscription;

    async function startTracking() {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const cachedLocation = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
        setLocation(cachedLocation);
        await AsyncStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify(cachedLocation));
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        (pos) => {
          const nextLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setLocation(nextLocation);
          AsyncStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify(nextLocation));

          // Add this API call so the backend knows where the device is!
          fetch('/device-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: "1", // You will need to specify which device ID to map this to
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            })
          }).catch(err => console.error("Failed to update location", err));
        }
      );
    }

    startTracking();
    return () => subscription?.remove();
  }, [isLoggedIn]);

  // Backend Signal Polling
  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;

    const fetchSignals = async () => {
      try {
        const response = await fetch('/172.20.10.3:5000/signals');
        if (response.ok && active) {
          const data = await response.json();
          setSignals(data);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchSignals();
    const intervalId = setInterval(fetchSignals, 5000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isLoggedIn]);

  const handleLogin = async () => {
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setLoginError('Invalid username or password.');
        return;
      }

      setLoginError('');
      setIsLoggedIn(true);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username, password }));
    } catch (error) {
      setLoginError('Network error connecting to the server.');
    }
  };

  const handleRegister = async () => {
    if (!registerFullName || !registerUsername || !registerPassword) {
      setRegisterError('Fill in every field to register.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fullName: registerFullName, 
          username: registerUsername, 
          password: registerPassword 
        }),
      });

      if (!response.ok) {
        setRegisterError('That username is already registered.');
        return;
      }

      setUsername(registerUsername);
      setPassword(registerPassword);
      setLoginError('');
      setRegisterError('');
      setIsLoggedIn(true);
      
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ username: registerUsername, password: registerPassword })
      );
    } catch (error) {
      setRegisterError('Network error connecting to the server.');
    }
  };

  const handleDeleteLocation = async (deviceId: string) => {
    try {
      const response = await fetch('/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (response.ok) {
        setSignals(prev => prev.filter(s => s.id !== deviceId));
      }
    } catch (error) {
      console.error('Failed to delete location:', error);
    }
  };

  const shellStyle = [styles.container, { minHeight: height }];
  const headerStyle = {
    opacity: scrollY.interpolate({ inputRange: [0, 160], outputRange: [1, 0.96], extrapolate: 'clamp' }),
    transform: [{ translateY: scrollY.interpolate({ inputRange: [0, 160], outputRange: [0, -8], extrapolate: 'clamp' }) }],
  };

  if (!isLoggedIn) {
    return (
      <Animated.ScrollView
        style={styles.screen}
        contentContainerStyle={shellStyle}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {authScreen === 'login' ? (
          <LoginPage
            headerStyle={headerStyle}
            cardWidth={cardWidth}
            username={username}
            password={password}
            loginError={loginError}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onRegisterPress={() => setAuthScreen('register')}
            onLoginPress={handleLogin}
          />
        ) : (
          <RegisterPage
            headerStyle={headerStyle}
            cardWidth={cardWidth}
            registerFullName={registerFullName}
            registerUsername={registerUsername}
            registerPassword={registerPassword}
            registerConfirmPassword={registerConfirmPassword}
            registerError={registerError}
            onFullNameChange={setRegisterFullName}
            onUsernameChange={setRegisterUsername}
            onPasswordChange={setRegisterPassword}
            onConfirmPasswordChange={setRegisterConfirmPassword}
            onBackPress={() => setAuthScreen('login')}
            onRegisterPress={handleRegister}
          />
        )}
        <StatusBar style="auto" />
      </Animated.ScrollView>
    );
  }

  return (
    <Animated.ScrollView
      style={styles.screen}
      contentContainerStyle={shellStyle}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
    >
      <DashboardPage
        headerStyle={headerStyle}
        isDesktop={isDesktop}
        panelWidth={panelWidth}
        chartWidth={chartWidth}
        mapHeight={mapHeight}
        totalWarnings={totalWarnings}
        warningPalette={warningPalette}
        showRedLocations={showRedLocations}
        showYellowLocations={showYellowLocations}
        signalsRed={signalsRed}
        signalsYellow={signalsYellow}
        location={mapLocation}
        pinColor={pinColor}
        onToggleRed={() => setShowRedLocations((value) => !value)}
        onToggleYellow={() => setShowYellowLocations((value) => !value)}
        onDeleteLocation={handleDeleteLocation}
      />
      <StatusBar style="auto" />
    </Animated.ScrollView>
  );
}