import type { KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  wrapperClassName?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/** Campo monetário comum aos formulários de investimento do ROI Marketing. */
export default function MarketingInvestimentoInput({
  value,
  onChange,
  placeholder = "Ex.: 1250,50",
  ariaLabel,
  wrapperClassName = "",
  inputClassName = "",
  autoFocus,
  onKeyDown,
}: Props) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</span>
      <Input
        inputMode="decimal"
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`pl-10 ${inputClassName}`}
      />
    </div>
  );
}
