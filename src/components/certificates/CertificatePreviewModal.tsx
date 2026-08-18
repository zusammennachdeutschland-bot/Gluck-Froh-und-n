import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CertificateRecord } from '../../types';
import { CertificateRenderer } from './templates/CertificateRenderer';
import { downloadCertificatePDF, downloadCertificateImage, shareCertificateWhatsApp } from '../../utils/certificateExportUtils';
import { X, Download, Share2, FileText, Trash2, Edit3, CheckCircle2, User } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CertificatePreviewModalProps {
  certificate: CertificateRecord;
  onClose: () => void;
  onEdit?: (cert: CertificateRecord) => void;
  onDelete?: (id: string) => void;
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  certificate,
  onClose,
  onEdit,
  onDelete
}) => {
  const { students, deleteCertificate, _t } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const student = students.find(s => s.id === certificate.studentId);
  const phone = student?.parentPhone || student?.studentPhone;

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      await downloadCertificatePDF(certificate);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPNG = async () => {
    setIsExporting(true);
    try {
      await downloadCertificateImage(certificate);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsAppShare = () => {
    shareCertificateWhatsApp(certificate, phone);
  };

  const handleDelete = () => {
    deleteCertificate(certificate.id);
    if (onDelete) onDelete(certificate.id);
    onClose();
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
      <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-scale-up flex flex-col my-auto max-h-[94vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-text-main truncate max-w-xs sm:max-w-md">
                {certificate.studentName} — {certificate.courseOrLevelTitle}
              </h3>
              <span className="text-[11px] text-text-muted">
                {certificate.issueDate} • {certificate.instructorName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(certificate);
                  onClose();
                }}
                className="p-2 text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title={_t('تعديل الشهادة', 'Edit Certificate', 'Zertifikat bearbeiten')}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
              title={_t('حذف الشهادة', 'Delete Certificate', 'Zertifikat löschen')}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Display Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex items-center justify-center bg-slate-100/70 dark:bg-slate-950/80">
          <div className="w-full max-w-2xl shadow-xl rounded-2xl overflow-hidden">
            <CertificateRenderer certificate={certificate} elementId={`cert-node-${certificate.id}`} />
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="px-5 py-3.5 border-t border-surface-border dark:border-slate-800 bg-surface dark:bg-slate-900 shrink-0 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{_t('تحميل PDF', 'Download PDF', 'PDF herunterladen')}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="px-4 py-2.5 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>{_t('صورة PNG', 'PNG Image', 'PNG-Bild')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>{_t('مشاركة عبر واتساب', 'Share WhatsApp', 'Per WhatsApp teilen')}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(false)} className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full border border-surface-border dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="font-black text-base text-text-main">
                {_t('حذف الشهادة؟', 'Delete Certificate?', 'Zertifikat löschen?')}
              </h4>
              <p className="text-xs text-text-muted">
                {_t('هل أنت متأكد من حذف هذه الشهادة من الأرشيف؟', 'Are you sure you want to delete this certificate?', 'Möchten Sie dieses Zertifikat wirklich löschen?')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="py-2.5 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 rounded-xl text-xs font-bold text-text-main cursor-pointer"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={handleDelete}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                {_t('نعم، حذف', 'Yes, Delete', 'Löschen')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
