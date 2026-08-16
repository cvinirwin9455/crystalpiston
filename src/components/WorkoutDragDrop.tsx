"use client";

import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";

// ===== TYPES =====
export type DragItem = {
  workoutId: string;
  workoutType: "programmed" | "client";
  fromDay: string;
  title: string;
};

type DragDropContextValue = {
  dragItem: DragItem | null;
  isDragging: boolean;
  dragOverDay: string | null;
  startDrag: (item: DragItem) => void;
  endDrag: () => void;
  setDragOverDay: (day: string | null) => void;
  handleDrop: (toDay: string) => void;
  canDrag: (workout: { completed?: boolean; stravaSynced?: boolean; status?: string; source?: string; stravaActivityId?: string | null }) => boolean;
};

const DragDropContext = createContext<DragDropContextValue>({
  dragItem: null,
  isDragging: false,
  dragOverDay: null,
  startDrag: () => {},
  endDrag: () => {},
  setDragOverDay: () => {},
  handleDrop: () => {},
  canDrag: () => false,
});

export function useDragDrop() {
  return useContext(DragDropContext);
}

// ===== PROVIDER =====
type DragDropProviderProps = {
  weekId: string;
  onMoveWorkout: (workoutId: string, workoutType: "programmed" | "client", fromDay: string, toDay: string) => Promise<boolean>;
  children: React.ReactNode;
};

export function DragDropProvider({ weekId, onMoveWorkout, children }: DragDropProviderProps) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const startDrag = useCallback((item: DragItem) => {
    setDragItem(item);
    setIsDragging(true);
  }, []);

  const endDrag = useCallback(() => {
    setDragItem(null);
    setIsDragging(false);
    setDragOverDay(null);
  }, []);

  const handleDrop = useCallback(async (toDay: string) => {
    if (!dragItem || dragItem.fromDay === toDay) {
      endDrag();
      return;
    }
    const success = await onMoveWorkout(dragItem.workoutId, dragItem.workoutType, dragItem.fromDay, toDay);
    endDrag();
  }, [dragItem, onMoveWorkout, endDrag]);

  const canDrag = useCallback((workout: { completed?: boolean; stravaSynced?: boolean; status?: string; source?: string; stravaActivityId?: string | null }) => {
    // Cannot drag completed (status-based), or strava-synced workouts
    if (workout.status === "complete" || workout.status === "partial" || workout.status === "skipped") return false;
    if (workout.stravaSynced) return false;
    if (workout.source === "strava" && workout.stravaActivityId) return false;
    return true;
  }, []);

  return (
    <DragDropContext.Provider value={{ dragItem, isDragging, dragOverDay, startDrag, endDrag, setDragOverDay, handleDrop, canDrag }}>
      {children}
    </DragDropContext.Provider>
  );
}

// ===== DRAGGABLE WRAPPER =====
type DraggableWorkoutProps = {
  workoutId: string;
  workoutType: "programmed" | "client";
  day: string;
  title: string;
  disabled: boolean;
  children: React.ReactNode;
};

export function DraggableWorkout({ workoutId, workoutType, day, title, disabled, children }: DraggableWorkoutProps) {
  const { startDrag, endDrag, isDragging, dragItem } = useDragDrop();
  const elementRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; timeout: NodeJS.Timeout | null }>({ x: 0, y: 0, timeout: null });
  const [isThisItemDragging, setIsThisItemDragging] = useState(false);

  const isBeingDragged = isDragging && dragItem?.workoutId === workoutId;

  // HTML5 Drag and Drop handlers (desktop)
  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ workoutId, workoutType, fromDay: day, title }));
    // Set ghost image
    if (elementRef.current) {
      const ghost = elementRef.current.cloneNode(true) as HTMLElement;
      ghost.style.opacity = "0.8";
      ghost.style.transform = "rotate(2deg)";
      ghost.style.position = "absolute";
      ghost.style.top = "-1000px";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
    startDrag({ workoutId, workoutType, fromDay: day, title });
    setIsThisItemDragging(true);
  };

  const handleDragEnd = () => {
    endDrag();
    setIsThisItemDragging(false);
  };

  // Touch handlers (mobile long-press)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      timeout: setTimeout(() => {
        // Long press activated (500ms)
        startDrag({ workoutId, workoutType, fromDay: day, title });
        setIsThisItemDragging(true);
        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(50);
      }, 500),
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isThisItemDragging && touchStartRef.current.timeout) {
      // Cancel long-press if finger moves too much
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartRef.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(touchStartRef.current.timeout);
        touchStartRef.current.timeout = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current.timeout) {
      clearTimeout(touchStartRef.current.timeout);
      touchStartRef.current.timeout = null;
    }
    if (isThisItemDragging) {
      // The drop will be handled by the DroppableDay component
      setIsThisItemDragging(false);
    }
  };

  return (
    <div
      ref={elementRef}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative transition-all duration-200 ${
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${isBeingDragged ? "opacity-40 scale-95" : ""}`}
      style={{ touchAction: disabled ? "auto" : "manipulation" }}
    >
      {/* Drag handle indicator for non-disabled workouts */}
      {!disabled && (
        <div className="absolute top-2 right-2 z-10 opacity-40 hover:opacity-100 transition-opacity" title="Drag to move to another day">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="10" r="1.5" /><circle cx="15" cy="10" r="1.5" />
            <circle cx="9" cy="15" r="1.5" /><circle cx="15" cy="15" r="1.5" />
            <circle cx="9" cy="20" r="1.5" /><circle cx="15" cy="20" r="1.5" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}

// ===== DROPPABLE DAY ZONE =====
type DroppableDayProps = {
  day: string;
  children: React.ReactNode;
  isEmpty?: boolean;
};

export function DroppableDay({ day, children, isEmpty }: DroppableDayProps) {
  const { isDragging, dragItem, dragOverDay, setDragOverDay, handleDrop } = useDragDrop();
  const isOver = dragOverDay === day;
  const isSourceDay = dragItem?.fromDay === day;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDay !== day) {
      setDragOverDay(day);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDay(day);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if actually leaving this zone (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverDay(null);
    }
  };

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDay(null);
    handleDrop(day);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
      className={`transition-all duration-200 rounded-2xl ${
        isDragging && !isSourceDay
          ? isOver
            ? "ring-2 ring-accent bg-accent/10 scale-[1.01]"
            : "ring-1 ring-white/20 bg-white/5"
          : ""
      }`}
    >
      {children}
      {/* Show empty drop zone when dragging and this day has no workouts */}
      {isDragging && isEmpty && !isSourceDay && (
        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          isOver ? "border-accent bg-accent/10 text-accent" : "border-white/20 text-gray-500"
        }`}>
          <svg className="w-6 h-6 mx-auto mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-xs">Drop workout here</p>
        </div>
      )}
    </div>
  );
}

