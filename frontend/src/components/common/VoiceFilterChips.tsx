import { Chip } from '@heroui/react';
import type { HTMLAttributes } from 'react';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  voices: string[];
  selected: string | null;
  onChange: (voice: string | null) => void;
}

export function VoiceFilterChips({ voices, selected, onChange, ...divProps }: Props) {
  if (voices.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" {...divProps}>
      <Chip
        size="sm"
        variant={!selected ? 'solid' : 'flat'}
        color={!selected ? 'primary' : 'default'}
        className="cursor-pointer select-none"
        onClick={() => onChange(null)}
      >
        Alle
      </Chip>
      {voices.map((voice) => (
        <Chip
          key={voice}
          size="sm"
          variant={selected === voice ? 'solid' : 'flat'}
          color={selected === voice ? 'primary' : 'default'}
          className="cursor-pointer select-none"
          onClick={() => onChange(selected === voice ? null : voice)}
        >
          {voice}
        </Chip>
      ))}
    </div>
  );
}
