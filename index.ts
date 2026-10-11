import { registerRootComponent } from 'expo';

import App from './App';
import { registerWidgets } from './src/widgets/register';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
// Home-screen widgets draw in the background through this handler (Android only).
registerWidgets();
