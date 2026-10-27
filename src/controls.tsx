import { useId, useRef, useState, type ReactNode } from 'react';
import { useUIRoot } from './context.ts';
import { View } from './primitives.ts';
import type { Interactive, UIKeyEvent, UIPointerEvent, ViewProps, ViewStyle } from './runtime/types.ts';

export interface ButtonProps extends Omit<ViewProps, 'role' | 'onPress'> {
  label: string;
  onPress: () => void;
}

/** An unstyled pressable. Compose its contents with Text/Image; style and game state remain yours. */
export function Button(props: ButtonProps) {
  return <View {...props} role="button" />;
}

export interface SwitchProps extends Omit<ViewProps, 'role' | 'checked' | 'onPress' | 'children'> {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode | ((checked: boolean) => ReactNode);
}

/** A controlled switch. Pointer, Enter and Space request a change through onCheckedChange. */
export function Switch({ checked, onCheckedChange, children, ...props }: SwitchProps) {
  return (
    <View {...props} role="switch" checked={checked} onPress={() => !props.disabled && onCheckedChange(!checked)}>
      {typeof children === 'function' ? children(checked) : children}
    </View>
  );
}

export interface SliderState {
  value: number;
  /** Clamped position from zero to one; use it to paint your own track and thumb. */
  ratio: number;
  dragging: boolean;
}

export interface SliderProps extends Omit<
  ViewProps,
  | 'role'
  | 'children'
  | 'focusable'
  | 'valueMin'
  | 'valueMax'
  | 'valueNow'
  | 'onPress'
  | 'onPointerDown'
  | 'onPointerMove'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onKeyDown'
> {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  /** Called after a pointer release or handled key; cancellation does not commit. */
  onValueCommit?: (value: number) => void;
  children: (state: SliderState) => ReactNode;
}

/** A controlled horizontal slider. Supply a nonzero size and your own track/thumb through children. */
export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onValueChange,
  onValueCommit,
  onLayout,
  children,
  ...props
}: SliderProps) {
  if (![value, min, max, step].every(Number.isFinite) || min >= max || step <= 0)
    throw new Error('Slider requires finite values, min < max and step > 0');
  const width = useRef(0);
  const pointer = useRef<number | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  const current = clamp(value);
  const snap = (next: number) => clamp(Number((min + Math.round((next - min) / step) * step).toPrecision(15)));
  const atPointer = (event: UIPointerEvent) => snap(min + (event.localX / width.current) * (max - min));
  const change = (next: number) => {
    if (next !== current) onValueChange(next);
    return next;
  };
  const cancel = () => {
    pointer.current = undefined;
    setDragging(false);
  };
  return (
    <View
      {...props}
      role="slider"
      orientation="horizontal"
      focusable
      valueMin={min}
      valueMax={max}
      valueNow={current}
      onLayout={(box) => {
        width.current = box.width;
        onLayout?.(box);
      }}
      onPointerDown={(event) => {
        if (props.disabled || event.button !== 0 || width.current <= 0) return;
        event.preventDefault();
        event.stopPropagation();
        pointer.current = event.pointerId;
        setDragging(true);
        change(atPointer(event));
      }}
      onPointerMove={(event) => {
        if (props.disabled || pointer.current !== event.pointerId || width.current <= 0) return;
        event.preventDefault();
        event.stopPropagation();
        change(atPointer(event));
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        if (!props.disabled && width.current > 0) onValueCommit?.(change(atPointer(event)));
        cancel();
      }}
      onPointerCancel={cancel}
      onKeyDown={(event) => {
        if (props.disabled) return;
        const next =
          event.key === 'Home'
            ? min
            : event.key === 'End'
              ? max
              : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                ? snap(current + step)
                : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                  ? snap(current - step)
                  : event.key === 'PageUp'
                    ? snap(current + step * 10)
                    : event.key === 'PageDown'
                      ? snap(current - step * 10)
                      : undefined;
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        change(next);
        onValueCommit?.(next);
      }}
    >
      {children({ value: current, ratio: (current - min) / (max - min), dragging: dragging && !props.disabled })}
    </View>
  );
}

export interface TabProps extends Omit<ViewProps, 'role' | 'selected' | 'onPress'> {
  label: string;
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
}

