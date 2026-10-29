import { useImperativeHandle, useRef, type ComponentType, type Ref } from 'react';
import { View } from './primitives.ts';
import type { ViewProps, ViewStyle } from './runtime/types.ts';
import type { EditorProps } from './runtime/editing.ts';

/** Browser font configuration, independent of the offline canvas font atlases. */
export interface NativeTextStyle {
  /** A CSS font-family; load custom fonts with application-owned CSS/FontFace. Default: system-ui. */
  fontFamily?: string;
  fontSize?: number;
  /** Unitless line-height multiplier. Default: 1.4. */
  lineHeight?: number;
  /** CSS pixels, before the root's text scale. */
  letterSpacing?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  /** Inner spacing in CSS pixels. Default: 10. Yoga padding is not used for editor content. */
  padding?: number;
}

/** Methods become available after the field's first painted frame. No DOM node is exposed. */
export interface TextInputHandle {
  /** Returns false if unmounted, suspended, disabled or outside the active modal. */
  focus(): boolean;
  blur(): void;
  /** Focus the field and select its entire contents. */
  select(): boolean;
}

export interface TextInputProps extends Pick<
  ViewProps,
  'id' | 'tabIndex' | 'onFocus' | 'onBlur' | 'onLayout' | 'transition' | 'enter' | 'zIndex' | 'disabled'
> {
  label: string;
  /** Controlled string. Update it synchronously from onValueChange; defer expensive work separately. */
  value: string;
  /** Receives native edits, including composition drafts. Do not transform a composing draft. */
  onValueChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  maxLength?: number;
  type?: 'text' | 'search' | 'password';
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  autoComplete?: string;
  spellCheck?: boolean;
  /** Native text direction. This does not enable bidi for canvas Text. Default: auto. */
  dir?: 'ltr' | 'rtl' | 'auto';
  /** Accessible error description; sets aria-invalid and aria-describedby. */
  error?: string;
  /** Enter requests submission outside IME composition. */
  onSubmit?: (value: string) => void;
  textStyle?: NativeTextStyle;
  /** Explicit Yoga box and WebGL decoration. Defaults to width: 100%, height: 44. */
  style?: ViewStyle;
  ref?: Ref<TextInputHandle>;
}

export interface TextAreaProps extends Omit<TextInputProps, 'type' | 'onSubmit'> {}

// Keep native editing behind View; the public renderer still has four host primitives.
const Field = View as ComponentType<ViewProps & { editor: EditorProps }>;

function NativeField({ ref, multiline, textStyle, style, ...props }: TextInputProps & { multiline: boolean }) {
  const binding = useRef<TextInputHandle | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => binding.current?.focus() ?? false,
      blur: () => binding.current?.blur(),
      select: () => binding.current?.select() ?? false,
    }),
    [],
  );
  if (!props.label.trim() || typeof props.value !== 'string')
    throw new Error('TextInput/TextArea require a nonempty label and a string value');
  if (props.maxLength !== undefined && (!Number.isSafeInteger(props.maxLength) || props.maxLength < 0))
    throw new Error('TextInput/TextArea maxLength must be a nonnegative safe integer');
  const {
    value,
    onValueChange,
    placeholder,
    readOnly,
    maxLength,
    type,
    inputMode,
    autoComplete,
    spellCheck,
    dir,
    error,
    onSubmit,
    ...view
  } = props;
  return (
    <Field
      {...view}
      focusable
      style={{ width: '100%', height: multiline ? 120 : 44, flexShrink: 0, ...style }}
      editor={{
        binding,
        multiline,
        value,
        onValueChange,
        placeholder,
        readOnly,
        maxLength,
        type,
        inputMode,
        autoComplete,
        spellCheck,
        dir,
        error,
        onSubmit,
        textStyle,
      }}
    />
  );
}

/** A controlled native editor over a Yoga/WebGL field. Use in topmost form panels or dialogs. */
export function TextInput(props: TextInputProps) {
  return <NativeField {...props} multiline={false} />;
}

/** A fixed-box native multiline editor; Enter inserts a newline. Native scrolling and resize:false. */
export function TextArea(props: TextAreaProps) {
  return <NativeField {...props} multiline />;
}
