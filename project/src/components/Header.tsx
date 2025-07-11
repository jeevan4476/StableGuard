import { motion } from 'framer-motion';
import { Shield, Sun, Moon, Wallet } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const {connected,Publikey} = useWallet();
  return (
    <motion.header
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8,ease:"easeOut" }}
      className="fixed top-0 left-0 right-0 z-40 ">
        <div className="max-w-7xl mx-auto">
        <div className="bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-800/50">
          <div className="flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <motion.div
            className="flex items-center spdoing vace-x-3"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <div className="relative">
              <Shield className="w-8 h-8 text-orange-500" />
              <div className="absolute inset-0 bg-orange-500 blur-xl opacity-50 animate-pulse" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              StableGuard
            </span>
          </motion.div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8 px-2">
            {['Protocol', 'Insurance', 'Analytics', 'Docs'].map((item) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 transition-colors font-medium"
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {item}
              </motion.a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <motion.button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-900/50 backdrop-blur-sm border border-orange-500/20 hover:bg-gray-200 dark:hover:bg-gray-800/50 hover:border-orange-500/40 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {theme === 'dark' ? 
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : 
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              }
            </motion.button>

            <div
              className="wallet-adapter-react-ui">
              <WalletMultiButton className="!bg-white hover:!bg-primary-600 !rounded-lg !px-4 !py-2 !text-sm !font-medium !transition-all !duration-200" />
            </div>
            {connected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-success-100 dark:bg-success-900/30 border border-success-200 dark:border-success-800"
                >
                  <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-success-700 dark:text-success-300">
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