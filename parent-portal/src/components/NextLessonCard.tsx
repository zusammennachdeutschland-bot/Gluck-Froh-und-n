import React from 'react';
import { StudentPortalData } from '../types';
import { Calendar, Clock, Video, MapPin, Sparkles, ExternalLink } from 'lucide-react';

interface NextLessonCardProps {
  nextLesson?: StudentPortalData['nextLesson'];
}

export const NextLessonCard: React.FC<NextLessonCardProps> = ({ nextLesson }) => {
  if (!nextLesson) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
      {/* Decorative pattern */}
      <div className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>الحصة القادمة إن شاء الله</span>
          </div>

          <h2 className="text-lg sm:text-xl font-black tracking-tight">
            {nextLesson.title}
          </h2>

          <div className="flex items-center gap-4 text-xs sm:text-sm text-blue-100 font-medium flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-300" />
              <span>{nextLesson.dayOfWeek} ({nextLesson.date})</span>
            </span>

            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-300" />
              <span>الساعة {nextLesson.time}</span>
            </span>

            <span className="flex items-center gap-1.5">
              {nextLesson.isOnline ? (
                <>
                  <Video className="w-4 h-4 text-emerald-300" />
                  <span>أونلاين (Zoom)</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-rose-300" />
                  <span>{nextLesson.location || 'حضوري في السنتر'}</span>
                </>
              )}
            </span>
          </div>

          {nextLesson.topic && (
            <p className="text-xs text-blue-100/90 pt-1 font-normal">
              📌 موضوع الحصة: {nextLesson.topic}
            </p>
          )}
        </div>

        {/* Action Button */}
        {nextLesson.isOnline && nextLesson.zoomLink && (
          <a
            href={nextLesson.zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-blue-700 font-black text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-lg transition-all transform active:scale-95 shrink-0"
          >
            <Video className="w-4 h-4 text-blue-600" />
            <span>دخول رابط الحصة (Zoom)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>
        )}
      </div>
    </div>
  );
};
