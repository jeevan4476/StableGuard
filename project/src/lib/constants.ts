export const STABLECOINS = {
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    // Brand green
    color: '#26A17B',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    // Brand blue
    color: '#2775CA',
  },
} as const;

export const POLICY_CARDS = [
  {
    id: 'buy-insurance',
    title: 'Buy Insurance',
    description:
      'Protect your stablecoin holdings with comprehensive coverage against depegging and smart contract risks',
    icon: 'Shield',
    action: 'Get Protected',
    featured: true,
  },
  {
    id: 'view-coverage',
    title: 'View Coverage',
    description:
      'Monitor your active insurance policies, track claims, and manage your protection portfolio',
    icon: 'Eye',
    action: 'View Policies',
  },
  {
    id: 'become-underwriter',
    title: 'Become Underwriter',
    description:
      'Earn rewards by providing insurance capital and help secure the protocol ecosystem',
    icon: 'TrendingUp',
    action: 'Start Earning',
  },
] as const;

export const THEME_COLORS = {
  light: {
    background: 'bg-gray-50',
    surface: 'bg-white',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    border: 'border-gray-200',
  },
  dark: {
    background: 'bg-black',
    surface: 'bg-gray-900',
    text: 'text-white',
    textSecondary: 'text-gray-300',
    border: 'border-gray-800',
  },
} as const;