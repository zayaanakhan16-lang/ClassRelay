import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { SiteFooter, SiteHeader } from './components/Layout';
import { useHealth } from './hooks/useHealth';
import { LandingPage } from './pages/LandingPage';
import { StartPage } from './pages/StartPage';
import { ClassroomPage } from './classroom/ClassroomPage';
import { ClassQuizPage } from './quiz/ClassQuizPage';
import { SelfQuizPage } from './quiz/SelfQuizPage';
import { ReportPage } from './report/ReportPage';
import { PeerHubPage } from './peer-learning/PeerHubPage';
import { PeerRoomPage } from './peer-learning/PeerRoomPage';
import { ReteachPage } from './classroom/ReteachPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ClassroomModeProvider } from './classroom/useClassroomMode';

/** Scrolls to the top on navigation so each step starts at a readable position. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export function App() {
  const { health } = useHealth();
  const demo = !health?.hasKey;

  return (
    <ClassroomModeProvider>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col">
        <SiteHeader demo={demo} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage demo={demo} />} />
            <Route path="/start" element={<StartPage demo={demo} />} />
            <Route path="/classroom" element={<ClassroomPage />} />
            <Route path="/class-quiz" element={<ClassQuizPage />} />
            <Route path="/self-quiz" element={<SelfQuizPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/reteach" element={<ReteachPage />} />
            <Route path="/peers" element={<PeerHubPage />} />
            <Route path="/peers/:roomId" element={<PeerRoomPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </ClassroomModeProvider>
  );
}
