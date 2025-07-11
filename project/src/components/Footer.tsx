import { motion } from 'framer-motion';
import { Shield, Twitter, Github, MessageCircle, Globe, Mail } from 'lucide-react';

export function Footer() {
  return (
     <footer className="bg-white dark:bg-black border-t border-orange-500/20 transition-colors duration-300">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <motion.div
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <div className="relative">
                <Shield className="w-8 h-8 text-orange-500" />
                <div className="absolute inset-0 bg-orange-500 blur-xl opacity-50" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                StableGuard
              </span>
            </motion.div>
            <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
              Protecting your stablecoin holdings with decentralized insurance solutions on Solana. 
              Built for the future of DeFi.
            </p>
            <div className="flex space-x-4">
              {[
                { icon: Twitter, href: '#', label: 'Twitter' },
                { icon: Github, href: '#', label: 'GitHub' },
                { icon: MessageCircle, href: '#', label: 'Discord' },
                { icon: Mail, href: '#', label: 'Email' },
              ].map((social, index) => (
                <motion.a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors p-2 rounded-full hover:bg-orange-500/10"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Protocol */}
          <div>
            <h3 className="text-gray-900 dark:text-white font-bold mb-4 text-lg">Protocol</h3>
            <ul className="space-y-3 text-gray-600 dark:text-gray-400 text-sm">
              <li><a href="#" className="hover:text-orange-500 transition-colors">How it Works</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">Governance</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">Tokenomics</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">Security Audits</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-gray-900 dark:text-white font-bold mb-4 text-lg">Resources</h3>
            <ul className="space-y-3 text-gray-600 dark:text-gray-400 text-sm">
              <li><a href="#" className="hover:text-orange-500 transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">Developer Guide</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-gray-900 dark:text-white font-bold mb-4 text-lg">Community</h3>
            <ul className="space-y-3 text-gray-600 dark:text-gray-400 text-sm">
              <li><a href="#" className="hover:text-orange-500 transition-colors">Discord Server</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">Telegram</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">Medium Blog</a></li>
              <li><a href="#" className="hover:text-orange-500 transition-colors">Newsletter</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-orange-500/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            © 2024 StableGuard Protocol. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors text-sm">
              Privacy Policy
            </a>
            <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors text-sm">
              Terms of Service
            </a>
            <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors text-sm">
              Risk Disclosure
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}