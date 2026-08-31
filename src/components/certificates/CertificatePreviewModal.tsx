import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CertificateRecord } from '../../types';
import { CertificateRenderer } from './templates/CertificateRenderer';
import { 
  downloadCertificatePDF, 
  downloadCertificateImage, 
  shareCertificateWhatsApp,
  shareCertificate,
  saveCertificateToPhoneFolder
} from '../../utils/certificateExportUtils';
import { 
  X, Download, Share2, FileText, Trash2, Edit3, User, Loader2, 
  ZoomIn, ZoomOut, Maximize2, FolderDown, Send, CheckCircle2 
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

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
  const [exportMessage, setExportMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<'fit' | 'large'>('fit');
  const [saveSuccessDetails, setSaveSuccessDetails] = useState<string | null>(null);

  const student = students.find(s => s.id === certificate.studentId);
  const phone = student?.parentPhone || student?.studentPhone;
  const isNative = Capacitor.isNativePlatform();

  const elementId = `cert-node-${certificate.id}`;

  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري إنشاء وحفظ PDF...', 'Generating PDF...', 'PDF wird generiert...'));
    try {
      const res = await downloadCertificatePDF(certificate);
      const msg = isNative 
        ? _t(`تم حفظ PDF في مجلد: ${res.path}`, `Saved PDF to ${res.path}`, `PDF gespeichert`)
        : _t('تم تحميل ملف PDF بنجاح', 'PDF downloaded successfully', 'PDF heruntergeladen');
      setExportMessage(msg);
      setSaveSuccessDetails(res.path || null);
      setTimeout(() => setExportMessage(''), 4000);
    } catch (err) {
      console.error('Download PDF error:', err);
      setExportMessage(_t('حدث خطأ أثناء حفظ PDF', 'Export error', 'Fehler beim Export'));
      setTimeout(() => setExportMessage(''), 3500);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري إنشاء وحفظ الصورة...', 'Generating Image...', 'Bild wird generiert...'));
    try {
      const res = await downloadCertificateImage(certificate, 'png');
      const msg = isNative 
        ? _t(`تم حفظ الصورة في مجلد: ${res.path}`, `Saved image to ${res.path}`, `Bild gespeichert`)
        : _t('تم تحميل صورة الشهادة بنجاح', 'Image downloaded successfully', 'Bild heruntergeladen');
      setExportMessage(msg);
      setSaveSuccessDetails(res.path || null);
      setTimeout(() => setExportMessage(''), 4000);
    } catch (err) {
      console.error('Download PNG error:', err);
      setExportMessage(_t('حدث خطأ أثناء حفظ الصورة', 'Export error', 'Fehler beim Export'));
      setTimeout(() => setExportMessage(''), 3500);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToPhoneFolder = async (format: 'pdf' | 'png' = 'pdf') => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري الحفظ في مجلد الشهادات بالهاتف...', 'Saving to phone folder...', 'Wird im Ordner gespeichert...'));
    try {
      const res = await saveCertificateToPhoneFolder(certificate, format);
      setExportMessage(_t(`تم الحفظ في: ${res.path}`, `Saved to ${res.path}`, `Gespeichert`));
      setSaveSuccessDetails(res.path);
      setTimeout(() => setExportMessage(''), 5000);
    } catch (err) {
      console.error('Save to folder error:', err);
      setExportMessage(_t('فشل الحفظ في المجلد', 'Save failed', 'Fehler beim Speichern'));
      setTimeout(() => setExportMessage(''), 3500);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNativeShare = async (format: 'pdf' | 'png' = 'png') => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري تجهيز المشاركة...', 'Preparing share...', 'Wird geteilt...'));
    try {
      await shareCertificate(certificate, certificate.title, certificate.recipientName || certificate.studentName, format);
      setExportMessage('');
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMessage(_t('جاري تجهيز الشهادة والمشاركة للواتساب...', 'Preparing certificate for WhatsApp...', 'Wird für WhatsApp vorbereitet...'));
    try {
      await shareCertificateWhatsApp(certificate, phone);
      setExportMessage('');
    } catch (err) {
      console.error('WhatsApp share error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = () => {
    deleteCertificate(certificate.id);
    if (onDelete) onDelete(certificate.id);
    onClose();
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-scale-up flex flex-col my-auto max-h-[96vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-surface-border dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-xs sm:text-sm text-text-main truncate">
                {certificate.recipientName || certificate.studentName} — {certificate.courseOrLevelTitle || certificate.title}
              </h3>
              <span className="text-[10px] sm:text-[11px] text-text-muted truncate block">
                {certificate.issueDate} • {certificate.teacherName || certificate.instructorName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* View Size / Zoom toggle */}
            <button
              onClick={() => setZoomLevel(prev => prev === 'fit' ? 'large' : 'fit')}
              className="p-2 text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={zoomLevel === 'fit' ? _t('تكبير العرض', 'Zoom In', 'Vergrößern') : _t('ملاءمة الشاشة', 'Fit Screen', 'An Bildschirm anpassen')}
            >
              {zoomLevel === 'fit' ? <Maximize2 className="w-4 h-4" /> : <ZoomOut className="w-4 h-4" />}
            </button>

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
        <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-6 flex items-center justify-center bg-slate-100/90 dark:bg-slate-950/90">
          <div
            className={`w-full transition-all duration-200 shadow-2xl rounded-2xl overflow-hidden ${
              zoomLevel === 'large' ? 'max-w-4xl min-w-[700px]' : 'max-w-3xl'
            }`}
          >
            <CertificateRenderer certificate={certificate} elementId={elementId} />
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-surface-border dark:border-slate-800 bg-surface dark:bg-slate-900 shrink-0 flex flex-col gap-2">
          
          {/* Status Message & Storage Path Indicator */}
          {exportMessage && (
            <div className="flex items-center gap-2 text-xs text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-lg">
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              <span className="truncate">{exportMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Direct Download & Folder Actions */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="px-3 sm:px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                title={_t('تحميل ملف PDF مباشرة وحفظه', 'Download PDF', 'PDF herunterladen')}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{_t('تحميل PDF', 'Download PDF', 'PDF herunterladen')}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPNG}
                disabled={isExporting}
                className="px-3 sm:px-3.5 py-2 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                title={_t('تحميل صورة PNG بدقة عالية', 'Download PNG image', 'PNG-Bild herunterladen')}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>{_t('صورة PNG', 'PNG Image', 'PNG-Bild')}</span>
              </button>

              {/* Dedicated Folder Action Button */}
              <button
                type="button"
                onClick={() => handleSaveToPhoneFolder('pdf')}
                disabled={isExporting}
                className="px-3 sm:px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                title={_t('حفظ الشهادة داخل مجلد Documents/AGS_Certificates بهاتفك', 'Save to phone AGS_Certificates folder', 'Im AGS_Certificates Ordner speichern')}
              >
                <FolderDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{_t('مجلد الهاتف (AGS)', 'Phone Folder', 'Telefonordner')}</span>
              </button>
            </div>

            {/* Sharing Actions (Distinct from Download) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleNativeShare('png')}
                disabled={isExporting}
                className="px-3 sm:px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                title={_t('مشاركة عبر التطبيقات الأخرى (بلوتوث، تليجرام، درايف...)', 'Share via other apps', 'Über andere Apps teilen')}
              >
                <Send className="w-4 h-4 text-primary" />
                <span>{_t('مشاركة', 'Share', 'Teilen')}</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                disabled={isExporting}
                className="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                title={_t('إرسال مباشر عبر واتساب لولي الأمر أو الطالب', 'Send directly via WhatsApp', 'Per WhatsApp senden')}
              >
                <Share2 className="w-4 h-4" />
                <span>{_t('واتساب', 'WhatsApp', 'WhatsApp')}</span>
              </button>
            </div>
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
