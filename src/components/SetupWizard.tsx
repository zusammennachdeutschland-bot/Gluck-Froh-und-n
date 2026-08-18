import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, Globe, Coins, ChevronDown } from 'lucide-react';
import { AppLanguage } from '../types';
import { motion } from 'motion/react';

export const SetupWizard: React.FC = () => {
  const { profile, updateProfile, setLanguage, t, _t } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [language, setLocalLanguage] = useState<AppLanguage>('de');
  const [currency, setCurrency] = useState('EGP');

  if (profile.displayName !== 'Teacher') {
    return null;
  }

  const handleComplete = () => {
    updateProfile({
      displayName: displayName.trim() || 'Teacher',
      language,
      currency
    });
    setLanguage(language);
  };

  const floatingIcons = [
    { icon: '📚', delay: 0, top: '-5%', left: '5%' },
    { icon: '👨‍🎓', delay: 0.5, top: '15%', right: '-5%' },
    { icon: '📝', delay: 1, bottom: '20%', left: '-10%' },
    { icon: '💰', delay: 1.5, bottom: '-5%', right: '10%' },
    { icon: '📊', delay: 2, top: '-15%', right: '25%' }
  ];

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-sans">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            x: [0, 50, -50, 0], 
            y: [0, 30, -30, 0],
            scale: [1, 1.1, 0.9, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-blue-400/30 dark:bg-blue-600/20 blur-[80px] mix-blend-multiply dark:mix-blend-screen" 
        />
        <motion.div 
          animate={{ 
            x: [0, -40, 40, 0], 
            y: [0, -40, 40, 0],
            scale: [1, 1.2, 0.8, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-purple-400/30 dark:bg-purple-600/20 blur-[100px] mix-blend-multiply dark:mix-blend-screen" 
        />
        <motion.div 
          animate={{ 
            x: [0, 30, -30, 0], 
            y: [0, -50, 50, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] rounded-full bg-emerald-400/20 dark:bg-emerald-600/10 blur-[90px] mix-blend-multiply dark:mix-blend-screen" 
        />
      </div>

      <div className="relative z-10 w-full h-full overflow-y-auto flex flex-col">
        <div className="m-auto w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center p-4 sm:p-8 gap-8 lg:gap-24 py-8 pt-[calc(max(24px,env(safe-area-inset-top,24px))+16px)] pb-[calc(max(16px,env(safe-area-inset-bottom,16px))+24px)]">
        
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative w-full max-w-[420px] lg:mt-0 mt-8"
        >
          {/* Floating Educational Icons */}
          <div className="absolute inset-0 pointer-events-none hidden sm:block">
            {floatingIcons.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + item.delay, duration: 0.5 }}
                className="absolute"
                style={{ top: item.top, left: item.left, right: item.right, bottom: item.bottom }}
              >
                <motion.div
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: item.delay }}
                  className="w-14 h-14 rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/50 dark:border-slate-600/50 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-center text-2xl"
                >
                  {item.icon}
                </motion.div>
              </motion.div>
            ))}
          </div>

          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/60 dark:border-slate-700/50 p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-center relative z-10 overflow-hidden group">
             {/* Glass reflection */}
             <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/40 to-transparent dark:from-white/5 dark:via-white/10 dark:to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
             
             <motion.img 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                src="./logo.png" 
                alt="Glück Logo" 
                className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6 sm:mb-8 drop-shadow-2xl rounded-2xl sm:rounded-[32px]" 
             />
             <motion.h1 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-4xl sm:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 mb-2 sm:mb-3 tracking-tight"
             >
                Glück
             </motion.h1>
             <motion.h2 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-lg sm:text-xl font-bold text-primary mb-4 sm:mb-5"
             >
                German Teacher Assistant
             </motion.h2>
             <motion.p 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed"
             >
               Manage students, lessons, payments, homework and parent communication in one beautiful workspace.
             </motion.p>
          </div>
        </motion.div>

        {/* Setup Form */}
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="relative w-full max-w-[420px] flex flex-col"
        >
          {/* Form Panel */}
          <div className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-3xl border border-white/50 dark:border-slate-700/50 p-5 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-[0_12px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] relative z-10">
            <div className="space-y-6">
              
              <div className="group">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-widest ml-1">
                  Teacher Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 dark:text-slate-400 group-focus-within:text-primary transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Herr Schmidt"
                    className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md border border-white/60 dark:border-slate-700/60 rounded-2xl sm:rounded-[20px] focus:ring-2 focus:ring-primary focus:bg-white/60 dark:focus:bg-slate-900/60 font-bold text-slate-900 dark:text-white text-base outline-none transition-all placeholder:text-slate-500/70 dark:placeholder:text-slate-500/70 shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-widest ml-1">
                    Language
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400 group-focus-within:text-primary transition-colors">
                      <Globe className="w-4 h-4" />
                    </div>
                    <select
                      value={language}
                      onChange={(e) => setLocalLanguage(e.target.value as AppLanguage)}
                      className="w-full pl-10 pr-8 py-3.5 sm:py-4 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md border border-white/60 dark:border-slate-700/60 rounded-2xl sm:rounded-[20px] focus:ring-2 focus:ring-primary focus:bg-white/60 dark:focus:bg-slate-900/60 font-bold text-slate-900 dark:text-white text-sm outline-none transition-all shadow-inner appearance-none cursor-pointer"
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                
                <div className="group">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-widest ml-1">
                    Currency
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400 group-focus-within:text-primary transition-colors">
                      <Coins className="w-4 h-4" />
                    </div>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full pl-10 pr-8 py-3.5 sm:py-4 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md border border-white/60 dark:border-slate-700/60 rounded-2xl sm:rounded-[20px] focus:ring-2 focus:ring-primary focus:bg-white/60 dark:focus:bg-slate-900/60 font-bold text-slate-900 dark:text-white text-sm outline-none transition-all shadow-inner appearance-none cursor-pointer"
                    >
                      <option value="EGP">EGP</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleComplete}
              disabled={!displayName.trim()}
              className="mt-8 sm:mt-10 w-full py-3.5 sm:py-4 rounded-[20px] sm:rounded-[24px] font-black text-lg text-white bg-gradient-to-r from-primary to-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              <span className="text-2xl drop-shadow-md">🚀</span> Start Teaching
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  </div>
  );
};