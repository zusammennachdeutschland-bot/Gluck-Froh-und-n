// Legacy path — kept ONLY for the two pure helpers that HomeworkPlayerPage
// imports (splitGermanIntoSyllables / splitGermanArticleAndWord).
// The Teach modal itself moved to ./LernstudioTeachPage as a full page —
// do NOT re-export the component from here; LernstudioView renders the page.
export { splitGermanIntoSyllables, splitGermanArticleAndWord } from './LernstudioTeachPage';
