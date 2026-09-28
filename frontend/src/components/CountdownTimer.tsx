import { useState, useEffect, useRef } from 'react';

type AuctionStatus = 'active' | 'ending' | 'ended' | 'finalizing';

interface CountdownTimerProps {
  endTime: bigint;
  isFinalized?: boolean;
  onComplete?: () => void;
  compact?: boolean;
}

const STATUS_CONFIG = {
  active: { cls: 'sb-timer--active' },
  ending: { cls: 'sb-timer--ending' },
  ended: { cls: 'sb-timer--ended' },
  finalizing: { cls: 'sb-timer--finalizing' },
} as const;

export function CountdownTimer({ endTime, isFinalized = false, onComplete, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [status, setStatus] = useState<AuctionStatus>('active');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const onCompleteCalledRef = useRef(false);

  useEffect(() => {
    onCompleteCalledRef.current = false;
  }, [endTime]);

  useEffect(() => {
    const startedAt = Math.floor(Date.now() / 1000);
    const totalDuration = Math.max(Number(endTime) - startedAt, 0);

    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(endTime);
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft('Ended');
        setStatus('ended');
        setSecondsLeft(0);
        setProgress(0);
        if (!onCompleteCalledRef.current) {
          onCompleteCalledRef.current = true;
          onComplete?.();
        }
        return;
      }

      setSecondsLeft(difference);
      setProgress(totalDuration > 0 ? (difference / totalDuration) * 100 : 0);

      if (isFinalized) setStatus('finalizing');
      else if (difference < 3600) setStatus('ending');
      else setStatus('active');

      const days = Math.floor(difference / 86400);
      const hours = Math.floor((difference % 86400) / 3600);
      const minutes = Math.floor((difference % 3600) / 60);
      const seconds = difference % 60;

      if (compact) {
        if (days > 0) setTimeLeft(`${days}d ${hours}h`);
        else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m`);
        else if (minutes > 0) setTimeLeft(`${minutes}m ${seconds}s`);
        else setTimeLeft(`${seconds}s`);
      } else {
        if (days > 0) setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        else if (minutes > 0) setTimeLeft(`${minutes}m ${seconds}s`);
        else setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endTime, isFinalized, onComplete, compact]);

  const config = STATUS_CONFIG[status];

  const statusLabel = status === 'active' ? 'Active'
    : status === 'ending' ? 'Ending Soon'
    : status === 'ended' ? 'Ended'
    : 'Finalized';

  if (compact) {
    return (
      <div className="sb-timer-compact">
        <span className={`sb-timer-compact__text ${config.cls}`}>
          {timeLeft}
        </span>
        {secondsLeft > 0 && (
          <div className="sb-timer-compact__bar">
            <div className="sb-timer-compact__fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sb-timer">
      <div className="sb-timer__row">
        <div className="sb-timer__left">
          {status === 'ending' && (
            <span className="sb-timer__ping">
              <span className="sb-timer__ping-dot sb-timer__ping-dot--outer" />
              <span className="sb-timer__ping-dot sb-timer__ping-dot--inner" />
            </span>
          )}
          <span className={`sb-timer__value ${config.cls}`}>{timeLeft}</span>
        </div>
        <span className={`sb-timer__badge ${config.cls}`}>{statusLabel}</span>
      </div>
      {secondsLeft > 0 && (
        <div className="sb-timer__progress">
          <div className="sb-timer__progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
