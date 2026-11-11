// Web Audio API Continuous Alarm Synthesizer
// Generates loud, customizable, continuous alarm tones with vibration for pre-lesson alerts

export type AlarmTone = 'digital' | 'loud_bell' | 'radar' | 'gentle_chime';

class AlarmAudioService {
  private audioCtx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private loopTimer: any = null;
  private safetyTimer: any = null;
  private vibrationTimer: any = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeGainNodes: GainNode[] = [];
  private onStopCallbacks: Set<() => void> = new Set();

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Pre-unlock AudioContext on user interaction
  public unlockAudio() {
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {}
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public onStop(callback: () => void) {
    this.onStopCallbacks.add(callback);
    return () => {
      this.onStopCallbacks.delete(callback);
    };
  }

  private originalTitle: string = '';
  private titleFlashTimer: any = null;

  /**
   * Starts playing a continuous alarm sound for the specified duration or until stopped.
   * Uses ahead-of-time Web Audio scheduling so sound plays smoothly even when the tab/window is in the background or minimized.
   * @param tone Type of alarm tone to play
   * @param maxDurationSeconds Duration in seconds before auto-shutoff (e.g. 60)
   */
  public startAlarm(tone: AlarmTone = 'digital', maxDurationSeconds: number = 60) {
    if (this.isPlaying) {
      this.stopAlarm();
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isPlaying = true;

    // Flash document title if window is blurred/hidden
    this.startTitleFlashing();

    // Setup media session notification on mobile/desktop lockscreen
    this.setupMediaSession();

    // Schedule audio bursts in chunks ahead of time so background throttling won't stop the alarm
    const cycleDuration = tone === 'radar' ? 0.8 : tone === 'gentle_chime' ? 2.0 : 1.1;
    const totalDuration = Math.min(180, Math.max(5, maxDurationSeconds));
    
    // Immediately pre-schedule cycles for the entire duration or up to 60 seconds
    const scheduleWindow = Math.min(totalDuration, 60);
    const cyclesToSchedule = Math.ceil(scheduleWindow / cycleDuration);
    
    const startTime = ctx.currentTime + 0.05;
    for (let i = 0; i < cyclesToSchedule; i++) {
      const cycleStart = startTime + i * cycleDuration;
      if (cycleStart - ctx.currentTime > totalDuration) break;
      this.playToneCycleAt(tone, ctx, cycleStart);
    }

    // Secondary interval for extra long alarms to schedule further if needed
    if (totalDuration > scheduleWindow) {
      this.loopTimer = setInterval(() => {
        if (!this.isPlaying) return;
        const currentCtx = this.getAudioContext();
        if (!currentCtx) return;
        this.playToneCycleAt(tone, currentCtx, currentCtx.currentTime + 0.05);
      }, cycleDuration * 1000);
    }

    // Vibration loop on devices supporting navigator.vibrate
    this.startVibrationLoop();

    // Auto-stop safety timer so it doesn't run forever
    const maxMs = totalDuration * 1000;
    this.safetyTimer = setTimeout(() => {
      this.stopAlarm();
    }, maxMs);
  }

  private startTitleFlashing() {
    if (typeof document === 'undefined') return;
    this.originalTitle = document.title;
    let toggle = false;
    this.titleFlashTimer = setInterval(() => {
      if (!this.isPlaying) return;
      document.title = toggle ? '⏰ [منبه الحصة يرن الآن!]' : '🔔 انقر للدخول إلى الحصة';
      toggle = !toggle;
    }, 800);
  }

  private stopTitleFlashing() {
    if (this.titleFlashTimer) {
      clearInterval(this.titleFlashTimer);
      this.titleFlashTimer = null;
    }
    if (typeof document !== 'undefined' && this.originalTitle) {
      document.title = this.originalTitle;
    }
  }

  private setupMediaSession() {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '⏰ منبه موعد الحصة القادمة',
          artist: 'تطبيق المعلم الذكي',
          album: 'تنبيهات الحصص',
          artwork: [
            { src: '/icon.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon.png', sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          this.stopAlarm();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          this.stopAlarm();
        });
      } catch {}
    }
  }

