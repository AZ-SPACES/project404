import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScanQRScreen from './ScanQRScreen';
import MyCodeScreen from './MyCodeScreen';

const Stack = createNativeStackNavigator();

const ScanScreen = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="MyCode">
        {(props) => (
          <MyCodeScreen 
            {...props} 
            onToggle={() => props.navigation.navigate('ScanQR')} 
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ScanQR">
        {(props) => (
          <ScanQRScreen 
            {...props} 
            onToggle={() => props.navigation.navigate('MyCode')} 
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default ScanScreen;
