import MyBusinessApp from './MyBusinessApp';
import { MiniAppEntry } from './types';

export const MINI_APP_REGISTRY: MiniAppEntry[] = [
  {
    id: 'my_business',
    name: 'My Business',
    description: 'Accept payments, manage payouts and API keys',
    icon: '🏪',
    color: '#174717',
    category: 'Business',
    component: MyBusinessApp,
  },
];

export function getMiniApp(id: string): MiniAppEntry | undefined {
  return MINI_APP_REGISTRY.find((app) => app.id === id);
}
