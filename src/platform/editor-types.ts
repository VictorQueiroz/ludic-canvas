import type { RefObject } from 'react';
import type { TextInputHandle, TextInputProps } from '../text-input.tsx';

/** @internal Native state is owned by a root, never by a global active editor. */
export interface EditorProps extends Pick<
  TextInputProps,
  | 'value'
  | 'onValueChange'
  | 'placeholder'
  | 'readOnly'
  | 'maxLength'
  | 'type'
  | 'inputMode'
  | 'autoComplete'
  | 'spellCheck'
  | 'dir'
  | 'error'
  | 'onSubmit'
  | 'textStyle'
> {
  multiline: boolean;
  binding: RefObject<TextInputHandle | null>;
}
