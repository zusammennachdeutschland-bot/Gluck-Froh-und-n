import React, { useState } from 'react';
import { PortalCertificateItem, StudentPortalData } from '../types';
import { Award, Sparkles, ExternalLink, Calendar, Star, Download } from 'lucide-react';
import { CertificateViewerModal } from './CertificateViewerModal';

interface CertificatesTabProps {
  certificates: PortalCertificateItem[];
  student: StudentPortalData;
}

export const CertificatesTab: React.FC<CertificatesTabProps> = ({
  certificates,
  student
}) => {
  const [selectedCert, setSelectedCert] = useState<PortalCertificateItem | null>(null);

  if (!certificates || certificates.length === 0) {
    return (
      <div className="bg-surface border border-surface-border rounded-3xl p-8 text-center text-text-muted">
        <Award className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-500" />
        <h3 className="font-bold text-base text-text-main">لا توجد شهادات حتى الآن</h3>
        <p className="text-xs pt-1">سيتم منح الشهادات والأوسمة عند اجتياز المستويات والتميز في الحصص.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-base text-text-main flex items-center gap-2">
          <span>لوحة الشرف والشهادات الرسمية</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {certificates.length} شهادة
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {certificates.map((cert) => (
          <div
            key={cert.id}
            className="bg-surface border border-amber-500/20 hover:border-amber-500/40 rounded-3xl p-5 shadow-xs space-y-4 transition-all relative overflow-hidden group"
          >
            {/* Top Badge */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Star className="w-3.5 h-3.5 fill-amber-500" />
                <span>{cert.badge}</span>
              </span>

              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Calendar className="w-3.5 h-3.5" />
                <span>{cert.issueDate}</span>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h4 className="font-black text-base text-text-main group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {cert.title}
              </h4>
              <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                {cert.description}
              </p>
            </div>

            {/* View / Download Button */}
            <button
              onClick={() => setSelectedCert(cert)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>معاينة وتحميل الشهادة</span>
            </button>
          </div>
        ))}
      </div>

      {/* Certificate Modal */}
      {selectedCert && (
        <CertificateViewerModal
          certificate={selectedCert}
          student={student}
          onClose={() => setSelectedCert(null)}
        />
      )}
    </div>
  );
};
