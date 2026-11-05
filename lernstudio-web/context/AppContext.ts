import { useLernstudioContext } from '../shared/LernstudioSharedContext';

export const useApp = () => {
  const ctx = useLernstudioContext();
  return {
    students: ctx.students || [],
    groups: ctx.groups || [],
    schoolName: '',
    teacherName: '',
    language: ctx.language || 'ar',
    theme: ctx.theme || 'dark'
  };
};
