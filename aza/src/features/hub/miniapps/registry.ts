import MyBusinessApp from './MyBusinessApp';
import { MiniAppEntry } from './types';
import { LightColors } from '../../../theme';

export const MINI_APP_REGISTRY: MiniAppEntry[] = [
  {
    id: 'aza_business',
    name: 'Aza Business',
    description: 'Accept payments, manage payouts and API keys',
    icon: require('../../../assets/aza-z.png'),
    category: 'Business',
    component: MyBusinessApp,
  },
];

export function getMiniApp(id: string): MiniAppEntry | undefined {
  return MINI_APP_REGISTRY.find((app) => app.id === id);
}
