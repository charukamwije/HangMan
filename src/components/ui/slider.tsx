import * as React from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  value: number;
  onValueChange: (v: number) => void;
};

/** Lightweight shadcn-styled range slider (native input, fully keyboard accessible). */
export function Slider({ className, value, onValueChange, min = 0, max = 1, step = 0.01, ...props }: SliderProps) {
  const pct = ((value - Number(min)) / (Number(max) - Number(min))) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn("slider h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary", className)}
      style={{ background: `linear-gradient(90deg, var(--primary) ${pct}%, var(--secondary) ${pct}%)` }}
      {...props}
    />
  );
}
