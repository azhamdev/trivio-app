import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { greetingMessage, SUGGESTIONS } from '@/ai/assistant';
import { askAssistant } from '@/ai/llm';
import EmptyState from '@/components/EmptyState';
import FadeSlideIn from '@/components/FadeSlideIn';
import PressableScale from '@/components/PressableScale';
import { colors, radius, type, USE_NATIVE_DRIVER } from '@/theme/theme';
import { useApp } from '@/context/AppContext';
import { ChatMessage } from '@/types';
import { uid } from '@/utils/format';

export default function AssistantScreen() {
  const router = useRouter();
  const { myGroups, user } = useApp();
  const insets = useSafeAreaInsets();

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const activeGroup = myGroups.find((g) => g.id === activeGroupId) ?? myGroups[0] ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const convoGroupRef = useRef<string | null>(null);

  // New conversation whenever the analyzed trip changes.
  useEffect(() => {
    convoGroupRef.current = activeGroup?.id ?? null;
    setTyping(false);
    if (activeGroup) {
      setMessages([{ id: uid('msg'), role: 'assistant', text: greetingMessage(activeGroup, user) }]);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?.id]);

  const scrollDown = () =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || !activeGroup || typing) return;
    const groupIdAtSend = activeGroup.id;
    setInput('');
    setMessages((prev) => [...prev, { id: uid('msg'), role: 'user', text }]);
    setTyping(true);
    scrollDown();
    const reply = await askAssistant(text, activeGroup, user, messages);
    // Drop the reply if the user switched trips while the model was thinking.
    if (convoGroupRef.current !== groupIdAtSend) return;
    setTyping(false);
    setMessages((prev) => [
      ...prev,
      { id: uid('msg'), role: 'assistant', text: reply.text, offline: reply.offline },
    ]);
    scrollDown();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={styles.sparkTile}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={type.title}>Trivio Assistant</Text>
            <Text style={type.caption}>AI answers, grounded in your trip&apos;s live numbers</Text>
          </View>
        </View>
        {myGroups.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {myGroups.map((g) => {
              const selected = g.id === activeGroup?.id;
              return (
                <PressableScale
                  key={g.id}
                  onPress={() => setActiveGroupId(g.id)}
                  style={[styles.groupChip, selected && styles.groupChipActive]}>
                  <Text style={[styles.groupChipText, selected && styles.groupChipTextActive]}>
                    {g.name}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {!activeGroup ? (
        <EmptyState
          icon="sparkles-outline"
          title="No trip to analyze yet"
          message="Create or join a trip group first — then ask me about budgets, splits, and spending pace."
          actionTitle="Create a trip"
          onAction={() => router.push('/create-group')}
          style={styles.empty}
        />
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.chat}
            renderItem={({ item }) => (
              <FadeSlideIn
                from={10}
                duration={260}
                style={[styles.bubbleRow, item.role === 'user' ? styles.right : styles.left]}>
                <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={item.role === 'user' ? styles.userText : styles.aiText}>
                    {item.text}
                  </Text>
                  {item.offline ? (
                    <Text style={styles.offlineTag}>Offline answer — AI service unreachable</Text>
                  ) : null}
                </View>
              </FadeSlideIn>
            )}
            ListFooterComponent={typing ? <TypingBubble /> : null}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <PressableScale key={s} onPress={() => send(s)} style={styles.suggestionChip}>
                <Text style={styles.suggestionText}>{s}</Text>
              </PressableScale>
            ))}
          </ScrollView>

          <View style={[styles.inputBar, { paddingBottom: 10 }]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about this trip's spending…"
              placeholderTextColor={colors.faint}
              returnKeyType="send"
              onSubmitEditing={() => send()}
            />
            <PressableScale
              onPress={() => send()}
              disabled={!input.trim()}
              style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.4 }]}>
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </PressableScale>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

// Three looping dots while the assistant "thinks".
function TypingBubble() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.bubbleRow, styles.left]}>
      <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sparkTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  chipsRow: { gap: 8, paddingTop: 14 },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  groupChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  groupChipText: { fontSize: 13, fontWeight: '600', color: colors.slate },
  groupChipTextActive: { color: '#FFFFFF' },
  empty: { marginTop: 60 },
  chat: { padding: 20, paddingBottom: 8 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '84%', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 11 },
  aiBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopLeftRadius: 6,
  },
  userBubble: { backgroundColor: colors.primary, borderTopRightRadius: 6 },
  aiText: { ...type.body, fontSize: 14.5 },
  userText: { fontSize: 14.5, lineHeight: 20, color: '#FFFFFF' },
  offlineTag: { fontSize: 11, color: colors.faint, marginTop: 6, fontStyle: 'italic' },
  typingBubble: { flexDirection: 'row', gap: 5, paddingVertical: 15 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.faint },
  suggestions: { gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  suggestionText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 18,
    fontSize: 14.5,
    color: colors.ink,
    ...Platform.select({ web: { outlineStyle: 'none' } as object }),
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
