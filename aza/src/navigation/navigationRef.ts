import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

let navigationQueue: Array<{name: string, params?: any}> = [];

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    navigationQueue.push({name, params});
  }
}

// You can call this when the navigation container is ready
export function processNavigationQueue() {
  if (navigationRef.isReady()) {
    while (navigationQueue.length > 0) {
      const { name, params } = navigationQueue.shift()!;
      navigationRef.navigate(name, params);
    }
  }
}
