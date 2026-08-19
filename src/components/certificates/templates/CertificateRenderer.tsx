import React from 'react';
import { CertificateRecord } from '../../../types';
import { NeutralTemplate } from './NeutralTemplate';
import { BoysChampionTemplate } from './BoysChampionTemplate';
import { GirlsPrincessTemplate } from './GirlsPrincessTemplate';
import { ClassicTemplate } from './ClassicTemplate';
import { ElegantTemplate } from './ElegantTemplate';
import { KidsTemplate } from './KidsTemplate';
import { GermanThemedTemplate } from './GermanThemedTemplate';
import { ModernTemplate } from './ModernTemplate';
import { CustomAIBackgroundTemplate } from './CustomAIBackgroundTemplate';

interface CertificateRendererProps {
  certificate: Partial<CertificateRecord>;
  elementId?: string;
  className?: string;
}

export const CertificateRenderer: React.FC<CertificateRendererProps> = ({
  certificate,
  elementId = 'certificate-render-target',
  className = ''
}) => {
  const templateId = certificate.template || certificate.templateId || 'classic';
  const isCustomBg = !!certificate.customBackgroundUrl || templateId === 'custom_ai_bg' || String(templateId).startsWith('ai_bg_');

  return (
    <div
      id={elementId}
      className={`w-full max-w-4xl mx-auto overflow-hidden rounded-xl shadow-lg relative ${className}`}
    >
      {isCustomBg ? (
        <CustomAIBackgroundTemplate certificate={certificate} />
      ) : (
        <>
          {(templateId === 'boys' || templateId === 'boys_champion') && (
            <BoysChampionTemplate certificate={certificate} />
          )}
          {(templateId === 'girls' || templateId === 'girls_princess') && (
            <GirlsPrincessTemplate certificate={certificate} />
          )}
          {templateId === 'elegant' && <ElegantTemplate certificate={certificate} />}
          {templateId === 'kids' && <KidsTemplate certificate={certificate} />}
          {templateId === 'german_themed' && <GermanThemedTemplate certificate={certificate} />}
          {templateId === 'modern' && <ModernTemplate certificate={certificate} />}
          {templateId === 'classic' && <ClassicTemplate certificate={certificate} />}
          {(templateId === 'neutral' || !['boys', 'boys_champion', 'girls', 'girls_princess', 'elegant', 'kids', 'german_themed', 'modern', 'classic'].includes(templateId)) && (
            <NeutralTemplate certificate={certificate} />
          )}
        </>
      )}
    </div>
  );
};

