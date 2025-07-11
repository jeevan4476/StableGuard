import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { STABLECOINS } from '../lib/constants';
import type { StablecoinPrice } from '../lib/types';

// Mock data generator for demo purposes
const generateMockData = () => {
  const data = [];
  const now = Date.now();
  
  for (let i = 30; i >= 0; i--) {
    const timestamp = now - (i * 60 * 1000); // 1 minute intervals
    data.push({
      time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp,
      USDT: 1.0 + (Math.random() - 0.5) * 0.02, // Small fluctuations around $1
      USDC: 1.0 + (Math.random() - 0.5) * 0.015,
    });
  }
  
  return data;
};

export function Chart() {
  const [data, setData] = useState(generateMockData);
  const [prices, setPrices] = useState<Record<string, StablecoinPrice>>({
    USDT: { symbol: 'USDT', price: 1.0002, change24h: 0.08, timestamp: Date.now() },
    USDC: { symbol: 'USDC', price: 0.9998, change24h: -0.12, timestamp: Date.now() },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time updates
      const newPoint = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        USDT: 1.0 + (Math.random() - 0.5) * 0.02,
        USDC: 1.0 + (Math.random() - 0.5) * 0.015,
      };

      setData(prev => [...prev.slice(1), newPoint]);
      
      // Update current prices
      setPrices(prev => ({
        USDT: {
          ...prev.USDT,
          price: newPoint.USDT,
          change24h: (Math.random() - 0.5) * 0.5,
          timestamp: Date.now(),
        },
        USDC: {
          ...prev.USDC,
          price: newPoint.USDC,
          change24h: (Math.random() - 0.5) * 0.5,
          timestamp: Date.now(),
        },
      }));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
     <div className="bg-white/95 dark:bg-black/95 backdrop-blur-sm border border-orange-500/30 rounded-lg p-3 shadow-xl">
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-900 dark:text-white font-medium">
              {entry.dataKey}: ${entry.value.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-white to-gray-50 dark:from-black dark:to-gray-900 transition-colors duration-300">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-orange-500 mr-3" />
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
              Live Price Feeds
            </h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Real-time stablecoin prices powered by Pyth Network oracles, updating every few seconds
          </p>
        </motion.div>

        {/* Price Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
        >
          {Object.entries(prices).map(([symbol, priceData]) => (
            <motion.div
              key={symbol}
              className="border border-orange-500/20 rounded-2xl p-6  transition-all duration-300"
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(249, 115, 22, 0.05)' }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: STABLECOINS[symbol as keyof typeof STABLECOINS].color }}
                  >
                    {symbol}
                  </div>
                  <div>
                    <h3 className="text-gray-900 dark:text-white font-semibold text-lg">{STABLECOINS[symbol as keyof typeof STABLECOINS].name}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${priceData.price.toFixed(4)}
                  </div>
                  <div className={`flex items-center space-x-1 ${priceData.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {priceData.change24h >= 0 ? 
                      <TrendingUp className="w-4 h-4" /> : 
                      <TrendingDown className="w-4 h-4" />
                    }
                    <span className="font-medium">
                      {priceData.change24h >= 0 ? '+' : ''}{priceData.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="backdrop-blur-xl bg-gray-50/80 dark:bg-gray-900/40 border border-orange-500/20 rounded-2xl p-6 hover:border-orange-500/30 transition-all duration-300"
        >
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="usdtGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STABLECOINS.USDT.color} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={STABLECOINS.USDT.color} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="usdcGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STABLECOINS.USDC.color} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={STABLECOINS.USDC.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" className="dark:stroke-gray-600" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  domain={['dataMin - 0.001', 'dataMax + 0.001']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `$${value.toFixed(4)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="USDT"
                  stroke={STABLECOINS.USDT.color}
                  fillOpacity={1}
                  fill="url(#usdtGradient)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="USDC"
                  stroke={STABLECOINS.USDC.color}
                  fillOpacity={1}
                  fill="url(#usdcGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </section>
  );
}