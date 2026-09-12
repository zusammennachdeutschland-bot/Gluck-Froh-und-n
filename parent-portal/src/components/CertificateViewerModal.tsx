import React, { useRef } from 'react';
import { PortalCertificateItem, StudentPortalData } from '../types';
import { X, Award, Download, Printer, Share2, Sparkles, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CertificateViewerModalProps {
  certificate: PortalCertificateItem | null;
  student: StudentPortalData;
  onClose: () => void;
}

export const CertificateViewerModal: React.FC<CertificateViewerModalProps> = ({
  certificate,
  student,
  onClose
}) => {
  if (!certificate) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-scale-up">
      <div className="bg-surface border border-surface-border rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-sm sm:text-base text-text-main">
              معاينة الشهادة الرسمية
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-background border border-surface-border hover:text-blue-500 text-text-muted transition-all cursor-pointer"
              title="طباعة أو حفظ PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-background border border-surface-border hover:text-rose-500 text-text-muted transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Canvas Box */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950/80 flex items-center justify-center">
          <div className="w-full bg-[#fcfbf9] text-slate-900 border-8 border-double border-amber-600/40 rounded-2xl p-6 sm:p-10 shadow-xl relative text-center space-y-5">
            {/* Corner Decorative Ornaments */}
            <div className="absolute top-2 right-2 text-amber-600/30 text-xs font-serif">⚜️</div>
            <div className="absolute top-2 left-2 text-amber-600/30 text-xs font-serif">⚜️</div>
            <div className="absolute bottom-2 right-2 text-amber-600/30 text-xs font-serif">⚜️</div>
            <div className="absolute bottom-2 left-2 text-amber-600/30 text-xs font-serif">⚜️</div>

            {/* German Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 text-xs font-bold border border-amber-500/30">
              <span>🇩🇪 أكاديمية اللغة الألمانية | AGS Deutsch</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-serif">
                شهادة تقدير وتفوق
              </h2>
              <p className="text-xs text-amber-700 font-bold">
                Urkunde über hervorragende Leistungen
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-md mx-auto">
              تسر إدارة تدريس اللغة الألمانية أن تمنح هذه الشهادة بكل فخر واعتزاز إلى:
            </p>

            {/* Student Name */}
            <div className="py-2">
              <div className="text-2xl sm:text-4xl font-black text-amber-700 border-b-2 border-amber-400/50 pb-2 inline-block px-6">
                {student.name}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-lg mx-auto">
              {certificate.description || 'نظير التفوق الدراسي والالتزام المتميز في دراسة اللغة الألمانية واجتياز كافة التدريبات والاختبارات بكفاءة واقتدار.'}
            </p>

            {/* Badge & Stamp */}
            <div className="pt-4 flex items-center justify-between border-t border-amber-400/30 text-xs text-slate-700 px-4">
              <div className="text-right">
                <div className="font-bold text-amber-800">{certificate.badge}</div>
                <div className="text-[11px] text-slate-500">تاريخ الإصدار: {certificate.issueDate}</div>
              </div>

              {/* Gold Seal Stamp */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-amber-950 flex items-center justify-center font-black text-[10px] shadow-md border-2 border-white ring-2 ring-amber-400">
                AGS 🇩🇪
              </div>

              <div className="text-left">
                <div className="font-bold text-slate-900">{student.teacherName || 'أ. أحمد سمير'}</div>
                <div className="text-[11px] text-slate-500">معلم اللغة الألمانية</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-surface-border flex items-center justify-between gap-3 bg-surface">
          <button
            onClick={handleCelebrate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>احتفال 🎉</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>طباعة أو تحميل الشهادة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
