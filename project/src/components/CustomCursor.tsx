import React from 'react';
import { useCustomCursor } from '../hooks/useCursor';

export const CustomCursor: React.FC = () => {
  const { cursorRef, cursorDotRef } = useCustomCursor();

  return (
    <>
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 w-7 h-7 pointer-events-none z-50 mix-blend-difference "
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <div className="w-full h-full rounded-full border-2 border-orange-500 opacity-60" />
      </div>
      <div
        ref={cursorDotRef}
        className="fixed top-0 left-0 w-2 h-2 bg-orange-500 rounded-full pointer-events-none z-50 mix-blend-difference"
        style={{ transform: 'translate(-50%, -50%)' }}
      />
    </>
  );
};