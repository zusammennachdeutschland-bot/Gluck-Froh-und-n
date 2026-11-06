import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { Trophy, Star, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { playLernstudioSound, playGermanVoiceFeedback, isSoundMuted, setSoundMuted } from '../../../utils/lernstudioAudioUtils';

export type AnimationIntensity = 'Full' | 'Reduced' | 'Off';

export interface ParticleBurst {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface ScorePopup {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export interface GameEffectsContextType {
  intensity: AnimationIntensity;
  setIntensity: (val: AnimationIntensity) => void;
  particles: ParticleBurst[];
  popups: ScorePopup[];
  triggerCorrect: (points?: number, label?: string, x?: number, y?: number) => void;
  triggerWrong: (x?: number, y?: number) => void;
  triggerConfetti: () => void;
  triggerSparkles: (x?: number, y?: number, color?: string) => void;
  triggerFloatingText: (text: string, x?: number, y?: number, color?: string) => void;
  triggerScorePopup: (text: string, x?: number, y?: number, colorOrPositive?: boolean | string) => void;
  triggerCelebration: (title?: string, subtitle?: string) => void;
  triggerVictory: (title?: string, subtitle?: string, points?: number) => void;
  victoryData: { title: string; subtitle?: string; points?: number } | null;
  dismissVictory: () => void;
  EffectsOverlay: React.FC;
  SettingsBar: React.FC;
}

const GameEffectsContext = createContext<GameEffectsContextType | null>(null);

export const GameEffectsOverlay: React.FC<{
  particles?: ParticleBurst[];
  popups?: ScorePopup[];
  showConfetti?: boolean;
}> = ({ particles = [], popups = [], showConfetti = false }) => {
  const [intensity, setIntensity] = useState<AnimationIntensity>('Full');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gluck_anim_intensity') as AnimationIntensity;
      if (saved && ['Full', 'Reduced', 'Off'].includes(saved)) {
        setIntensity(saved);
      }
    } catch {}
  }, []);

  if (intensity === 'Off') return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Contextual Particle Sparkles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-full animate-ping"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            boxShadow: `0 0 12px ${p.color}`
          }}
        />
      ))}

      {/* Floating Score & Encouragement Popups */}
      {popups.map((popup) => (
        <div
          key={popup.id}
          className="absolute font-mono font-black text-base sm:text-lg animate-bounce px-3 py-1 rounded-xl bg-slate-900/90 text-white border border-white/15 shadow-lg"
          style={{
            left: `${popup.x}%`,
            top: `${popup.y}%`,
            color: popup.color,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {popup.text}
        </div>
      ))}

      {/* Victory Confetti Streamers */}
      {showConfetti && intensity === 'Full' && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 24 }).map((_, i) => {
            const colors = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#38BDF8'];
            return (
              <div
                key={i}
                className="absolute w-2.5 h-2.5 rounded-xs animate-bounce opacity-80"
                style={{
                  left: `${(i * 4.2) % 98}%`,
                  top: `${10 + ((i * 17) % 65)}%`,
                  backgroundColor: colors[i % colors.length],
                  animationDuration: `${0.8 + (i % 5) * 0.25}s`
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const useGameEffects = (_language?: string): GameEffectsContextType => {
  const ctx = useContext(GameEffectsContext);
  const [localIntensity, setLocalIntensity] = useState<AnimationIntensity>(() => {
    try {
      const saved = localStorage.getItem('gluck_anim_intensity') as AnimationIntensity;
      if (saved && ['Full', 'Reduced', 'Off'].includes(saved)) return saved;
    } catch {}
    return 'Full';
  });
  const [localParticles, setLocalParticles] = useState<ParticleBurst[]>([]);
  const [localPopups, setLocalPopups] = useState<ScorePopup[]>([]);
  const [localShowConfetti, setLocalShowConfetti] = useState(false);
  const [localVictory, setLocalVictory] = useState<{ title: string; subtitle?: string; points?: number } | null>(null);

  const setIntensity = useCallback((val: AnimationIntensity) => {
    setLocalIntensity(val);
    try {
      localStorage.setItem('gluck_anim_intensity', val);
    } catch {}
  }, []);

  const triggerFloatingText = useCallback(
    (text: string, x = 50, y = 45, color = '#10B981') => {
      if (localIntensity === 'Off') return;
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setLocalPopups((prev) => [...prev, { id, text, x, y, color }]);
      setTimeout(() => {
        setLocalPopups((prev) => prev.filter((p) => p.id !== id));
      }, 1100);
    },
    [localIntensity]
  );

  const triggerScorePopup = useCallback(
    (text: string, x = 50, y = 45, colorOrPositive: boolean | string = true) => {
      const color = typeof colorOrPositive === 'string' ? colorOrPositive : colorOrPositive ? '#10B981' : '#EF4444';
      triggerFloatingText(text, x, y, color);
    },
    [triggerFloatingText]
  );

  const triggerSparkles = useCallback(
    (x = 50, y = 45, customColor?: string) => {
      if (localIntensity === 'Off') return;
      const count = localIntensity === 'Reduced' ? 4 : 10;
      const colors = customColor
        ? [customColor, '#F59E0B', '#10B981']
        : ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#38BDF8'];
      const bursts: ParticleBurst[] = Array.from({ length: count }).map((_, idx) => ({
        id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        x: x + (Math.random() * 16 - 8),
        y: y + (Math.random() * 16 - 8),
        color: colors[idx % colors.length]
      }));
      setLocalParticles((prev) => [...prev, ...bursts]);
      setTimeout(() => {
        setLocalParticles((prev) => prev.filter((b) => !bursts.some((nb) => nb.id === b.id)));
      }, 900);
    },
    [localIntensity]
  );

  const triggerCorrect = useCallback(
    (points = 100, label = 'Richtig!', x = 50, y = 45) => {
      if (ctx) {
        ctx.triggerCorrect(points, label, x, y);
        return;
      }
      triggerSparkles(x, y);
      triggerFloatingText(`+${points} ${label}`, x, y, '#10B981');
    },
    [ctx, triggerSparkles, triggerFloatingText]
  );

  const triggerWrong = useCallback(
    (x = 50, y = 45) => {
      if (ctx) {
        ctx.triggerWrong(x, y);
        return;
      }
      triggerFloatingText('Versuch es noch einmal!', x, y, '#EF4444');
    },
    [ctx, triggerFloatingText]
  );

  const triggerConfetti = useCallback(() => {
    if (ctx) {
      ctx.triggerConfetti();
      return;
    }
    setLocalShowConfetti(true);
    triggerSparkles(30, 35);
    triggerSparkles(50, 30);
    triggerSparkles(70, 35);
    setTimeout(() => setLocalShowConfetti(false), 3500);
  }, [ctx, triggerSparkles]);

  const triggerCelebration = useCallback(
    (title?: string, subtitle?: string) => {
      if (ctx) {
        ctx.triggerCelebration(title, subtitle);
        return;
      }
      triggerConfetti();
    },
    [ctx, triggerConfetti]
  );

  const triggerVictory = useCallback(
    (title?: string, subtitle?: string, points?: number) => {
      if (ctx) {
        ctx.triggerVictory(title, subtitle, points);
        return;
      }
      triggerConfetti();
      playLernstudioSound('fanfare_victory');
      if (title) {
        setLocalVictory({ title, subtitle, points });
      }
    },
    [ctx, triggerConfetti]
  );

  const dismissVictory = useCallback(() => {
    if (ctx) {
      ctx.dismissVictory();
      return;
    }
    setLocalVictory(null);
  }, [ctx]);

  const EffectsOverlayComp: React.FC = useCallback(
    () => <GameEffectsOverlay particles={localParticles} popups={localPopups} showConfetti={localShowConfetti} />,
    [localParticles, localPopups, localShowConfetti]
  );

  const SettingsBarComp: React.FC = useCallback(() => <GameSettingsControls compact />, []);

  if (ctx) return ctx;

  return {
    intensity: localIntensity,
    setIntensity,
    particles: localParticles,
    popups: localPopups,
    triggerCorrect,
    triggerWrong,
    triggerConfetti,
    triggerSparkles,
    triggerFloatingText,
    triggerScorePopup,
    triggerCelebration,
    triggerVictory,
    victoryData: localVictory,
    dismissVictory,
    EffectsOverlay: EffectsOverlayComp,
    SettingsBar: SettingsBarComp
  };
};

export const GameEffectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [intensity, setIntensityState] = useState<AnimationIntensity>('Full');
  const [particles, setParticles] = useState<ParticleBurst[]>([]);
  const [popups, setPopups] = useState<ScorePopup[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [victoryData, setVictoryData] = useState<{ title: string; subtitle?: string; points?: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gluck_anim_intensity') as AnimationIntensity;
      if (saved && ['Full', 'Reduced', 'Off'].includes(saved)) {
        setIntensityState(saved);
      } else if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setIntensityState('Reduced');
      }
    } catch {
      // default Full
    }
  }, []);

  const setIntensity = (val: AnimationIntensity) => {
    setIntensityState(val);
    try {
      localStorage.setItem('gluck_anim_intensity', val);
    } catch {}
  };

  // Canvas particle animation
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number; rotation: number; rotSpeed: number }>>([]);
  const animFrameRef = useRef<number | null>(null);

  const triggerConfetti = () => {
    if (intensity === 'Off') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const count = intensity === 'Reduced' ? 25 : 80;
    const colors = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#3B82F6', '#8B5CF6'];

    const newParticles = [];
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;

    for (let i = 0; i < count; i++) {
      newParticles.push({
        x: w / 2 + (Math.random() - 0.5) * 200,
        y: h / 3 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 12 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2
      });
    }

    particlesRef.current = [...particlesRef.current, ...newParticles];
  };

  const triggerFloatingText = (text: string, x = 50, y = 50, color = '#10B981') => {
    if (intensity === 'Off') return;
    const id = Math.random().toString(36).substring(2, 9);
    setFloatingTexts((prev) => [...prev, { id, text, x, y, color }]);
    setPopups((prev) => [...prev, { id, text, x, y, color }]);

    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((item) => item.id !== id));
      setPopups((prev) => prev.filter((item) => item.id !== id));
    }, 1200);
  };

  const triggerScorePopup = (text: string, x = 50, y = 50, colorOrPositive: boolean | string = true) => {
    const color = typeof colorOrPositive === 'string' ? colorOrPositive : colorOrPositive ? '#10B981' : '#EF4444';
    triggerFloatingText(text, x, y, color);
  };

  const triggerSparkles = (x = 50, y = 50, customColor?: string) => {
    if (intensity === 'Off') return;
    const count = intensity === 'Reduced' ? 4 : 8;
    const colors = customColor
      ? [customColor, '#F59E0B', '#10B981']
      : ['#F59E0B', '#10B981', '#6366F1', '#EC4899'];
    const bursts: ParticleBurst[] = Array.from({ length: count }).map((_, idx) => ({
      id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      x: x + (Math.random() * 14 - 7),
      y: y + (Math.random() * 14 - 7),
      color: colors[idx % colors.length]
    }));
    setParticles((prev) => [...prev, ...bursts]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((b) => !bursts.some((nb) => nb.id === b.id)));
    }, 900);
  };

  const triggerCorrect = (points = 100, label = 'Richtig!', x = 50, y = 45) => {
    triggerSparkles(x, y);
    triggerFloatingText(`+${points} ${label}`, x, y, '#10B981');
  };

  const triggerWrong = (x = 50, y = 45) => {
    triggerFloatingText('Versuch es noch einmal!', x, y, '#EF4444');
  };

  const triggerCelebration = () => {
    triggerConfetti();
  };

  const triggerVictory = (title?: string, subtitle?: string, points?: number) => {
    triggerConfetti();
    playLernstudioSound('fanfare_victory');
    playGermanVoiceFeedback('gewonnen');
    if (title) {
      setVictoryData({ title, subtitle, points });
    }
  };

  const dismissVictory = () => {
    setVictoryData(null);
  };

  const EffectsOverlayComp: React.FC = () => (
    <GameEffectsOverlay particles={particles} popups={popups} showConfetti={false} />
  );

  const SettingsBarComp: React.FC = () => <GameSettingsControls compact />;

  // Render particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (particlesRef.current.length > 0) {
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.3; // gravity
          p.rotation += p.rotSpeed;
          p.alpha -= 0.012;

          if (p.alpha > 0) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
          }
        });

        particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <GameEffectsContext.Provider
      value={{
        intensity,
        setIntensity,
        particles,
        popups,
        triggerCorrect,
        triggerWrong,
        triggerConfetti,
        triggerSparkles,
        triggerFloatingText,
        triggerScorePopup,
        triggerCelebration,
        triggerVictory,
        victoryData,
        dismissVictory,
        EffectsOverlay: EffectsOverlayComp,
        SettingsBar: SettingsBarComp
      }}
    >
      {children}

      {/* Global Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={{ display: intensity === 'Off' ? 'none' : 'block' }}
      />

      {/* Floating Texts Layer */}
      {intensity !== 'Off' && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {floatingTexts.map((ft) => (
            <div
              key={ft.id}
              className="absolute font-mono font-black text-lg sm:text-xl animate-bounce transition-all duration-1000 shadow-sm px-2.5 py-1 rounded-xl bg-surface/90 backdrop-blur-sm border border-surface-border"
              style={{
                left: `${ft.x}%`,
                top: `${ft.y}%`,
                color: ft.color,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {ft.text}
            </div>
          ))}
        </div>
      )}

      {/* Global Victory Overlay Modal */}
      {victoryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-surface border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />

            <div className="relative z-10 space-y-4">
              <div className="w-24 h-24 mx-auto bg-amber-500/10 rounded-3xl flex items-center justify-center border-2 border-amber-500/40 animate-bounce p-1.5 shadow-lg">
                <img
                  src="/assets/games/shared_victory_trophy.webp"
                  alt="Victory Trophy"
                  className="w-full h-full object-contain rounded-2xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <Trophy className="w-10 h-10 text-amber-500 absolute opacity-0" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black text-text-main tracking-tight">
                  {victoryData.title}
                </h2>
                {victoryData.subtitle && (
                  <p className="text-xs sm:text-sm font-bold text-text-muted">
                    {victoryData.subtitle}
                  </p>
                )}
              </div>

              {victoryData.points !== undefined && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-600 dark:text-amber-400 font-mono font-black text-lg">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  <span>+{victoryData.points} Points</span>
                </div>
              )}

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    dismissVictory();
                  }}
                  className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm shadow-lg cursor-pointer transition-all"
                >
                  Weiter / Continue 🎉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </GameEffectsContext.Provider>
  );
};

// Controls component for game header/settings
export const GameSettingsControls: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { intensity, setIntensity } = useGameEffects();
  const [muted, setMutedState] = useState(isSoundMuted());

  const toggleSound = () => {
    const next = !muted;
    setMutedState(next);
    setSoundMuted(next);
  };

  const cycleIntensity = () => {
    if (intensity === 'Full') setIntensity('Reduced');
    else if (intensity === 'Reduced') setIntensity('Off');
    else setIntensity('Full');
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Sound Mute Toggle */}
      <button
        type="button"
        onClick={toggleSound}
        className={`${compact ? 'p-1.5' : 'p-2'} rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
          muted
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
            : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
        }`}
        title={muted ? 'Sound Muted' : 'Sound Enabled'}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
      </button>

      {/* Animation Intensity Controller */}
      <button
        type="button"
        onClick={cycleIntensity}
        className={`${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded-xl text-xs font-bold border border-surface-border bg-surface hover:bg-surface-hover text-text-main transition-all cursor-pointer flex items-center gap-1`}
        title="Animation Intensity (Full / Reduced / Off)"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span className="hidden sm:inline">FX:</span>
        <span className="font-mono text-[11px] text-primary">{intensity}</span>
      </button>
    </div>
  );
};
