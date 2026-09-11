import { motion } from 'motion/react';
import { Key, ShieldAlert } from 'lucide-react';

declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<void>;
      hasSelectedApiKey?: () => Promise<boolean>;
    };
  }
}

export default function ApiKeyModal({ onKeySelected }: { onKeySelected: () => void }) {
  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      onKeySelected();
    } else {
      onKeySelected();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-50">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-cyan-500/10 rounded-full border border-cyan-500/20">
            <Key className="w-8 h-8 text-cyan-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white mb-2 tracking-tight">Neural Link Required</h2>
        <p className="text-slate-400 text-center mb-6 text-sm">
          To access the high-resolution image processing matrix (Gemini 3.1 Pro Image), you must provide your own API key.
        </p>

        <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 mb-6 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300">
            <p className="mb-1">This application uses paid Google Cloud services.</p>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
              View billing documentation
            </a>
          </div>
        </div>

        <button
          onClick={handleSelectKey}
          className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium transition-all duration-200 shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)] hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.6)] active:scale-[0.98]"
        >
          Initialize Connection
        </button>
      </motion.div>
    </div>
  );
}
