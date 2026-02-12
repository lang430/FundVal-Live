import React from 'react';

export const getRateColor = (rate) => {
  if (rate > 0) return 'text-rose-500';
  if (rate < 0) return 'text-emerald-500';
  return 'text-slate-500';
};

export const StatCard = ({ label, value, subValue, highlight = false, isRate = false, large = false }) => (
  <div className="flex flex-col">
    <span className="text-xs text-slate-500 mb-1">{label}</span>
    <div className={`${large ? 'text-2xl md:text-3xl' : 'text-lg'} font-mono font-medium ${highlight ? getRateColor(parseFloat(value)) : 'text-slate-900'}`}>
      {value}{isRate ? '%' : ''}
    </div>
    {subValue && <span className="text-xs text-slate-500">{subValue}</span>}
  </div>
);
