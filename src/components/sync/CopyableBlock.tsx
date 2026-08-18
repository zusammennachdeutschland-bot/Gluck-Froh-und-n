import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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
    <div id={id} className={`flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-900 text-gray-100 overflow-hidden shadow-inner ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-950/80 border-b border-gray-800/80">
        <span className="text-xs font-mono font-medium text-gray-400">
          {title || 'Diagnostic Payload & Logs'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
          title="Copy log to clipboard"
          aria-label="Copy log to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-300" />
              <span>Copy Log</span>
            </>
          )}
        </button>
      </div>
      <pre className={`p-3 font-mono text-xs overflow-x-auto overflow-y-auto ${maxHeight} whitespace-pre-wrap break-all text-gray-300 select-all leading-relaxed`}>
        {content}
      </pre>
    </div>
  );
};
