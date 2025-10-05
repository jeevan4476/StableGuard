import { motion } from 'framer-motion';
import { Shield, ArrowRight, Users, DollarSign, ArrowDown } from 'lucide-react';

export function Hero() {
  const handleMoreInfo = () => {
    const el = document.getElementById('how-stableguard-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white dark:bg-black transition-colors duration-300">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Concentric Rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute border border-orange-500/10 dark:border-orange-500/10 rounded-full"
              style={{ width: `${(i + 1) * 180}px`, height: `${(i + 1) * 180}px` }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 6, delay: i * 0.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>

        {/* Gradient Orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 dark:bg-orange-500/20 rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-600/8 dark:bg-orange-600/15 rounded-full blur-3xl"
          animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Subtle Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(249,115,22,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center mb-8">
            <motion.div className="relative" transition={{ duration: 0.8 }}>
              <Shield className="w-20 h-20 text-orange-500" />
              <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-40 animate-pulse" />
            </motion.div>
          </div>

          <motion.h1
            className="text-7xl md:text-9xl font-black mb-6 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <span className="bg-gradient-to-r from-gray-900 via-orange-200 to-orange-400 dark:from-white dark:via-orange-200 dark:to-orange-400 bg-clip-text text-transparent">
              Stable
            </span>
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Guard
            </span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            A decentralized insurance protocol on Solana to hedge stablecoin depeg
            risk and enable underwriting to earn premiums.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
        >
          <motion.button
            onClick={handleMoreInfo}
            className="group relative min-w-[220px] rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-2xl"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-center justify-center space-x-2">
              <span>More info</span>
              <ArrowDown className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
            </div>
            <div className="absolute inset-0 rounded-full bg-white/20 blur-xl transition-all duration-300 group-hover:bg-white/30" />
          </motion.button>
        </motion.div>

        {/* Stats section (values already set to placeholders earlier) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
        >
          {[
            { label: 'Total Value Locked', value: 'XXXX', icon: DollarSign, color: 'text-green-500' },
            { label: 'Active Policies', value: 'XXXX', icon: Shield, color: 'text-orange-500' },
            { label: 'Community Members', value: 'XXXX', icon: Users, color: 'text-blue-500' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              className="border border-orange-500/20 rounded-2xl p-6 text-center transition-all duration-300 hover:border-orange-500/40"
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(249, 115, 22, 0.05)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <stat.icon className={`mx-auto mb-3 h-8 w-8 ${stat.color}`} />
              <div className="mb-1 text-3xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 transform"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="flex h-10 w-6 justify-center rounded-full border-2 border-orange-500">
          <motion.div
            className="mt-2 h-3 w-1 rounded-full bg-orange-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}