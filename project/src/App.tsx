import React from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { CustomCursor } from './components/CustomCursor';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Chart } from './components/Chart';
import { PolicyCards } from './components/PolicyCards';
import { Footer } from './components/Footer';
import { WalletContextProvider } from './providers/WalletProvider';

function App() {
  return (
    <ThemeProvider>
      <WalletContextProvider>
      <div className="relative min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white overflow-x-hidden transition-colors duration-300">
        <CustomCursor />
        <Header />
        <main>
          <Hero />
          <Chart />
          <PolicyCards />
        </main>
        <Footer />
      </div>
      </WalletContextProvider>
    </ThemeProvider>
  );
}

export default App;