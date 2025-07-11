export interface StablecoinPrice {
  symbol: string;
  price: number;
  change24h: number;
  timestamp: number;
}

export interface PolicyCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: string;
  featured?: boolean;
}

export interface InsurancePolicy {
  id: string;
  asset: string;
  coverage: number;
  premium: number;
  expires: Date;
  status: 'active' | 'expired' | 'claimed';
}