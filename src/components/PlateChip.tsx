import { PLATE_META } from '../i18n';
import type { LanguageCode, PlateColor } from '../types';

interface PlateChipProps {
  color: PlateColor;
  price?: number;
  lang: LanguageCode;
  compact?: boolean;
}

export function PlateChip({ color, price, lang, compact = false }: PlateChipProps) {
  const meta = PLATE_META[color];
  const label = lang === 'en' ? meta.labelEn : lang === 'jp' ? meta.labelJp : meta.labelTh;

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-[#171717] whitespace-nowrap shrink-0">
      <span
        className="inline-block h-3.5 w-3.5 rounded-full border-2 shrink-0"
        style={{ backgroundColor: meta.bgHex, borderColor: meta.ringHex }}
        aria-hidden="true"
      />
      <span>{label}</span>
      {typeof price === 'number' && !compact && (
        <span className="font-mono tabular-nums text-[#77716A]">
          · {price.toLocaleString()} ฿
        </span>
      )}
    </span>
  );
}
