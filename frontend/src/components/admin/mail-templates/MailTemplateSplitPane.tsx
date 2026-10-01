import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

const PANE_MIN_WIDTH = 320;
const SPLITTER_WIDTH = 12;
const DEFAULT_SPLIT_PERCENT = 50;

type MailTemplateSplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  separatorLabel: string;
};

export function MailTemplateSplitPane({ left, right, separatorLabel }: MailTemplateSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPaneId = useId();
  const rightPaneId = useId();
  const [containerWidth, setContainerWidth] = useState(0);
  const [requestedSplitPercent, setRequestedSplitPercent] = useState(DEFAULT_SPLIT_PERCENT);
  const dragStartRef = useRef<{ pointerX: number; splitPercent: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry?.contentRect.width ?? 0);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const minPercent = containerWidth > 0
    ? Math.ceil(Math.min(50, (PANE_MIN_WIDTH / (containerWidth - SPLITTER_WIDTH)) * 100))
    : 0;
  const maxPercent = 100 - minPercent;
  const clampPercent = (value: number) => Math.min(maxPercent, Math.max(minPercent, Math.round(value)));
  const splitPercent = clampPercent(requestedSplitPercent);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= SPLITTER_WIDTH) return;

    const availableWidth = bounds.width - SPLITTER_WIDTH;
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    const deltaPercent = ((event.clientX - dragStart.pointerX) / availableWidth) * 100;
    setRequestedSplitPercent(clampPercent(dragStart.splitPercent + deltaPercent));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;

    event.preventDefault();
    event.currentTarget.focus();
    dragStartRef.current = { pointerX: event.clientX, splitPercent };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setRequestedSplitPercent(clampPercent(splitPercent - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setRequestedSplitPercent(clampPercent(splitPercent + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setRequestedSplitPercent(minPercent);
    } else if (event.key === 'End') {
      event.preventDefault();
      setRequestedSplitPercent(maxPercent);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-col gap-6 lg:grid lg:items-start lg:gap-0"
      style={{ gridTemplateColumns: `${splitPercent}fr ${SPLITTER_WIDTH}px ${100 - splitPercent}fr` }}
      data-testid="admin-mail-template-split-pane"
    >
      <div id={leftPaneId} className="min-w-0">{left}</div>
      <div
        className="group hidden min-h-48 cursor-col-resize touch-none items-center justify-center rounded-full outline-none lg:flex lg:self-stretch"
        role="separator"
        aria-label={separatorLabel}
        aria-controls={`${leftPaneId} ${rightPaneId}`}
        aria-orientation="vertical"
        aria-valuemin={minPercent}
        aria-valuemax={maxPercent}
        aria-valuenow={splitPercent}
        aria-valuetext={`${splitPercent}%`}
        tabIndex={0}
        data-testid="admin-mail-template-splitter"
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
        }}
        onPointerUp={() => { dragStartRef.current = null; }}
        onPointerCancel={() => { dragStartRef.current = null; }}
        onLostPointerCapture={() => { dragStartRef.current = null; }}
        onKeyDown={handleKeyDown}
      >
        <span className="h-12 w-1 rounded-full bg-border transition-colors group-hover:bg-accent group-focus-visible:bg-accent" aria-hidden="true" />
      </div>
      <div id={rightPaneId} className="min-w-0">{right}</div>
    </div>
  );
}
