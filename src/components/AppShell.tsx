import React from 'react';
import { AppScreen, ViewMode } from '../types/engine';
import { useShellChrome } from './ShellChrome';
import { IconButton } from './ui';
import { BrandMark } from './shell/BrandMark';
import { ModelPicker } from './shell/ModelPicker';
import { BottomTabs, HeaderTabs } from './shell/ViewTabs';
import { Sun, Moon, Info } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  activeView: AppScreen;
  onViewChange: (view: ViewMode) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  subtitle?: string;
  onOpenInfoModal?: () => void;
  activeModelName?: string;
  onSelectModel?: (model: string) => void;
  availableModels?: string[];
  isLessonStepOpen?: boolean;
}

/** The app frame: the header (brand, model picker on Explore, the three mode tabs), the screen, and the bottom tab bar on narrow screens. */
export const AppShell: React.FC<AppShellProps> = ({
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
  isLessonStepOpen = false,
}) => {
  const { exploreFullPage: isExploreFullPage, lessonImmersive: isLessonImmersive } = useShellChrome();

  return (
    <div className="w-full h-[100dvh] min-h-[100dvh] bg-[#051116] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Full-Width Aerospace Header (hidden in the Explore full-page layout and in a full-screen lesson) */}
      {!isExploreFullPage && !isLessonImmersive && (
        <header className="w-full px-4 sm:px-6 py-2.5 border-b border-teal-500/20 flex items-center justify-between z-30 bg-[#06141a]/95 backdrop-blur-md shrink-0 shadow-lg">
          {/* Left: Brand & Model Dropdown */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BrandMark />

            <div className="relative flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-2 text-sm font-bold leading-tight tracking-tight text-white sm:text-base">
                <span className="truncate">Piston Engine Fundamentals</span>
                {/* Only where there is room for it on one line: at tablet and landscape-phone widths it would wrap and crowd the tabs. */}
                <span className="hidden xl:inline whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full bg-teal-950/60 border border-teal-500/30 text-teal-300 font-mono font-medium">
                  AEROSPACE CAD 3D
                </span>
              </span>

              {/* The model picker belongs only to Explore; Learn and Check show their mode context. */}
              {activeView === 'explore'
                ? <ModelPicker active={activeModelName} models={availableModels} onSelect={onSelectModel} />
                : <span className="mt-0.5 max-w-[280px] truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-teal-400/80">{subtitle}</span>}
            </div>
          </div>

          {/* Center: Navigation Tabs (the bottom bar takes over on narrow screens) */}
          <HeaderTabs activeView={activeView} onViewChange={onViewChange} />

          {/* Right: Tool Controls */}
          <div className="ml-2 flex shrink-0 items-center gap-2">
            {/* Dark / Light Mode Toggle */}
            <IconButton size="sm" shape="soft" label="Toggle Theme" title="Toggle Theme" onClick={onToggleTheme} className="-my-1.5">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </IconButton>

            {/* Info Modal Button */}
            <IconButton size="sm" shape="soft" label="About Course & Model" title="About Course & Model" onClick={onOpenInfoModal} className="-my-1.5 -mr-1.5">
              <Info className="w-4 h-4" />
            </IconButton>
          </div>
        </header>
      )}

      {/* Dynamic Screen Viewport Area (100% Height & Width) */}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>

      {/* Bottom tab bar for narrow screens; a lesson step brings its own bottom dock instead. */}
      {!isExploreFullPage && !isLessonStepOpen && <BottomTabs activeView={activeView} onViewChange={onViewChange} />}
    </div>
  );
};
