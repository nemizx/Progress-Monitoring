import React from 'react';
import { cn } from '@/lib/utils';

export default function ProgressRing({ value = 0, size = 48, strokeWidth = 4, className }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  
  const color = value >= 75 ? 'text-emerald-500' : value >= 40 ? 'text-amber-500' : 'text-red-400';

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/60"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-700 ease-out", color)}
        />
      </svg>
      <span className="absolute text-xs font-bold">{Math.round(value)}%</span>
    </div>
  );
}