  private startVibrationLoop() {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate([500, 200, 500, 200, 500, 600]);
        this.vibrationTimer = setInterval(() => {
          if (!this.isPlaying) return;
          try {
            navigator.vibrate([500, 200, 500, 200, 500, 600]);
          } catch {}
        }, 2500);
      } catch {}
    }
  }

  private playToneCycleAt(tone: AlarmTone, ctx: AudioContext, atTime: number) {
    if (!this.isPlaying) return;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }

    switch (tone) {
      case 'digital':
        this.playDigitalBurst(ctx, atTime);
        break;
      case 'loud_bell':
        this.playBellStroke(ctx, atTime, 587.33); // D5
        this.playBellStroke(ctx, atTime + 0.35, 880); // A5
        break;
      case 'radar':
        this.playRadarPulse(ctx, atTime);
        break;
      case 'gentle_chime':
        this.playChimeNote(ctx, atTime, 523.25, 0.4); // C5
        this.playChimeNote(ctx, atTime + 0.25, 659.25, 0.4); // E5
        this.playChimeNote(ctx, atTime + 0.50, 783.99, 0.4); // G5
        this.playChimeNote(ctx, atTime + 0.75, 1046.50, 0.6); // C6
        break;
    }
  }

  private playToneCycle(tone: AlarmTone) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    this.playToneCycleAt(tone, ctx, ctx.currentTime);
  }

  // Tone 1: Digital Alarm (Beep-beep-beep-beep)
  private playDigitalBurst(ctx: AudioContext, startTime: number) {
    const beepDuration = 0.08;
    const gap = 0.05;
    const frequencies = [920, 1150, 920, 1150];

    frequencies.forEach((freq, idx) => {
      const t = startTime + idx * (beepDuration + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square'; // Piercing square wave for classic alarm clock sound
      osc.frequency.setValueAtTime(freq, t);

      // Volume envelope
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
      gain.gain.setValueAtTime(0.25, t + beepDuration - 0.01);
      gain.gain.linearRampToValueAtTime(0, t + beepDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + beepDuration);

      this.trackNodes(osc, gain);
    });
  }

  // Tone 2: Loud Bell
  private playBellStroke(ctx: AudioContext, startTime: number, baseFreq: number) {
    const duration = 0.7;
    [1, 2, 2.76, 3.8].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * mult, startTime);

      const peakVol = (0.28 / (i + 1));
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peakVol, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      this.trackNodes(osc, gain);
    });
  }

  // Tone 3: Radar Pulse
  private playRadarPulse(ctx: AudioContext, startTime: number) {
    const duration = 0.35;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, startTime);
    osc.frequency.exponentialRampToValueAtTime(980, startTime + duration);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.trackNodes(osc, gain);
  }

  // Tone 4: Gentle Chime Note
  private playChimeNote(ctx: AudioContext, startTime: number, freq: number, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.trackNodes(osc, gain);
  }

  private trackNodes(osc: OscillatorNode, gain: GainNode) {
    this.activeOscillators.push(osc);
    this.activeGainNodes.push(gain);

    osc.onended = () => {
      this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
      this.activeGainNodes = this.activeGainNodes.filter(g => g !== gain);
    };
  }

  /**
   * Immediately stops any ongoing alarm audio and vibration.
   */
  public stopAlarm() {
    this.isPlaying = false;

    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }

    if (this.vibrationTimer) {
      clearInterval(this.vibrationTimer);
      this.vibrationTimer = null;
    }

    // Stop title flashing
    this.stopTitleFlashing();

    // Stop vibration immediately
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {}
    }

    // Stop active audio nodes
    try {
      this.activeOscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      });
      this.activeGainNodes.forEach(g => {
        try {
          g.disconnect();
        } catch {}
      });
    } catch {}

    this.activeOscillators = [];
    this.activeGainNodes = [];

    // Notify listeners
    this.onStopCallbacks.forEach(cb => {
      try {
        cb();
      } catch {}
    });
  }

  /**
   * Preview a tone for 4 seconds to test sound in settings.
   */
  public previewTone(tone: AlarmTone = 'digital') {
    this.startAlarm(tone, 4);
  }
}

export const alarmAudioService = new AlarmAudioService();

// Global touch unlocker
if (typeof window !== 'undefined') {
  const unlock = () => {
    alarmAudioService.unlockAudio();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}