// ===== MOVE-TO MODAL (Mobile fallback) =====
type MoveToModalProps = {
  isOpen: boolean;
  workoutId: string;
  workoutType: "programmed" | "client";
  workoutTitle: string;
  currentDay: string;
  onMove: (toDay: string) => void;
  onClose: () => void;
};

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function MoveToModal({ isOpen, workoutId, workoutType, workoutTitle, currentDay, onMove, onClose }: MoveToModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-secondary border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-heading text-sm uppercase">Move Workout</h3>
          <p className="text-gray-400 text-xs mt-1 truncate">{workoutTitle}</p>
        </div>
        
        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {ALL_DAYS.map(day => (
            <button
              key={day}
              onClick={() => {
                if (day !== currentDay) onMove(day);
              }}
              disabled={day === currentDay}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                day === currentDay
                  ? "bg-accent/10 text-accent cursor-default"
                  : "text-white hover:bg-white/10 active:bg-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{day}</span>
                {day === currentDay && (
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">Current</span>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="p-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-center text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== MOVE BUTTON (shown on each draggable workout for mobile) =====
type MoveButtonProps = {
  onClick: () => void;
  disabled: boolean;
};

export function MoveButton({ onClick, disabled }: MoveButtonProps) {
  if (disabled) return null;
  
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-accent transition-colors px-2 py-1 rounded-lg hover:bg-accent/10 sm:hidden"
      title="Move to another day"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
      Move
    </button>
  );
}

// ===== TOAST NOTIFICATION =====
type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  isVisible: boolean;
  onDismiss: () => void;
};

export function Toast({ message, type = "success", isVisible, onDismiss }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  const bgColor = type === "success" ? "bg-green-500/20 border-green-500/50 text-green-300"
    : type === "error" ? "bg-red-500/20 border-red-500/50 text-red-300"
    : "bg-blue-500/20 border-blue-500/50 text-blue-300";

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl border shadow-lg text-sm font-medium ${bgColor} animate-in fade-in slide-in-from-bottom-4`}>
      <div className="flex items-center gap-2">
        {type === "success" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
        {type === "error" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
        {type === "info" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        <span>{message}</span>
      </div>
    </div>
  );
}

// ===== RESET BUTTON =====
type ResetWeekButtonProps = {
  weekId: string;
  hasMovedWorkouts: boolean;
  onReset: () => Promise<void>;
};

export function ResetWeekButton({ weekId, hasMovedWorkouts, onReset }: ResetWeekButtonProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!hasMovedWorkouts) return null;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-400/30 hover:bg-yellow-400/5"
        title="Reset workouts back to coach's original schedule"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Reset Week
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative w-full max-w-xs mx-4 bg-secondary border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-5">
            <h3 className="text-white font-heading text-sm uppercase mb-2">Reset Week?</h3>
            <p className="text-gray-400 text-xs mb-4 leading-relaxed">
              This will move all workouts back to the days your coach originally scheduled them. Completed and Strava-synced workouts will stay where they are.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-2 text-sm text-white bg-yellow-500/20 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
              >
                {isResetting ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== AUTO-SAVE NOTICE =====
export function AutoSaveNotice() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Changes auto-save when you move workouts</span>
    </div>
  );
}
