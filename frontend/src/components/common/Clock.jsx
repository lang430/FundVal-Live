import React, { useState, useEffect } from 'react';

export default function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format date and time for Beijing (UTC+8)
  const formatTime = (date) => {
    const options = {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long',
    };
    
    // Use Intl.DateTimeFormat for robust timezone handling
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
  };

  return (
    <div className="text-xs text-slate-500 font-mono text-center mt-auto pt-4 border-t border-slate-800/50 w-full">
      <div className="opacity-75 hover:opacity-100 transition-opacity cursor-default">
        {formatTime(time)}
      </div>
    </div>
  );
}
