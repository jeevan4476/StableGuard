import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ComingSoonModal({
  open,
  title = 'Coming soon',
  message = 'This feature is in progress. Thanks for your patience!',
  onClose,
}: {
  open: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const close = () => onClose();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const content = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            ref={backdropRef}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === backdropRef.current) close();
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coming-soon-title"
            className="relative z-[1001] w-[92%] max-w-md rounded-2xl border border-orange-500/30 bg-white p-6 shadow-2xl dark:bg-gray-900"
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <button
              aria-label="Close"
              onClick={close}
              className="absolute right-3 top-3 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 flex items-center gap-3">
              <div className="relative">
                <Clock className="h-6 w-6 text-orange-500" />
                <div className="absolute inset-0 blur-lg opacity-40 bg-orange-500" />
              </div>
              <h3 id="coming-soon-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={close}
                className="rounded-md border border-orange-500/50 px-4 py-2 text-sm font-medium text-orange-600 hover:border-orange-500 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10"
              >
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}