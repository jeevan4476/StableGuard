import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-orange-500/20 bg-white transition-colors duration-300 dark:bg-black">
      <div className="mx-auto max-w-7xl px-8 py-10">
        {/* Flex container for left and right alignment */}
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Left: Brand */}
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            <div className="relative">
              <Shield className="h-8 w-8 text-orange-500" />
              <div className="absolute inset-0 opacity-40 blur-xl bg-orange-500" />
            </div>
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-xl font-bold text-transparent">
              StableGuard
            </span>
          </motion.div>

          {/* Right: Links */}
          <div className="flex items-center gap-8 text-sm text-gray-600 dark:text-gray-400">
            <a
              href="https://www.notion.so/StableGuard-1f1af37c754a8065a53bf578a5624459"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-500 transition-colors"
            >
              Docs
            </a>
            <a
              href="https://github.com/jeevan4476/StableGuard"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-500 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/_Jeevan_R"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-500 transition-colors"
            >
              Twitter
            </a>
          </div>
        </div>

        {/* Description under brand */}
        <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-400 md:mt-6">
          Decentralized insurance on Solana to hedge stablecoin depeg risk and enable underwriting to earn premiums.
        </p>
      </div>
    </footer>
  );
}
