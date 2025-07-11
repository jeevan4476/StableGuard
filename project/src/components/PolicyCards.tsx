import { motion } from 'framer-motion';
import { Shield, Eye, TrendingUp, ArrowRight, CheckCircle, Clock, Zap } from 'lucide-react';
import { POLICY_CARDS } from '../lib/constants';

const iconMap = {
  Shield,
  Eye,
  TrendingUp,
};

export function PolicyCards() {
  return (
     <section className="py-20 px-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black transition-colors duration-300">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Insurance Solutions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Comprehensive protection for your stablecoin holdings with transparent, 
            decentralized insurance policies powered by Solana
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {POLICY_CARDS.map((card, index) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap];
            
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className={`group relative backdrop-blur-xl border rounded-2xl p-8 transition-all duration-300 hover:scale-105 cursor-pointer ${
                  card.featured
                    ? 'bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/40 hover:border-orange-400/60'
                    : 'bg-gray-50/80 dark:bg-gray-900/40 border-orange-500/20 hover:bg-orange-50/50 dark:hover:bg-gray-900/60 hover:border-orange-500/40'
                }`}
                whileHover={{ 
                  boxShadow: card.featured 
                    ? "0 0 50px rgba(249, 115, 22, 0.3)" 
                    : "0 0 30px rgba(249, 115, 22, 0.15)" 
                }}
              >
                {card.featured && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="flex items-center justify-center w-16 h-16 mb-6 mx-auto">
                    <motion.div
                      className={`relative ${card.featured ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400'} group-hover:text-orange-500 transition-colors`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Icon className="w-12 h-12" />
                      <div className="absolute inset-0 bg-current blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                    {card.title}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-8 leading-relaxed">
                    {card.description}
                  </p>

                  <motion.button
                    className={`w-full py-3 px-6 rounded-full font-bold transition-all duration-300 flex items-center justify-center space-x-2 ${
                      card.featured
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-lg hover:shadow-orange-500/25'
                        : 'border-2 border-orange-500/50 text-orange-500 hover:border-orange-500 hover:bg-orange-500 hover:text-white'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>{card.action}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          <div className="backdrop-blur-xl bg-gray-50/80 dark:bg-gray-900/40 border border-orange-500/20 rounded-2xl p-8 hover:border-orange-500/40 transition-all duration-300">
            <div className="flex items-center mb-6">
              <CheckCircle className="w-8 h-8 text-orange-500 mr-3" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Why Choose StableGuard?</h3>
            </div>
            <ul className="space-y-4 text-gray-600 dark:text-gray-300">
              <li className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span>Lightning-fast claims on Solana</span>
              </li>
              <li className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span>Audited smart contracts</span>
              </li>
              <li className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span>Transparent governance</span>
              </li>
              <li className="flex items-center space-x-3">
                <TrendingUp className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span>Competitive premiums</span>
              </li>
            </ul>
          </div>

          <div className="backdrop-blur-xl bg-gray-50/80 dark:bg-gray-900/40 border border-orange-500/20 rounded-2xl p-8 hover:border-orange-500/40 transition-all duration-300">
            <div className="flex items-center mb-6">
              <Clock className="w-8 h-8 text-orange-500 mr-3" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Coverage Details</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Depeg Protection</span>
                <span className="text-orange-500 font-bold">Up to 95%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Smart Contract Risk</span>
                <span className="text-orange-500 font-bold">Up to 80%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Oracle Failure</span>
                <span className="text-orange-500 font-bold">Up to 90%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Governance Attack</span>
                <span className="text-orange-500 font-bold">Up to 75%</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}