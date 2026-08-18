import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export function useDesktopShortcuts() {
  const {
    setActiveTab,
    setIsGlobalSearchOpen,
    setIsAddLessonModalOpen,
    setIsAddQuickLessonModalOpen,
    setIsAddStudentModalOpen,
    setIsAddGroupModalOpen,
    setIsStartLessonNowModalOpen,
    isControlModalOpen,
    closeLessonControl,
    isAddLessonModalOpen,
    isAddQuickLessonModalOpen,
    isAddStudentModalOpen,
    isAddGroupModalOpen,
    isGlobalSearchOpen
  } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Global Search: Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(prev => !prev);
        return;
      }

      // Escape key to close modals
      if (e.key === 'Escape') {
        if (isGlobalSearchOpen) {
          setIsGlobalSearchOpen(false);
        } else if (isControlModalOpen) {
          closeLessonControl();
        } else if (isAddLessonModalOpen) {
          setIsAddLessonModalOpen(false);
        } else if (isAddQuickLessonModalOpen) {
          setIsAddQuickLessonModalOpen(false);
        } else if (isAddStudentModalOpen) {
          setIsAddStudentModalOpen(false);
        } else if (isAddGroupModalOpen) {
          setIsAddGroupModalOpen(false);
        }
        return;
      }

      // Alt Shortcuts (works even without typing focus)
      if (e.altKey && !isInput) {
        switch (e.key.toLowerCase()) {
          case '1':
            e.preventDefault();
            setActiveTab('home');
            break;
          case '2':
            e.preventDefault();
            setActiveTab('schedule');
            break;
          case '3':
            e.preventDefault();
            setActiveTab('students');
            break;
          case '4':
            e.preventDefault();
            setActiveTab('payments');
            break;
          case '5':
            e.preventDefault();
            setActiveTab('history');
            break;
          case '6':
            e.preventDefault();
            setActiveTab('reports');
            break;
          case '7':
            e.preventDefault();
            setActiveTab('certificates');
            break;
          case '8':
            e.preventDefault();
            setActiveTab('settings');
            break;
          case 'l':
            e.preventDefault();
            setIsAddLessonModalOpen(true);
            break;
          case 's':
            e.preventDefault();
            setIsAddStudentModalOpen(true);
            break;
          case 'g':
            e.preventDefault();
            setIsAddGroupModalOpen(true);
            break;
          case 'q':
            e.preventDefault();
            setIsAddQuickLessonModalOpen(true);
            break;
          case 'z':
            e.preventDefault();
            setIsStartLessonNowModalOpen(true);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setActiveTab,
    setIsGlobalSearchOpen,
    setIsAddLessonModalOpen,
    setIsAddQuickLessonModalOpen,
    setIsAddStudentModalOpen,
    setIsAddGroupModalOpen,
    setIsStartLessonNowModalOpen,
    isControlModalOpen,
    closeLessonControl,
    isAddLessonModalOpen,
    isAddQuickLessonModalOpen,
    isAddStudentModalOpen,
    isAddGroupModalOpen,
    isGlobalSearchOpen
  ]);
}
