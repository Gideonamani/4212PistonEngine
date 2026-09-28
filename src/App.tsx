import React, { useState, useEffect } from 'react';
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import { ViewMode, type CourseTrack, type QuizModule } from './types/engine';
import { MobileFrame } from './components/MobileFrame';
import { ExploreView } from './components/ExploreView';
import { LearnView } from './components/LearnView';
import { CheckView } from './components/CheckView';
import { EngineInfoModal } from './components/EngineInfoModal';
import { loadProductionData } from './data/loadProductionData';

const viewFromHash = (): ViewMode => {
  const value = location.hash.replace(/^#\/?/, '').split('/')[0];
  return value === 'learn' || value === 'check' ? value : 'explore';
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewMode>(viewFromHash);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [activeModelName, setActiveModelName] = useState<string>('Detailed operating cylinder');
  const [isExploreViewerOpen, setIsExploreViewerOpen] = useState<boolean>(false);
  const [isFullscreen3D, setIsFullscreen3D] = useState<boolean>(false);
  const [tracks, setTracks] = useState<CourseTrack[]>([]);
  const [quizModules, setQuizModules] = useState<QuizModule[]>([]);
  const [loadError, setLoadError] = useState<string>('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [quizLessonId, setQuizLessonId] = useState<string>();
  const [isLessonStepOpen, setIsLessonStepOpen] = useState(false);
  const [isLessonImmersive, setIsLessonImmersive] = useState(false);

  const availableModels = [
    'Detailed operating cylinder',
    'Full six-cylinder engine',
  ];

  useEffect(() => {
    let current = true;
    setLoadError('');
    loadProductionData()
      .then((data) => {
        if (!current) return;
        setTracks(data.tracks);
        setQuizModules(data.quizModules);
      })
      .catch((error: unknown) => {
        if (current) setLoadError(error instanceof Error ? error.message : 'The curriculum could not be loaded.');
      });
    return () => { current = false; };
  }, [loadAttempt]);

  useEffect(() => {
    const sync = () => setActiveView(viewFromHash());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  // Sync dark class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle ESC key to exit fullscreen 3D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen3D) {
        setIsFullscreen3D(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen3D]);

  // Determine top header subtitle based on active screen (matching screenshots)
  const getHeaderSubtitle = () => {
    switch (activeView) {
      case 'explore':
        return isExploreViewerOpen ? `GTSIO-520-H · ${activeModelName}` : 'GTSIO-520-H · MODEL LIBRARY';
      case 'learn':
        return 'GTSIO-520-H · GUIDED LESSONS';
      case 'check':
        return 'GTSIO-520-H · KNOWLEDGE CHECK';
      default:
        return 'GTSIO-520-H';
    }
  };

  const handleViewChange = (view: ViewMode) => {
    setIsFullscreen3D(false);
    setIsExploreViewerOpen(false);
    setQuizLessonId(undefined);
    setActiveView(view);
    history.replaceState(null, '', `${location.pathname}${location.search}#/${view}`);
  };

  const curriculumState = loadError ? (
    <div className="flex h-full items-center justify-center bg-[#061014] p-6 text-slate-200">
      <div className="max-w-sm rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-rose-300" />
        <h2 className="mt-3 font-bold text-white">Curriculum unavailable</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">{loadError}</p>
        <button onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2 text-xs font-bold text-slate-950"><RefreshCw className="h-4 w-4" />Try again</button>
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center bg-[#061014] text-teal-300"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" /><span className="text-sm">Loading published curriculum…</span></div>
  );

  return (
    <>
      <MobileFrame
        activeView={activeView}
        onViewChange={handleViewChange}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        subtitle={getHeaderSubtitle()}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        activeModelName={activeView === 'explore' && !isExploreViewerOpen ? 'Choose a 3D study' : activeModelName}
        onSelectModel={(model) => {
          setActiveModelName(model);
          setIsExploreViewerOpen(true);
        }}
        availableModels={availableModels}
        isFullscreen3D={isFullscreen3D}
        isLessonStepOpen={isLessonStepOpen}
        isLessonImmersive={isLessonImmersive}
      >
        {activeView === 'explore' && (
          <ExploreView
            activeModelName={activeModelName}
            isViewerOpen={isExploreViewerOpen}
            onSelectModel={(model) => {
              setActiveModelName(model);
              setIsExploreViewerOpen(true);
            }}
            isFullscreen3D={isFullscreen3D}
            onToggleFullscreen={() => setIsFullscreen3D((prev) => !prev)}
          />
        )}
        {activeView === 'learn' && (tracks.length ? (
          <LearnView
            tracks={tracks}
            onLessonStepModeChange={setIsLessonStepOpen}
            onLessonImmersiveChange={setIsLessonImmersive}
            onTakeLessonQuiz={(lessonId) => {
              setQuizLessonId(lessonId);
              setActiveView('check');
              history.pushState(null, '', `${location.pathname}${location.search}#/check`);
            }}
            onSwitchToExploreModel={(modelName) => {
              if (availableModels.includes(modelName)) setActiveModelName(modelName);
              setIsFullscreen3D(false);
              setIsExploreViewerOpen(true);
              setActiveView('explore');
              history.replaceState(null, '', `${location.pathname}${location.search}#/explore`);
            }}
          />
        ) : curriculumState)}
        {activeView === 'check' && (quizModules.length ? <CheckView modules={quizModules} focusLessonId={quizLessonId} /> : curriculumState)}
      </MobileFrame>

      <EngineInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </>
  );
}
