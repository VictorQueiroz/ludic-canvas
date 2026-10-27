import { Button as ControlButton, Text, type ButtonProps, type ViewStyle } from 'ludic-canvas';
import { colors } from './theme.ts';

export function buttonStyle(primary = false, disabled = false): ViewStyle {
  return {
    paddingX: 14,
    paddingY: 10,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
    background: primary ? colors.mint : '#172c3b',
    borderWidth: 1,
    borderColor: primary ? colors.mint : colors.line,
    opacity: disabled ? 0.4 : 1,
  };
}

export function Button({
  children,
  label,
  onPress,
  hotkey,
  primary = false,
  disabled = false,
  style,
}: ButtonProps & { primary?: boolean }) {
  return (
    <ControlButton
      label={label}
      onPress={onPress}
      hotkey={hotkey}
      disabled={disabled}
      transition={140}
      hoverStyle={{ background: primary ? '#b0efd9' : '#2a424f', borderColor: colors.mint }}
      pressStyle={{ scale: 0.98 }}
      style={{ ...buttonStyle(primary, disabled), ...style }}
    >
      <Text
        style={{ fontFamily: 'display', fontSize: 14, color: primary ? '#0a1c24' : colors.text, textAlign: 'center' }}
      >
        {children}
      </Text>
    </ControlButton>
  );
}
