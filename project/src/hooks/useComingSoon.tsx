import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ComingSoonModal } from '../components/ComingSoonModal';

type ComingSoonOptions = {
  title?: string;
  message?: string;
};

type Ctx = {
  openComingSoon: (opts?: ComingSoonOptions) => void;
};

const ComingSoonCtx = createContext<Ctx | null>(null);

export function ComingSoonProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string>('Coming soon');
  const [message, setMessage] = useState<string>('This feature is in progress. Thanks for your patience!');

  const openComingSoon = useCallback((opts?: ComingSoonOptions) => {
    if (opts?.title) setTitle(opts.title);
    if (opts?.message) setMessage(opts.message);
    setOpen(true);
  }, []);

  const onClose = useCallback(() => setOpen(false), []);

  const value = useMemo<Ctx>(() => ({ openComingSoon }), [openComingSoon]);

  return (
    <ComingSoonCtx.Provider value={value}>
      {children}
      <ComingSoonModal open={open} title={title} message={message} onClose={onClose} />
    </ComingSoonCtx.Provider>
  );
}

export function useComingSoon() {
  const ctx = useContext(ComingSoonCtx);
  if (!ctx) throw new Error('useComingSoon must be used within ComingSoonProvider');
  return ctx;
}