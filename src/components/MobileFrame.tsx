import React, { useState } from 'react';
import { ViewMode } from '../types/engine';
import {
  Box,
  BookOpen,
  CheckCircle,
  Sun,
  Moon,
  Info,
  Smartphone,
  Monitor,
  ChevronDown,
} from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  subtitle?: string;
  onOpenInfoModal?: () => void;
  activeModelName?: string;
  onSelectModel?: (model: string) => void;
  availableModels?: string[];
  isFullscreen3D?: boolean;
  isLessonStepOpen?: boolean;
  isLessonImmersive?: boolean;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  activeView,
  onViewChange,
  isDarkMode,
  onToggleTheme,
  subtitle = 'GTSIO-520-H · Cylinder study',
  onOpenInfoModal,
  activeModelName = 'Detailed operating cylinder',
  onSelectModel,
  availableModels = [
    'Detailed operating cylinder',
    'Wright 1903 Aero Cylinder',
    'GTSIO-520 Full Engine',
    'Combustion Chamber Section',
  ],
  isFullscreen3D = false,
  isLessonStepOpen = false,
  isLessonImmersive = false,
}) => {
  // Default to whole actual page (desktop full-page mode) with seamless phone shell toggle
  const [isDeviceFrameEnabled, setIsDeviceFrameEnabled] = useState<boolean>(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);

  // -------------------------------------------------------------
  // DESKTOP / FULL-PAGE MODE (Whole Actual Page - No Shell)
  // -------------------------------------------------------------
  if (!isDeviceFrameEnabled) {
    return (
      <div className="w-full h-[100dvh] min-h-[100dvh] bg-[#051116] text-slate-100 flex flex-col relative overflow-hidden">
        {/* Full-Width Desktop Aerospace Header (hidden in Fullscreen 3D) */}
        {!isFullscreen3D && !isLessonImmersive && (
          <header className="w-full px-4 sm:px-6 py-2.5 border-b border-teal-500/20 flex items-center justify-between z-30 bg-[#06141a]/95 backdrop-blur-md shrink-0 shadow-lg">
          {/* Left: Brand & Model Dropdown */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-950/80 border border-teal-400/60 flex items-center justify-center shadow-sm shadow-teal-500/30 shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-300 stroke-current" fill="none" strokeWidth="1.8">
                <rect x="6" y="3" width="12" height="8" rx="1.5" />
                <line x1="6" y1="6" x2="18" y2="6" />
                <line x1="6" y1="8" x2="18" y2="8" />
                <path d="M12 11 L10 17 L14 17 Z" />
                <circle cx="12" cy="18.5" r="2.5" />
              </svg>
            </div>

            <div className="flex flex-col relative">
              <span className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight flex items-center gap-2">
                Piston Engine Fundamentals
                <span className="hidden md:inline text-[11px] px-2 py-0.5 rounded-full bg-teal-950/60 border border-teal-500/30 text-teal-300 font-mono font-medium">
                  AEROSPACE CAD 3D
                </span>
              </span>

              {/* The model picker belongs only to Explore; Learn and Check show their mode context. */}
              {activeView === 'explore' ? <div className="relative">
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="flex items-center gap-1.5 text-[11px] font-mono tracking-wider text-teal-400 hover:text-teal-300 font-semibold uppercase leading-tight mt-0.5 transition-colors group cursor-pointer text-left"
                  aria-label="Select 3D Engine Model"
                >
                  <span className="text-slate-400">MODEL:</span>
                  <span className="text-teal-300 underline decoration-teal-500/40 underline-offset-2">
                    {activeModelName}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-teal-400 group-hover:text-teal-300 shrink-0 transition-transform ${
                      isModelDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isModelDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsModelDropdownOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-[#091b22]/98 backdrop-blur-xl border border-teal-500/40 shadow-2xl p-1.5 z-50 flex flex-col gap-1">
                      <div className="px-3 py-1.5 text-[10px] font-mono text-teal-400 font-bold uppercase tracking-wider border-b border-teal-500/20">
                        Select 3D Engine Assembly
                      </div>
                      {availableModels.map((model) => (
                        <button
                          key={model}
                          onClick={() => {
                            onSelectModel?.(model);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs text-left font-medium transition-all flex items-center justify-between group ${
                            activeModelName === model
                              ? 'bg-teal-500/20 text-teal-200 font-bold border border-teal-400/40 shadow-xs'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span>{model}</span>
                          {activeModelName === model && (
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-xs shadow-teal-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div> : <span className="mt-0.5 max-w-[280px] truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-teal-400/80">{subtitle}</span>}
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-teal-500/20">
            <button
              onClick={() => onViewChange('explore')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'explore'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-xs shadow-teal-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>3D Explore</span>
            </button>

            <button
              onClick={() => onViewChange('learn')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'learn'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-xs shadow-teal-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Guided Lessons</span>
            </button>

            <button
              onClick={() => onViewChange('check')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'check'
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-xs shadow-teal-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Knowledge Check</span>
            </button>
          </nav>

          {/* Right: Viewport Toggle & Tool Controls */}
          <div className="flex items-center gap-2">
            {/* Viewport Mode Switcher (Full Page vs Phone Mockup) */}
            <button
              onClick={() => setIsDeviceFrameEnabled(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-teal-500/30 hover:border-teal-400 text-xs font-semibold text-teal-300 transition-all shadow-xs active:scale-95"
              title="Preview inside Mobile Phone Shell"
            >
              <Smartphone className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Phone Shell</span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-teal-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Info Modal Button */}
            <button
              onClick={onOpenInfoModal}
              className="w-8 h-8 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-teal-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="About Course & Model"
              aria-label="About Course & Model"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </header>
        )}

        {/* Dynamic Screen Viewport Area (100% Height & Width) */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {children}
        </main>

        {/* Mobile Screen Bottom Tab Bar fallback for narrow desktop/tablet screens */}
        {!isFullscreen3D && !isLessonStepOpen && (
          <nav className="md:hidden relative z-40 bg-[#061014]/95 backdrop-blur-md border-t border-teal-500/20 py-2 px-6 shrink-0">
            <div className="grid grid-cols-3 items-center">
              <button
                onClick={() => onViewChange('explore')}
                className={`flex flex-col items-center gap-1 py-1 transition-colors ${
                  activeView === 'explore' ? 'text-teal-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Box className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-medium tracking-tight">Explore</span>
              </button>

              <button
                onClick={() => onViewChange('learn')}
                className={`flex flex-col items-center gap-1 py-1 transition-colors ${
                  activeView === 'learn' ? 'text-teal-400 font-bold' : 'text-slate-400'
                }`}
              >
                <BookOpen className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-medium tracking-tight">Learn</span>
              </button>

              <button
                onClick={() => onViewChange('check')}
                className={`flex flex-col items-center gap-1 py-1 transition-colors ${
                  activeView === 'check' ? 'text-teal-400 font-bold' : 'text-slate-400'
                }`}
              >
                <CheckCircle className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-medium tracking-tight">Check</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    );
  }

  // If in Phone Shell mode and user clicks 3D fullscreen, expand to fill entire browser window
  if (isFullscreen3D || isLessonImmersive) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-[100dvh] bg-[#061014] text-slate-100 flex flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  // -------------------------------------------------------------
  // MOBILE DEVICE FRAME PREVIEW MODE (Phone Shell)
  // -------------------------------------------------------------
  return (
    <div className="w-full min-h-[100dvh] bg-[#03080a] text-slate-100 flex flex-col items-center justify-center p-2 sm:p-4 relative overflow-x-hidden">
      {/* Top Outer Floating Switcher */}
      <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-slate-900/90 border border-teal-500/30 backdrop-blur-md text-xs z-50 shadow-lg">
        <span className="text-[11px] font-mono text-slate-400">VIEWPORT:</span>
        <button
          onClick={() => setIsDeviceFrameEnabled(false)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Full Page Desktop</span>
        </button>
        <button
          onClick={() => setIsDeviceFrameEnabled(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-teal-500 text-slate-950 shadow-xs shadow-teal-500/50"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Phone Shell</span>
        </button>
      </div>

      {/* Main Container / Mobile Device Bezel */}
      <div className="w-full max-w-[430px] h-[915px] sm:rounded-[52px] sm:ring-8 sm:ring-[#1a2327] sm:border-4 sm:border-[#09151a] sm:shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative transition-all duration-300 flex flex-col bg-[#061014] overflow-hidden">
        {/* iPhone Dynamic Island & Status Bar */}
        {!isLessonImmersive && <div className="pt-3 px-7 pb-1 flex items-center justify-between text-xs text-white z-40 bg-[#061014] shrink-0">
          <span className="font-semibold text-[13px] tracking-tight">16:56</span>

          {/* Centered Dynamic Island Cutout */}
          <div className="w-28 h-6 bg-black rounded-full flex items-center justify-end pr-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0a1518] ring-1 ring-[#1b2b30] flex items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-[#1b3c43]" />
            </span>
          </div>

          {/* Right Status Icons */}
          <div className="flex items-center gap-1.5 text-slate-200">
            <svg className="w-4 h-3 fill-current" viewBox="0 0 24 16">
              <rect x="1" y="11" width="3" height="5" rx="1" />
              <rect x="6" y="8" width="3" height="8" rx="1" />
              <rect x="11" y="4" width="3" height="12" rx="1" />
              <rect x="16" y="1" width="3" height="15" rx="1" />
            </svg>
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z" />
            </svg>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold font-mono">92</span>
              <div className="w-5 h-2.5 border border-slate-300 rounded-sm p-0.5 flex items-center">
                <div className="w-full h-full bg-white rounded-xs" />
              </div>
            </div>
          </div>
        </div>}

        {/* Global App Header */}
        {!isLessonImmersive && <header className="px-5 py-2.5 border-b border-teal-500/10 flex items-center justify-between z-30 bg-[#061014]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-950/60 border border-teal-400/50 flex items-center justify-center shadow-xs shadow-teal-500/30 shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-300 stroke-current" fill="none" strokeWidth="1.8">
                <rect x="6" y="3" width="12" height="8" rx="1.5" />
                <line x1="6" y1="6" x2="18" y2="6" />
                <line x1="6" y1="8" x2="18" y2="8" />
                <path d="M12 11 L10 17 L14 17 Z" />
                <circle cx="12" cy="18.5" r="2.5" />
              </svg>
            </div>

            <div className="flex flex-col relative">
              <span className="text-sm font-bold text-white tracking-tight leading-tight">
                Piston Engine Fundamentals
              </span>

              {activeView === 'explore' ? (
                <div className="relative">
                  <button
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="flex items-center gap-1 text-[10px] font-mono tracking-wider text-teal-400 hover:text-teal-300 font-semibold uppercase leading-tight mt-0.5 transition-colors group cursor-pointer text-left"
                    aria-label="Select 3D Engine Model"
                  >
                    <span className="truncate max-w-[190px]">{activeModelName}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-teal-400 group-hover:text-teal-300 shrink-0 transition-transform ${
                        isModelDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isModelDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsModelDropdownOpen(false)}
                      />
                      <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl bg-[#091b22]/98 backdrop-blur-xl border border-teal-500/40 shadow-2xl p-1.5 z-50 flex flex-col gap-1">
                        <div className="px-2 py-1 text-[9px] font-mono text-teal-400 font-bold uppercase tracking-wider border-b border-teal-500/20">
                          Select 3D Model
                        </div>
                        {availableModels.map((model) => (
                          <button
                            key={model}
                            onClick={() => {
                              onSelectModel?.(model);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs text-left font-medium transition-all flex items-center justify-between group ${
                              activeModelName === model
                                ? 'bg-teal-500/20 text-teal-200 font-bold border border-teal-400/40'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{model}</span>
                            {activeModelName === model && (
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-[10px] font-mono tracking-wider text-teal-400/80 font-semibold uppercase leading-tight mt-0.5 truncate max-w-[200px]">
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-full bg-slate-900/60 border border-slate-700/60 hover:border-teal-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={onOpenInfoModal}
              className="w-8 h-8 rounded-full bg-slate-900/60 border border-slate-700/60 hover:border-teal-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="About Course & Model"
              aria-label="About Course & Model"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </header>}

        {/* Dynamic Screen Viewport Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {children}
        </main>

        {/* Fixed Bottom Tab Navigation Bar */}
        {!isLessonStepOpen && <nav className="relative z-40 bg-[#061014]/95 backdrop-blur-md border-t border-teal-500/20 pt-2 pb-4 px-6 shrink-0">
          <div className="grid grid-cols-3 items-center">
            <button
              onClick={() => onViewChange('explore')}
              className={`flex flex-col items-center gap-1 relative py-1 transition-colors ${
                activeView === 'explore'
                  ? 'text-teal-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[11px] font-medium tracking-tight">Explore</span>
              {activeView === 'explore' && (
                <span className="w-8 h-0.5 bg-teal-400 rounded-full mt-0.5 shadow-xs shadow-teal-400" />
              )}
            </button>

            <button
              onClick={() => onViewChange('learn')}
              className={`flex flex-col items-center gap-1 relative py-1 transition-colors ${
                activeView === 'learn'
                  ? 'text-teal-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[11px] font-medium tracking-tight">Learn</span>
              {activeView === 'learn' && (
                <span className="w-8 h-0.5 bg-teal-400 rounded-full mt-0.5 shadow-xs shadow-teal-400" />
              )}
            </button>

            <button
              onClick={() => onViewChange('check')}
              className={`flex flex-col items-center gap-1 relative py-1 transition-colors ${
                activeView === 'check'
                  ? 'text-teal-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[11px] font-medium tracking-tight">Check</span>
              {activeView === 'check' && (
                <span className="w-8 h-0.5 bg-teal-400 rounded-full mt-0.5 shadow-xs shadow-teal-400" />
              )}
            </button>
          </div>

          {/* iPhone Home Indicator Pill */}
          <div className="w-32 h-1 bg-white/60 rounded-full mx-auto mt-3" />
        </nav>}
      </div>
    </div>
  );
};
