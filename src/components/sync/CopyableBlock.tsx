import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CopyableBlockProps {
  content: string;
  title?: string;
  maxHeight?: string;
  className?: string;
  id?: string;
}

export const CopyableBlock: React.FC<CopyableBlockProps> = ({
  content,
  title,
  maxHeight = 'max-h-64',
  className = '',
  id
}) => {
  const { _t } = useApp();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div id={id} className={`flex flex-col rounded-2xl border border-surface-border bg-gray-950 text-gray-100 overflow-hidden shadow-xs ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/90 border-b border-gray-800">
        <span className="text-xs font-mono font-bold text-gray-400">
          {title || _t('سجل البيانات والتشخيص', 'Diagnostic Payload & Logs', 'Diagnosedaten & Logs')}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-gray-800 hover:bg-gray-700 active:bg-gray-800 text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          title="Copy log to clipboard"
          aria-label="Copy log to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">{_t('تم النسخ!', 'Copied!', 'Kopiert!')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-300" />
              <span>{_t('نسخ السجل', 'Copy Log', 'Log kopieren')}</span>
            </>
          )}
        </button>
      </div>
      <pre className={`p-4 font-mono text-xs overflow-x-auto overflow-y-auto ${maxHeight} whitespace-pre-wrap break-all text-gray-300 select-all leading-relaxed`}>
        {content}
      </pre>
    </div>
  );
};
