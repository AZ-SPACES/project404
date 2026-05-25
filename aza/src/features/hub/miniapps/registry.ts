import AirtimeDataApp from './AirtimeDataApp';
import PayBillsApp from './PayBillsApp';
import BuyTicketsApp from './BuyTicketsApp';
import ExchangeRatesApp from './ExchangeRatesApp';
import MyBusinessApp from './MyBusinessApp';
import { MiniAppEntry } from './types';

export const MINI_APP_REGISTRY: MiniAppEntry[] = [
  {
    id: 'airtime_data',
    name: 'Airtime & Data',
    description: 'Top up airtime and buy data bundles',
    icon: '📱',
    color: '#1565C0',
    category: 'Bills & Utilities',
    component: AirtimeDataApp,
  },
  {
    id: 'pay_bills',
    name: 'Pay Bills',
    description: 'Pay electricity, water, TV and internet bills',
    icon: '⚡',
    color: '#E65100',
    category: 'Bills & Utilities',
    component: PayBillsApp,
  },
  {
    id: 'buy_tickets',
    name: 'Buy Tickets',
    description: 'Get tickets for events and shows',
    icon: '🎟️',
    color: '#6C3483',
    category: 'Entertainment',
    component: BuyTicketsApp,
  },
  {
    id: 'exchange_rates',
    name: 'Exchange Rates',
    description: 'Convert GHS to foreign currencies',
    icon: '💱',
    color: '#00695C',
    category: 'Finance',
    component: ExchangeRatesApp,
  },
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
