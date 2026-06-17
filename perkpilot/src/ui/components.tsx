import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, typography, useTheme, type Palette } from './theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll,
  edges = ['top', 'left', 'right'],
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: space(24) }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

export function LargeTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: space(5), paddingTop: space(2), paddingBottom: space(3) }}>
      <Text style={[typography.largeTitle, { color: c.text }]}>{children}</Text>
      {subtitle ? (
        <Text style={[typography.subhead, { color: c.textSecondary, marginTop: space(1) }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const makeText =
  (variant: keyof typeof typography, pick: (c: Palette) => string) =>
  ({ children, style, numberOfLines }: { children: React.ReactNode; style?: TextStyle; numberOfLines?: number }) => {
    const { c } = useTheme();
    return (
      <Text numberOfLines={numberOfLines} style={[typography[variant], { color: pick(c) }, style]}>
        {children}
      </Text>
    );
  };

export const Title = makeText('title', (c) => c.text);
export const Headline = makeText('headline', (c) => c.text);
export const Body = makeText('body', (c) => c.text);
export const Secondary = makeText('subhead', (c) => c.textSecondary);
export const Footnote = makeText('footnote', (c) => c.textSecondary);

export function SectionHeader({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Text
      style={{
        ...typography.footnote,
        color: c.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginLeft: space(5),
        marginBottom: space(2),
        marginTop: space(5),
      }}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Grouped list (inset, iOS table style)
// ---------------------------------------------------------------------------

export function Section({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={style}>
      {header ? <SectionHeader>{header}</SectionHeader> : null}
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: space(4) }} />
            ) : null}
          </View>
        ))}
      </View>
      {footer ? (
        <Text style={{ ...typography.footnote, color: c.textSecondary, marginHorizontal: space(5), marginTop: space(2) }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function Row({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  value,
  valueColor,
  trailing,
  chevron,
  onPress,
  destructive,
}: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: string;
  valueColor?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { c } = useTheme();
  const body = (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBg ?? c.accent }]}>
          <Ionicons name={icon} size={17} color={iconColor ?? '#fff'} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: destructive ? c.red : c.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle != null ? (
          <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value != null ? (
        <Text style={[typography.body, { color: valueColor ?? c.textSecondary, marginLeft: space(2) }]}>{value}</Text>
      ) : null}
      {trailing}
      {chevron ? <Ionicons name="chevron-forward" size={17} color={c.textTertiary} style={{ marginLeft: space(1) }} /> : null}
    </View>
  );

  if (!onPress) return <View style={styles.rowPad}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rowPad, pressed && { backgroundColor: c.fill }]}
    >
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card (elevated)
// ---------------------------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, shadowColor: c.shadow },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badge / Pill
// ---------------------------------------------------------------------------

export function Pill({ label, color, soft = true }: { label: string; color: string; soft?: boolean }) {
  return (
    <View style={[styles.pill, soft ? { backgroundColor: color + '22' } : { backgroundColor: color }]}>
      <Text style={{ ...typography.caption, fontWeight: '600', color: soft ? color : '#fff' }}>{label}</Text>
    </View>
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = 'filled',
  tone = 'accent',
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'filled' | 'tinted' | 'plain';
  tone?: 'accent' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { c } = useTheme();
  const toneColor = tone === 'destructive' ? c.red : c.accent;
  const bg = variant === 'filled' ? toneColor : variant === 'tinted' ? c.accentSoft : 'transparent';
  const fg = variant === 'filled' ? c.onAccent : toneColor;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ ...typography.headline, color: fg }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Progress + segmented control
// ---------------------------------------------------------------------------

export function ProgressBar({ progress, color }: { progress: number; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: c.fill }]}>
      <View style={{ height: '100%', width: `${Math.min(1, Math.max(0, progress)) * 100}%`, backgroundColor: color ?? c.accent, borderRadius: radius.pill }} />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.fill }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segmentItem, active && { backgroundColor: c.surface, shadowColor: c.shadow }]}
          >
            <Text
              style={{
                ...typography.footnote,
                fontWeight: active ? '600' : '400',
                color: active ? c.text : c.textSecondary,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Status views
// ---------------------------------------------------------------------------

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon?: IconName; title: string; message?: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.center}>
      {icon ? <Ionicons name={icon} size={44} color={c.textTertiary} style={{ marginBottom: space(3) }} /> : null}
      <Text style={[typography.headline, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[typography.subhead, { color: c.textSecondary, textAlign: 'center', marginTop: space(1) }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginHorizontal: space(4), borderRadius: radius.md, overflow: 'hidden' },
  rowPad: { paddingHorizontal: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: space(2.5) },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  card: {
    borderRadius: radius.lg,
    padding: space(4),
    marginHorizontal: space(4),
    marginBottom: space(3),
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  pill: { paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, alignSelf: 'flex-start' },
  button: { borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', justifyContent: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  segment: { flexDirection: 'row', borderRadius: radius.sm + 1, padding: 2 },
  segmentItem: {
    flex: 1,
    paddingVertical: space(1.5),
    borderRadius: radius.sm,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(8) },
});
