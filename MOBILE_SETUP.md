# React Native Mobile App Setup Guide

## ✅ Backend is Ready!

Your backend has been updated with CORS support and is now ready to accept connections from mobile apps. All API endpoints will work seamlessly with your React Native app.

---

## 📱 Step-by-Step: Creating Your React Native App

### Step 1: Create React Native Project

Open a terminal **outside of this Replit project** and run:

```bash
# Create new React Native app with TypeScript
npx react-native init BudgetWiseMobile --template react-native-template-typescript

# Navigate into the project
cd BudgetWiseMobile
```

---

### Step 2: Install Required Dependencies

```bash
# Install all necessary packages
npm install @tanstack/react-query axios react-native-document-picker @react-native-async-storage/async-storage react-native-pdf
npm install -D @types/react-native-document-picker

# For iOS (if on Mac)
cd ios && pod install && cd ..
```

---

### Step 3: Create Project Structure

Create these folders in your React Native project:

```bash
mkdir -p src/screens
mkdir -p src/components
mkdir -p src/services
mkdir -p src/types
mkdir -p src/utils
```

---

## 📂 Core Files to Create

### File 1: `src/services/api.ts` - API Client

```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT: Replace this with your actual Replit URL
const API_BASE_URL = 'https://your-app.replit.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests automatically
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - logout
      await AsyncStorage.removeItem('authToken');
      // Navigate to login (you'll implement this)
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

### File 2: `src/services/authService.ts` - Authentication

```typescript
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
}

