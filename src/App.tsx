import React, { useState, useEffect } from 'react';
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import { AppScreen, ViewMode, type CourseTrack, type QuizModule } from './types/engine';
import { AppShell } from './components/AppShell';
import { ExploreView } from './components/ExploreView';
import { LearnView } from './components/LearnView';
import { CheckView } from './components/CheckView';
import { CreditsView } from './components/CreditsView';
import { EngineInfoModal } from './components/EngineInfoModal';
import { useShellChrome } from './components/ShellChrome';
import { loadProductionData } from './data/loadProductionData';
import { modelRegistry, modelsById, modelsByLabel } from './data/modelRegistry';
import { resolveLearn } from './routes/route.mjs';
import { navigate, useRoute } from './routes/useRoute';

const requestedModelName = () => modelsById[new URLSearchParams(location.search).get('model') || '']?.label;

export default function App() {
  const route = useRoute();
  const activeView: AppScreen = route.view;
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [activeModelName, setActiveModelName] = useState<string>(() => requestedModelName() || 'Detailed operating cylinder');
  const [isExploreViewerOpen, setIsExploreViewerOpen] = useState<boolean>(() => Boolean(requestedModelName()));
  const { exploreFullPage: isExploreFullPage, setExploreFullPage: setIsExploreFullPage } = useShellChrome();
  const [tracks, setTracks] = useState<CourseTrack[]>([]);
  const [quizModules, setQuizModules] = useState<QuizModule[]>([]);
  const [loadError, setLoadError] = useState<string>('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [quizLessonId, setQuizLessonId] = useState<string>();

  const availableModels = modelRegistry.map((model) => model.label);

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

  // Sync dark class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Escape exits the in-app full-page layout. Browser fullscreen has its own native Escape handling.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExploreFullPage && !document.fullscreenElement) {
        setIsExploreFullPage(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExploreFullPage]);

  // Determine top header subtitle based on active screen (matching screenshots)
  const getHeaderSubtitle = () => {
    switch (activeView) {
      case 'explore':
        return isExploreViewerOpen
          ? modelsByLabel[activeModelName]?.headerLabel ?? `GTSIO-520-H · ${activeModelName}`
          : 'GTSIO-520-H · MODEL LIBRARY';
      case 'learn':
        return 'GTSIO-520-H · GUIDED LESSONS';
      case 'check':
        return 'GTSIO-520-H · KNOWLEDGE CHECK';
      case 'credits':
        return 'GTSIO-520-H · CREDITS';
      default:
        return 'GTSIO-520-H';
    }
  };

  const handleViewChange = (view: ViewMode) => {
    setIsExploreFullPage(false);
    setIsExploreViewerOpen(false);
    setQuizLessonId(undefined);
    navigate({ view }, { replace: true });
  };

  // Lesson steps bring their own bottom bar, so the app's tab bar steps aside while one is open.
  const isLessonStepOpen = Boolean(resolveLearn(tracks, route).lesson);

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
      <AppShell
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
        isLessonStepOpen={isLessonStepOpen}
      >
        {activeView === 'explore' && (
          <ExploreView
            activeModelName={activeModelName}
            isViewerOpen={isExploreViewerOpen}
            onSelectModel={(model) => {
              setActiveModelName(model);
              setIsExploreViewerOpen(true);
            }}
          />
        )}
        {activeView === 'learn' && (tracks.length ? (
          <LearnView
            tracks={tracks}
            onTakeLessonQuiz={(lessonId) => {
              setQuizLessonId(lessonId);
              navigate({ view: 'check' });
            }}
            onSwitchToExploreModel={(modelName) => {
              if (availableModels.includes(modelName)) setActiveModelName(modelName);
              setIsExploreFullPage(false);
              setIsExploreViewerOpen(true);
              navigate({ view: 'explore' }, { replace: true });
            }}
          />
        ) : curriculumState)}
        {activeView === 'check' && (quizModules.length ? <CheckView modules={quizModules} focusLessonId={quizLessonId} /> : curriculumState)}
        {activeView === 'credits' && <CreditsView />}
      </AppShell>

      <EngineInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        onOpenCredits={() => {
          setIsInfoModalOpen(false);
          navigate({ view: 'credits' });
        }}
      />
    </>
  );
}
