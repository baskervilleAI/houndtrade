import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

// Optimizaciones para debugging de cámara:
// - Timings optimizados para mejor respuesta de interacciones
// - Logs duplicados prevenidos 
// - Throttling reducido para mayor responsividad
// - Cooldown de cámara optimizado
registerRootComponent(App);
