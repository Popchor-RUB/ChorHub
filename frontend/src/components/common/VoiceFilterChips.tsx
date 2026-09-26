import { Button } from '@heroui/react';
import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  voices: string[];
  selected: string | null;
  onChange: (voice: string | null) => void;
}

export function VoiceFilterChips({ voices, selected, onChange, ...divProps }: Props) {
  const { t } = useTranslation();
  if (voices.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" {...divProps}>
      <Button
        size="sm"
        variant={!selected ? 'primary' : 'tertiary'}
        className="rounded-full"
        onPress={() => onChange(null)}
      >
        {t('common.all')}
      </Button>
      {voices.map((voice) => (
        <Button
          key={voice}
          size="sm"
          variant={selected === voice ? 'primary' : 'tertiary'}
          className="rounded-full"
          onPress={() => onChange(selected === voice ? null : voice)}
        >
          {voice}
        </Button>
      ))}
    </div>
  );
}
