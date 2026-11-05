import React, { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { HomeworkPlayerPage } from './pages/HomeworkPlayerPage';
import { TeacherDashboardPage } from './pages/TeacherDashboardPage';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Route: /homework/:id
  if (currentPath.startsWith('/homework/')) {
    return <HomeworkPlayerPage />;
  }

  // Route: /teacher
  if (currentPath.startsWith('/teacher')) {
    return <TeacherDashboardPage />;
  }

  // Default: Homepage (Full Lernstudio standalone web app)
  return <HomePage />;
};
