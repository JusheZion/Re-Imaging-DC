/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import UpscalerInterface from './components/UpscalerInterface';
import ApiKeyModal from './components/ApiKeyModal';

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        // @ts-ignore
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          // @ts-ignore
          const has = await window.aistudio.hasSelectedApiKey();
          setHasKey(has);
        } else {
          // Fallback for local dev if window.aistudio is not injected
          setHasKey(true);
        }
      } catch (error) {
        console.error("Failed to check API key status:", error);
        // If the check fails, default to showing the modal so the user isn't stuck
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  if (hasKey === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono text-sm animate-pulse">
        Initializing Neural Link...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden relative selection:bg-cyan-500/30">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/20 blur-[150px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-blue-600/20 blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        {/* Cyber Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 h-screen">
        {!hasKey ? (
          <ApiKeyModal onKeySelected={() => setHasKey(true)} />
        ) : (
          <UpscalerInterface />
        )}
      </div>
    </div>
  );
}
