import { motion } from 'framer-motion';
import { Shield, Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { connected } = useWallet();

  return (
    <motion.header
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-40"
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-800/50 mt-3">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Logo */}
            <motion.div
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <div className="relative">
                <Shield className="h-8 w-8 text-orange-500" />
                <div className="absolute inset-0 bg-orange-500 blur-xl opacity-50 animate-pulse" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                StableGuard
              </span>
            </motion.div>

            {/* Navigation (removed unwanted links) */}
            <nav className="hidden md:flex items-center px-2">
              {/* Intentionally left empty to remove placeholder/unused links */}
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-900/50 backdrop-blur-sm border border-orange-500/20 hover:bg-gray-200 dark:hover:bg-gray-800/50 hover:border-orange-500/40 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                )}
              </motion.button>

              <div className="wallet-adapter-react-ui">
                <WalletMultiButton className="!bg-white hover:!bg-primary-600 !rounded-lg !px-4 !py-2 !text-sm !font-medium !transition-all !duration-200" />
              </div>

              {connected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
                >
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Connected
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}