/** A controlled tab. Tabs adds arrow-key navigation and one Tab stop for a collection. */
export function Tab({ value, selected, onSelect, ...props }: TabProps) {
  return (
    <View
      {...props}
      role="tab"
      selected={selected}
      tabIndex={props.tabIndex ?? (selected ? 0 : -1)}
      onPress={() => !props.disabled && onSelect(value)}
    />
  );
}

export interface TabItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TabState {
  selected: boolean;
  disabled: boolean;
}

export interface TabsProps extends Omit<ViewProps, 'role' | 'children' | 'onKeyDown'> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: readonly TabItem[];
  orientation?: 'horizontal' | 'vertical';
  /** Wrap at the ends. Default: true. */
  loop?: boolean;
  tabStyle?: ViewStyle | ((state: TabState) => ViewStyle);
  tabHoverStyle?: Interactive['hoverStyle'];
  tabPressStyle?: Interactive['pressStyle'];
  children: (item: TabItem, state: TabState) => ReactNode;
}

/** Controlled tabs with automatic activation, disabled-item skipping, Home/End and roving focus. */
export function Tabs({
  value,
  onValueChange,
  items,
  orientation = 'horizontal',
  loop = true,
  tabStyle,
  tabHoverStyle,
  tabPressStyle,
  children,
  style,
  ...props
}: TabsProps) {
  const root = useUIRoot();
  const generated = useId();
  const prefix = props.id ?? generated;
  if (new Set(items.map((item) => item.value)).size !== items.length) throw new Error('Tabs values must be unique');
  const enabled = items.filter((item) => !props.disabled && !item.disabled);
  const tabStop = enabled.find((item) => item.value === value) ?? enabled[0];
  const id = (item: TabItem) => `${prefix}/tab/${item.value}`;
  const navigate = (event: UIKeyEvent, from: TabItem) => {
    const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const backward = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    if (![forward, backward, 'Home', 'End'].includes(event.key) || !enabled.length) return;
    event.preventDefault();
    event.stopPropagation();
    let index = enabled.findIndex((item) => item.value === from.value);
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = enabled.length - 1;
    else {
      index += event.key === forward ? 1 : -1;
      index = loop ? (index + enabled.length) % enabled.length : Math.max(0, Math.min(enabled.length - 1, index));
    }
    const next = enabled[index]!;
    root.focus(id(next));
    if (next.value !== value) onValueChange(next.value);
  };
  return (
    <View
      {...props}
      role="tablist"
      orientation={orientation}
      style={{ flexDirection: orientation === 'horizontal' ? 'row' : 'column', ...style }}
    >
      {items.map((item) => {
        const state = { selected: item.value === value, disabled: Boolean(props.disabled || item.disabled) };
        return (
          <Tab
            key={item.value}
            id={id(item)}
            value={item.value}
            label={item.label}
            selected={state.selected}
            disabled={state.disabled}
            tabIndex={item === tabStop ? 0 : -1}
            onSelect={onValueChange}
            onKeyDown={(event) => navigate(event, item)}
            hoverStyle={tabHoverStyle}
            pressStyle={tabPressStyle}
            style={typeof tabStyle === 'function' ? tabStyle(state) : tabStyle}
          >
            {children(item, state)}
          </Tab>
        );
      })}
    </View>
  );
}

export interface DialogProps extends Omit<ViewProps, 'role' | 'modal' | 'onKeyDown'> {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closeOnEscape?: boolean;
}

/** An unstyled modal scope. The runtime traps/restores focus; the application controls visibility. */
export function Dialog({ open, onOpenChange, closeOnEscape = true, style, ...props }: DialogProps) {
  if (!open) return null;
  return (
    <View
      {...props}
      role="dialog"
      modal
      block
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', ...style }}
      onKeyDown={(event) => {
        if (closeOnEscape && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
    />
  );
}

export interface ScrollAreaProps extends Omit<ViewProps, 'role'> {
  label: string;
}

/** A vertically scrolling region using the root's wheel, touch and focus-reveal behavior. Size it explicitly. */
export function ScrollArea({ style, ...props }: ScrollAreaProps) {
  return <View {...props} role="region" style={{ ...style, overflow: 'scroll' }} />;
}
