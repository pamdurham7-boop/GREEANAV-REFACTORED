import { Animated, Pressable, Text, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { styles } from './styles';

type HeaderStyle = StyleProp<ViewStyle>;

type LoginPageProps = {
  headerStyle: HeaderStyle;
  cardWidth: number;
  username: string;
  password: string;
  loginError: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRegisterPress: () => void;
  onLoginPress: () => void;
};

type RegisterPageProps = {
  headerStyle: HeaderStyle;
  cardWidth: number;
  registerFullName: string;
  registerUsername: string;
  registerPassword: string;
  registerConfirmPassword: string;
  registerError: string;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onBackPress: () => void;
  onRegisterPress: () => void;
};

export function LoginPage({
  headerStyle,
  cardWidth,
  username,
  password,
  loginError,
  onUsernameChange,
  onPasswordChange,
  onRegisterPress,
  onLoginPress,
}: LoginPageProps) {
  return (
    <Animated.View style={[styles.pageShell, headerStyle]}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>Use the placeholder credentials to continue.</Text>

      <Animated.View style={[styles.loginCard, { width: cardWidth }]}>
        <TextInput
          style={styles.input}
          placeholder="admin"
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={onUsernameChange}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="1234"
          placeholderTextColor="#64748B"
          secureTextEntry
          value={password}
          onChangeText={onPasswordChange}
          returnKeyType="done"
          onSubmitEditing={onLoginPress}
        />
        {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressRow]}
            onPress={onRegisterPress}
          >
            <Text style={styles.secondaryButtonText}>Register user</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.loginButton, pressed && styles.pressRow]}
            onPress={onLoginPress}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export function RegisterPage({
  headerStyle,
  cardWidth,
  registerFullName,
  registerUsername,
  registerPassword,
  registerConfirmPassword,
  registerError,
  onFullNameChange,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onBackPress,
  onRegisterPress,
}: RegisterPageProps) {
  return (
    <Animated.View style={[styles.pageShell, headerStyle]}>
      <Text style={styles.title}>Register</Text>
      <Text style={styles.subtitle}>Create a local user account stored on this device.</Text>

      <Animated.View style={[styles.loginCard, { width: cardWidth }]}>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#64748B"
          autoCapitalize="words"
          value={registerFullName}
          onChangeText={onFullNameChange}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
          value={registerUsername}
          onChangeText={onUsernameChange}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748B"
          secureTextEntry
          value={registerPassword}
          onChangeText={onPasswordChange}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#64748B"
          secureTextEntry
          value={registerConfirmPassword}
          onChangeText={onConfirmPasswordChange}
          returnKeyType="done"
          onSubmitEditing={onRegisterPress}
        />
        {registerError ? <Text style={styles.loginError}>{registerError}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressRow]}
            onPress={onBackPress}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.loginButton, pressed && styles.pressRow]}
            onPress={onRegisterPress}
          >
            <Text style={styles.loginButtonText}>Create account</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}