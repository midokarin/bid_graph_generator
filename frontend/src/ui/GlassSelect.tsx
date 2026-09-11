// Adapted from bidAgent-frontend; see SOURCE.md. The portal carries the module scope and current theme.
// 液态玻璃下拉选择器：替代原生 <select>（其弹出列表为系统绘制，无法应用毛玻璃）
// 触发器为按钮，弹层经 portal 挂到 body 用 fixed 定位（与 project-dropdown 同款方案），
// 避免祖先 backdrop-filter 形成包含块导致坐标偏移。
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

interface PopPos {
  left: number;
  minWidth: number;
  openUp: boolean;
  top?: number;
  bottom?: number;
}

const POP_GAP = 6;
const POP_MAX_HEIGHT = 264;

const GlassSelect = ({ value, options, onChange, disabled = false, id, ariaLabel, className }: GlassSelectProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState<PopPos | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLUListElement | null>(null);
  const listboxId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // 依触发器视口坐标计算弹层位置，底部空间不足时向上翻
  const measure = useCallback((): PopPos | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const openUp = below < POP_MAX_HEIGHT + POP_GAP && rect.top > below;
    // 向上翻时用 bottom 锚定触发器顶缘，弹层向上生长
    return {
      left: Math.round(rect.left),
      top: openUp ? undefined : Math.round(rect.bottom + POP_GAP),
      bottom: openUp ? Math.round(window.innerHeight - rect.top + POP_GAP) : undefined,
      minWidth: Math.round(rect.width),
      openUp,
    };
  }, []);

  const openList = useCallback(
    (initialActive?: number) => {
      if (disabled) return;
      setActiveIndex(initialActive ?? (selectedIndex >= 0 ? selectedIndex : 0));
      setPos(measure());
      setOpen(true);
    },
    [disabled, measure, selectedIndex],
  );

  const closeList = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) return;
      if (option.value !== value) onChange(option.value);
      closeList(true);
    },
    [options, value, onChange, closeList],
  );

  // 打开期间：外部点击/Escape 关闭，滚动与缩放时跟随重定位
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      closeList(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeList(true);
      }
    };
    const onRelayout = () => {
      const next = measure();
      if (next) setPos(next);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onRelayout);
    window.addEventListener('scroll', onRelayout, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onRelayout);
      window.removeEventListener('scroll', onRelayout, true);
    };
  }, [open, closeList, measure]);

  // 打开后让激活项滚入可视区
  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return;
    popRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openList();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openList(options.length - 1);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex);
    } else if (event.key === 'Tab') {
      closeList(false);
    }
  };

  return (
    <span ref={rootRef} className={`glass-select${className ? ` ${className}` : ''}`} data-open={open || undefined}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="glass-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        onClick={() => (open ? closeList(true) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="glass-select-label">{selected?.label ?? '　'}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && pos
        ? createPortal(
            <div className="bid-graph bid-graph-portal" data-theme={rootRef.current?.closest('[data-theme]')?.getAttribute('data-theme') ?? undefined}>
            <ul
              ref={popRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className={`glass-select-pop${pos.openUp ? ' open-up' : ''}`}
              style={{ top: pos.top, bottom: pos.bottom, left: pos.left, minWidth: pos.minWidth }}
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={index === activeIndex ? 'active' : undefined}
                  onPointerEnter={() => setActiveIndex(index)}
                  onPointerDown={(event) => event.preventDefault() /* 保持触发器焦点，避免外部点击判定抢先关闭 */}
                  onClick={() => commit(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value ? <Check size={13} aria-hidden /> : null}
                </li>
              ))}
            </ul></div>,
            document.body,
          )
        : null}
    </span>
  );
};

export default GlassSelect;
