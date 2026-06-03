import MyBusinessApp from './MyBusinessApp';
import Play2048App from './Play2048App';
import Snake from './Snakegame';
import Connect4 from './Connect4';
import Radio from './Radio';
import Notepad from './Notepad';
import CediratesApp from './CediratesApp';
import SalifuAndMaster from './Salifuandmaster';
import { MiniAppEntry } from './types';

export const MINI_APP_REGISTRY: MiniAppEntry[] = [
  {
    id: 'aza_business',
    name: 'Aza Business',
    description: 'Accept payments, manage payouts and API keys',
    icon: require('../../../assets/aza-z.png'),
    category: 'Business',
    component: MyBusinessApp,
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
    component: Snake,
  },
  {
    id: 'connect4',
    name: 'Connect 4',
    description: 'Connect 4 in a row to win!',
    icon: require('../../../assets/connect4.png'),
    category: 'Games',
    component: Connect4,
  },
  {
    id: 'radio',
    name: 'Radio',
    description: 'Listen to the radio',
    icon: require('../../../assets/radio.png'),
    category: 'Entertainment',
    component: Radio,
  },
  {
    id: 'notepad',
    name: 'Notepad',
    description: 'Take notes',
    icon: require('../../../assets/notepad.png'),
    category: 'Productivity',
    component: Notepad,
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
    component: SalifuAndMaster,
  }
];

export function getMiniApp(id: string): MiniAppEntry | undefined {
  return MINI_APP_REGISTRY.find((app) => app.id === id);
}
