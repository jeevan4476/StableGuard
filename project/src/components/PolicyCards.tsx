import { motion } from 'framer-motion';
import {
  Shield,
  Eye,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Zap,
  Layers,
  ArrowDown,
} from 'lucide-react';
import { POLICY_CARDS } from '../lib/constants';
import { useComingSoon } from '../hooks/useComingSoon';

const iconMap = {
  Shield,
  Eye,
  TrendingUp,
};

export function PolicyCards() {
    const {openComingSoon} = useComingSoon();

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
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Comprehensive protection for your stablecoin holdings with transparent,
            decentralized insurance policies powered by Solana.
          </p>
        </motion.div>

        {/* Primary actions */}
        <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {POLICY_CARDS.map((card, index) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap];

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className={`group relative cursor-pointer rounded-2xl border p-8 backdrop-blur-xl transition-all duration-300 hover:scale-105 ${
                  card.featured
                    ? 'border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-orange-600/5 hover:border-orange-400/60'
                    : 'border-orange-500/20 bg-gray-50/80 hover:border-orange-500/40 hover:bg-orange-50/50 dark:bg-gray-900/40 dark:hover:bg-gray-900/60'
                }`}
                whileHover={{
                  boxShadow: card.featured
                    ? '0 0 50px rgba(249, 115, 22, 0.3)'
                    : '0 0 30px rgba(249, 115, 22, 0.15)',
                }}
              >
                {card.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
                    <div className="rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-1 text-sm font-bold text-white">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center">
                    <motion.div
                      className={`relative ${
                        card.featured ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400'
                      } transition-colors group-hover:text-orange-500`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    >
                      <Icon className="h-12 w-12" />
                      <div className="absolute inset-0 opacity-30 blur-xl transition-opacity group-hover:opacity-50" />
                    </motion.div>
                  </div>

                  <h3 className="mb-4 text-center text-2xl font-bold text-gray-900 dark:text-white">
                    {card.title}
                  </h3>

                  <p className="mb-8 text-center leading-relaxed text-gray-600 dark:text-gray-400">
                    {card.description}
                  </p>

                  <motion.button
                  onClick={() =>
                    openComingSoon({
                      title: `${card.title} — coming soon`,
                      message:
                        'We’re putting the final touches on this flow. Follow updates in Docs and Twitter!',
                    })
                  }
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

        {/* How it works + Tranche architecture */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 gap-8 md:grid-cols-2"
        >
          {/* Added id for smooth-scroll target */}
          <div
            id="how-stableguard-works"
            className="rounded-2xl border border-orange-500/20 bg-gray-50/80 p-8 backdrop-blur-xl transition-all duration-300 hover:border-orange-500/40 dark:bg-gray-900/40"
          >
            <div className="mb-6 flex items-center">
              <Zap className="mr-3 h-8 w-8 text-orange-500" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                How StableGuard Works
              </h3>
            </div>

            <ol className="space-y-4 text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-600">
                  1
                </span>
                <div>
                  <p className="font-medium">Buy Protection</p>
                  <p className="text-sm">
                    Users choose a stablecoin, depeg threshold, coverage amount, and duration.
                    The app fetches a premium quote and creates an on-chain policy upon confirmation.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-600">
                  2
                </span>
                <div>
                  <p className="font-medium">Provide Liquidity</p>
                  <p className="text-sm">
                    Liquidity providers deposit into risk tranches. Premiums collected from policies flow
                    to LPs according to tranche rules.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-600">
                  3
                </span>
                <div>
                  <p className="font-medium">Depeg Detection & Claims</p>
                  <p className="text-sm">
                    If a covered depeg occurs during the policy window, the protocol triggers claims
                    using on-chain rules and external oracle signals.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-600">
                  4
                </span>
                <div>
                  <p className="font-medium">Payouts via Loss Waterfall</p>
                  <p className="text-sm">
                    Claims are paid from tranche liquidity using a pre-defined loss waterfall,
                    preserving senior capital until junior capacity is exhausted.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Tranche Architecture (unchanged) */}
          <div className="rounded-2xl border border-orange-500/20 bg-gray-50/80 p-8 backdrop-blur-xl transition-all duration-300 hover:border-orange-500/40 dark:bg-gray-900/40">
            <div className="mb-6 flex items-center">
              <Layers className="mr-3 h-8 w-8 text-orange-500" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Tranche Architecture
              </h3>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Senior Tranche</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last-loss capital with highest payout priority in the waterfall. Targets lower volatility
                  with correspondingly lower premium share.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Junior Tranche</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  First-loss capital that absorbs losses before other tranches. Earns the highest share of premiums
                  to compensate for higher risk.
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-orange-500/40 p-4">
                <p className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
                  Loss Waterfall (claims consume capital from bottom to top)
                </p>
                <div className="flex flex-col items-center gap-2 text-xs">
                  <div className="w-full rounded-md bg-gray-900/5 p-2 text-gray-700 dark:bg-white/5 dark:text-gray-300">
                    Senior (last-loss)
                  </div>
                  <ArrowDown className="h-4 w-4 text-orange-500" />
                  <div className="w-full rounded-md bg-orange-500/10 p-2 text-orange-700 dark:text-orange-300">
                    Junior (first-loss)
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-gray-500">
                  Premiums are distributed by tranche rules; claims are paid by consuming Junior first,
                   then Senior.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}