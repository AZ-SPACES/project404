// Business/developer apps have deep aza dependencies — they live here.
import MyBusinessApp from './MyBusinessApp';
import DeveloperApp from './DeveloperApp';
import AzaAgentApp from './AzaAgentApp';

// Standalone mini apps — self-contained packages in project404/miniapps/.
import Play2048App from '@miniapps/play-2048';
import SnakeApp from '@miniapps/snake';
import Connect4App from '@miniapps/connect4';
import RadioApp from '@miniapps/radio';
import NotepadApp from '@miniapps/notepad';
import CediratesApp from '@miniapps/cedirates';
import SalifuAndMasterApp from '@miniapps/salifu-and-master';

import { MiniAppEntry } from './types';

export const MINI_APP_REGISTRY: MiniAppEntry[] = [
  {
    id: 'aza_business',
    name: 'Aza Business',
    description: 'Accept payments, manage payouts and API keys',
    icon: require('../../../assets/aza-business.png'),
    category: 'Business',
    component: MyBusinessApp,
  },
  {
    id: 'aza_developer',
    name: 'AZA Developer',
    description: 'Manage OAuth apps and Sign in with AZA',
    icon: require('../../../assets/aza-developer.png'),
    category: 'Business',
    component: DeveloperApp,
  },
  {
    id: 'aza_agent',
    name: 'Aza Agent',
    description: 'Take cash deposits and pay out withdrawals as an AZA agent',
    icon: require('../../../assets/aza-business.png'),
    category: 'Business',
    component: AzaAgentApp,
  },
  {
    id: 'play_2048',
    name: '2048',
    description: 'Join the numbers and get to the 2048 tile!',
    icon: require('../../../assets/2048.png'),
    category: 'Games',
    component: Play2048App,
  },
  {
    id: 'snake',
    name: 'Snake',
    description: 'Eat apples to grow your snake and avoid crashing into walls or yourself!',
    icon: require('../../../assets/snakegame.png'),
    category: 'Games',
    component: SnakeApp,
  },
  {
    id: 'connect4',
    name: 'Connect 4',
    description: 'Connect 4 in a row to win!',
    icon: require('../../../assets/connect4.png'),
    category: 'Games',
    component: Connect4App,
  },
  {
    id: 'radio',
    name: 'Radio',
    description: 'Listen to the radio',
    icon: require('../../../assets/radio.png'),
    category: 'Entertainment',
    component: RadioApp,
  },
  {
    id: 'notepad',
    name: 'Notepad',
    description: 'Take notes',
    icon: require('../../../assets/notepad.png'),
    category: 'Productivity',
    component: NotepadApp,
  },
  {
    id: 'cedirates',
    name: 'CediRates',
    description: 'Live exchange rates and fuel prices',
    icon: require('../../../assets/cedirates.png'),
    category: 'Finance',
    component: CediratesApp,
  },
  {
    id: 'salifu_and_master',
    name: 'Salifu and Master',
    description: 'Play Salifu and Master',
    icon: require('../../../assets/s&m.png'),
    category: 'Games',
    component: SalifuAndMasterApp,
  },
];

export function getMiniApp(id: string): MiniAppEntry | undefined {
  return MINI_APP_REGISTRY.find((app) => app.id === id);
}