export const authService = {
  async login(credentials: LoginCredentials) {
    const response = await api.post('/auth/login', credentials);
    const { token, user } = response.data;
    
    // Save token
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    
    return { token, user };
  },

  async signup(data: SignupData) {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  async logout() {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
  },

  async getCurrentUser() {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  async isAuthenticated() {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  },

  async forgotPassword(email: string) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token: string, password: string) {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  }
};
```

---

### File 3: `src/services/analysisService.ts` - Budget Analysis

```typescript
import api from './api';

export const analysisService = {
  async uploadBankStatement(file: any, monthlyIncome: string) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);
    formData.append('monthlyIncome', monthlyIncome);

    const response = await api.post('/analysis/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  async getAnalysis(id: string) {
    const response = await api.get(`/analysis/${id}`);
    return response.data;
  },

  async getAllAnalyses() {
    const response = await api.get('/analysis');
    return response.data;
  },

  async downloadReport(id: string) {
    const response = await api.get(`/analysis/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  }
};
```

---

### File 4: `src/screens/LoginScreen.tsx` - Login UI

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { authService } from '../services/authService';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await authService.login({ email, password });
      navigation.replace('Home');
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BudgetWise</Text>
      <Text style={styles.subtitle}>Manage your finances with AI</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        testID="input-email"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="input-password"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
        testID="button-login"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Signup')}
        testID="button-signup-nav"
      >
        <Text style={styles.linkText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        testID="button-forgot-password"
      >
        <Text style={styles.linkText}>Forgot Password?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#6b7280',
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    color: '#3b82f6',
    textAlign: 'center',
    marginTop: 10,
  },
});
```

---

### File 5: `src/screens/UploadScreen.tsx` - File Upload

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { analysisService } from '../services/analysisService';

export default function UploadScreen({ navigation }: any) {
  const [file, setFile] = useState<any>(null);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.xls, DocumentPicker.types.xlsx],
      });
      setFile(result[0]);
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Error', 'Failed to pick file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      Alert.alert('Error', 'Please select a file');
      return;
    }

    if (!monthlyIncome || parseFloat(monthlyIncome) <= 0) {
      Alert.alert('Error', 'Please enter a valid monthly income');
      return;
    }

    setUploading(true);
    try {
      const result = await analysisService.uploadBankStatement(file, monthlyIncome);
      navigation.navigate('Results', { analysisId: result.analysisId });
    } catch (error: any) {
      Alert.alert('Upload Failed', error.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Bank Statement</Text>

      <TouchableOpacity
        style={styles.fileButton}
        onPress={pickFile}
        testID="button-pick-file"
      >
        <Text style={styles.fileButtonText}>
          {file ? file.name : 'Select PDF or Excel File'}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Monthly Income (e.g., 5000)"
        value={monthlyIncome}
        onChangeText={setMonthlyIncome}
        keyboardType="numeric"
        testID="input-monthly-income"
      />

      <TouchableOpacity
        style={[styles.button, uploading && styles.buttonDisabled]}
        onPress={handleUpload}
        disabled={uploading}
        testID="button-upload"
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Analyze Expenses</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#1f2937',
  },
  fileButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 20,
  },
  fileButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

---

### File 6: `src/screens/ResultsScreen.tsx` - Display Analysis

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { analysisService } from '../services/analysisService';

export default function ResultsScreen({ route }: any) {
  const { analysisId } = route.params;
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalysis();
    
    // Poll every 3 seconds if still processing
    const interval = setInterval(() => {
      if (analysis?.analysisStatus === 'pending') {
        loadAnalysis();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [analysisId, analysis?.analysisStatus]);

  const loadAnalysis = async () => {
    try {
      const data = await analysisService.getAnalysis(analysisId);
      setAnalysis(data);
    } catch (error) {
      console.error('Failed to load analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading analysis...</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load analysis</Text>
      </View>
    );
  }

  const isProcessing = analysis.analysisStatus === 'pending';
  const monthlyIncome = parseFloat(analysis.monthlyIncome);
  const actualNeedsPercent = analysis.actualNeeds
    ? Math.round((parseFloat(analysis.actualNeeds) / monthlyIncome) * 100)
    : 0;
  const actualWantsPercent = analysis.actualWants
    ? Math.round((parseFloat(analysis.actualWants) / monthlyIncome) * 100)
    : 0;
  const actualSavingsPercent = analysis.actualSavings
    ? Math.round((parseFloat(analysis.actualSavings) / monthlyIncome) * 100)
    : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Budget Analysis</Text>

      {isProcessing ? (
        <View style={styles.processingCard}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.processingText}>
            AI is analyzing your expenses...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Spending</Text>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Needs (50%)</Text>
              <Text style={styles.statValue}>{actualNeedsPercent}%</Text>
              <Text style={styles.statAmount}>${analysis.actualNeeds}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Wants (30%)</Text>
              <Text style={styles.statValue}>{actualWantsPercent}%</Text>
              <Text style={styles.statAmount}>${analysis.actualWants}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Savings (20%)</Text>
              <Text style={styles.statValue}>{actualSavingsPercent}%</Text>
              <Text style={styles.statAmount}>${analysis.actualSavings}</Text>
            </View>
          </View>

          {analysis.recommendations && (
            <View style={styles.recommendationsCard}>
              <Text style={styles.recommendationsTitle}>
                AI Recommendations
              </Text>
              <Text style={styles.recommendationsText}>
                {analysis.recommendations}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937',
  },
  processingCard: {
    backgroundColor: '#dbeafe',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#1e40af',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#374151',
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginVertical: 5,
  },
  statAmount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  recommendationsCard: {
    backgroundColor: '#dbeafe',
    padding: 20,
    borderRadius: 10,
    marginTop: 20,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e40af',
  },
  recommendationsText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1e3a8a',
  },
  loadingText: {
    marginTop: 10,
    color: '#6b7280',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
});
```

---

### File 7: `App.tsx` - Navigation Setup

Replace your `App.tsx` with:

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LoginScreen from './src/screens/LoginScreen';
import UploadScreen from './src/screens/UploadScreen';
import ResultsScreen from './src/screens/ResultsScreen';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Home" 
            component={UploadScreen}
            options={{ title: 'Upload Statement' }}
          />
          <Stack.Screen 
            name="Results" 
            component={ResultsScreen}
            options={{ title: 'Analysis Results' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
```

**Note:** You'll need to install navigation dependencies:

```bash
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
```

For iOS: `cd ios && pod install && cd ..`

---

## 🔑 Important Configuration

### Update API URL

In `src/services/api.ts`, replace:

```typescript
const API_BASE_URL = 'https://your-app.replit.app/api';
```

With your actual Replit URL (you'll get this when you publish your app).

---

## 🚀 Running Your Mobile App

### Android:
```bash
npx react-native run-android
```

### iOS (Mac only):
```bash
npx react-native run-ios
```

---

## 🧪 Testing the Connection

1. **Start your Replit backend** (already running with CORS enabled)
2. **Run your React Native app**
3. **Try logging in** - if it works, your mobile app is connected!

---

## 📱 Features Implemented

✅ Login/Signup with JWT authentication  
✅ Bank statement upload (PDF/Excel)  
✅ AI expense analysis with polling  
✅ Results display with 50/30/20 breakdown  
✅ Loading states and error handling  
✅ AsyncStorage for token persistence  
✅ Automatic token injection in API calls  

---

## 🎨 Next Steps

### Recommended Enhancements:

1. **Add Navigation Drawer** - For easy access to all screens
2. **Add History Screen** - Show all past analyses
3. **Add Profile Screen** - User settings and logout
4. **Add Dark Mode** - Using React Native's Appearance API
5. **Add Push Notifications** - Alert when analysis completes
6. **Add Biometric Auth** - Face ID/Touch ID for login
7. **Offline Support** - Cache analyses locally
8. **Add Charts** - Visual spending breakdown

---

## 🐛 Troubleshooting

### Connection Issues:
- Make sure your Replit app is published and running
- Check that the API_BASE_URL is correct
- Verify CORS is enabled (it is!)

### File Upload Issues:
- Ensure permissions are set in AndroidManifest.xml / Info.plist
- Check file size limits (10MB on backend)

### Authentication Issues:
- Clear AsyncStorage: `await AsyncStorage.clear()`
- Check token format in headers
- Verify backend logs for auth errors

---

## 📚 Additional Resources

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [TanStack Query](https://tanstack.com/query/latest/docs/react/overview)
- [Axios Documentation](https://axios-http.com/docs/intro)

---

## 🎉 You're All Set!

Your backend is ready and your mobile app structure is complete. Just:

1. Create the React Native project
2. Copy the code examples above
3. Update the API URL
4. Run the app
5. Start building amazing mobile features!

**Questions?** Check the troubleshooting section or review the code comments for guidance.
