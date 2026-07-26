const fs = require("fs");
const path = require("path");

const content = `/**
 * EXERCISE SCREEN
 * Workout plan display + exercise browsing + session logging
 */

import { useTheme } from '@/components/ThemeContext';
import { Colors } from '@/constants/theme';
import { EXERCISE_DATABASE } from '@/constants/ExerciseDatabase';
import { useApp } from '@/contexts/AppContext';
import { WorkoutLogEntry, WorkoutSession } from '@/models/workout';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

type ViewMode = 'plan' | 'browse';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'grid' },
  { id: 'push', name: 'Push', icon: 'arrow-up' },
  { id: 'pull', name: 'Pull', icon: 'arrow-down' },
  { id: 'squat', name: 'Legs', icon: 'body' },
  { id: 'core', name: 'Core', icon: 'fitness' },
  { id: 'cardio', name: 'Cardio', icon: 'heart' },
];

export default function ExerciseScreen() {
  const { currentTheme, isDarkMode } = useTheme();
  const colors = Colors[currentTheme];

  const {
    workoutPlan,
    workoutLog,
    logWorkout,
    regenerateWorkoutPlan,
    isOnboardingComplete,
    currentDate,
  } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>('plan');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());

  const todayDayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, [currentDate]);

  const todaySession: WorkoutSession | null = useMemo(() => {
    if (!workoutPlan) return null;
    return workoutPlan.sessions.find(s => s.dayIndex === todayDayIndex) || null;
  }, [workoutPlan, todayDayIndex]);

  const todayCompleted = useMemo(() => {
    return workoutLog.some(l => l.date === currentDate);
  }, [workoutLog, currentDate]);

  const browseExercises = useMemo(() => {
    const all = EXERCISE_DATABASE.map(e => ({
      id: e.id,
      name: e.name,
      category: e.movementPattern,
      muscle: e.musclesWorked.join(', '),
      difficulty: e.difficulty.charAt(0).toUpperCase() + e.difficulty.slice(1),
      equipment: e.equipment.join(', ') || 'None',
      icon: getExerciseIcon(e.movementPattern),
    }));
    if (selectedCategory === 'all') return all;
    return all.filter(e => e.category === selectedCategory);
  }, [selectedCategory]);

  const handleStartSession = useCallback(() => {
    if (!todaySession) return;
    setActiveSession(todaySession);
    setCompletedExercises(new Set());
  }, [todaySession]);

  const handleToggleExercise = useCallback((exerciseId: string) => {
    setCompletedExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  }, []);

  const handleCompleteSession = useCallback(async () => {
    if (!activeSession) return;
    const entry: WorkoutLogEntry = {
      id: \`log_\${Date.now()}\`,
      date: currentDate,
      sessionName: activeSession.name,
      dayIndex: activeSession.dayIndex,
      exercises: activeSession.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        completed: completedExercises.has(ex.exerciseId),
      })),
      completedAt: new Date().toISOString(),
    };
    await logWorkout(entry);
    setActiveSession(null);
    setCompletedExercises(new Set());
    Alert.alert('Workout Complete!', 'Great job finishing your session!');
  }, [activeSession, completedExercises, currentDate, logWorkout]);

  const handleCancelSession = useCallback(() => {
    Alert.alert('Cancel Workout?', 'Your progress will be lost.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: () => {
        setActiveSession(null);
        setCompletedExercises(new Set());
      }},
    ]);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Exercise</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'plan' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('plan')}
          >
            <Text style={[styles.toggleText, { color: viewMode === 'plan' ? '#fff' : colors.secondaryText }]}>
              Plan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'browse' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('browse')}
          >
            <Text style={[styles.toggleText, { color: viewMode === 'browse' ? '#fff' : colors.secondaryText }]}>
              Browse
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'plan' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {activeSession ? (
            <View style={[styles.sessionCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.sessionHeader}>
                <Text style={[styles.sessionTitle, { color: colors.text }]}>
                  {activeSession.name}
                </Text>
                <TouchableOpacity onPress={handleCancelSession}>
                  <Ionicons name="close-circle" size={24} color="#F44336" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.sessionSubtitle, { color: colors.secondaryText }]}>
                {completedExercises.size} / {activeSession.exercises.length} exercises done
              </Text>
              {activeSession.exercises.map((ex, i) => (
                <TouchableOpacity
                  key={ex.exerciseId + i}
                  style={[
                    styles.sessionExercise,
                    completedExercises.has(ex.exerciseId) && styles.sessionExerciseDone,
                  ]}
                  onPress={() => handleToggleExercise(ex.exerciseId)}
                >
                  <Ionicons
                    name={completedExercises.has(ex.exerciseId) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={completedExercises.has(ex.exerciseId) ? '#4CAF50' : colors.secondaryText}
                  />
                  <View style={styles.sessionExerciseInfo}>
                    <Text style={[
                      styles.sessionExerciseName,
                      { color: colors.text },
                      completedExercises.has(ex.exerciseId) && styles.exerciseNameDone,
                    ]}>
                      {ex.name}
                    </Text>
                    <Text style={[styles.sessionExerciseSets, { color: colors.secondaryText }]}>
                      {ex.sets} sets x {ex.reps} reps
                      {ex.restSeconds ? \` · \${ex.restSeconds}s rest\` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.completeBtn, { backgroundColor: colors.primary }]}
                onPress={handleCompleteSession}
              >
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.completeBtnText}>Complete Session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {todaySession ? (
                <View style={[styles.todayCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.todayHeader}>
                    <Ionicons
                      name={todayCompleted ? 'checkmark-circle' : 'barbell'}
                      size={28}
                      color={todayCompleted ? '#4CAF50' : colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.todayTitle, { color: colors.text }]}>
                        {todayCompleted ? 'Workout Done' : "Today's Workout"}
                      </Text>
                      <Text style={[styles.todaySubtitle, { color: colors.secondaryText }]}>
                        {todaySession.name} · {todaySession.exercises.length} exercises
                      </Text>
                    </View>
                  </View>
                  {!todayCompleted && (
                    <TouchableOpacity
                      style={[styles.startBtn, { backgroundColor: colors.primary }]}
                      onPress={handleStartSession}
                    >
                      <Ionicons name="play" size={20} color="#fff" />
                      <Text style={styles.startBtnText}>Start Workout</Text>
                    </TouchableOpacity>
                  )}
                  {todaySession.exercises.map((ex, i) => (
                    <View key={ex.exerciseId + i} style={styles.exercisePreview}>
                      <View style={[styles.exerciseDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.exercisePreviewName, { color: colors.text }]}>
                        {ex.name}
                      </Text>
                      <Text style={[styles.exercisePreviewSets, { color: colors.secondaryText }]}>
                        {ex.sets}x{ex.reps}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground }]}>
                  <Ionicons name="barbell-outline" size={48} color={colors.secondaryText} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {isOnboardingComplete ? 'Rest Day' : 'No Plan Yet'}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
                    {isOnboardingComplete
                      ? 'Enjoy your rest day or browse exercises below.'
                      : 'Complete onboarding to generate your workout plan.'}
                  </Text>
                </View>
              )}

              {workoutPlan && (
                <View style={[styles.weekCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.weekTitle, { color: colors.text }]}>This Week</Text>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                    const session = workoutPlan.sessions.find(s => s.dayIndex === i);
                    const isToday = i === todayDayIndex;
                    return (
                      <View key={day} style={[styles.weekDay, isToday && styles.weekDayToday]}>
                        <Text style={[
                          styles.weekDayName,
                          { color: isToday ? colors.primary : colors.secondaryText },
                        ]}>
                          {day}
                        </Text>
                        <Text style={[styles.weekDaySession, { color: colors.text }]}>
                          {session ? session.name : 'Rest'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {workoutLog.length > 0 && (
                <View style={[styles.historyCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.weekTitle, { color: colors.text }]}>Recent</Text>
                  {workoutLog.slice(0, 5).map(log => (
                    <View key={log.id} style={styles.historyItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                      <Text style={[styles.historyName, { color: colors.text }]}>{log.sessionName}</Text>
                      <Text style={[styles.historyDate, { color: colors.secondaryText }]}>{log.date}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: selectedCategory === cat.id ? colors.primary : colors.cardBackground },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={selectedCategory === cat.id ? '#fff' : colors.secondaryText}
                />
                <Text style={[
                  styles.categoryChipText,
                  { color: selectedCategory === cat.id ? '#fff' : colors.text },
                ]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FlatList
            data={browseExercises}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.exerciseCard, { backgroundColor: colors.cardBackground }]}
                onPress={() => {
                  setSelectedExercise(item);
                  setShowDetailModal(true);
                }}
              >
                <View style={styles.exerciseCardLeft}>
                  <View style={[styles.exerciseIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name={item.icon as any} size={24} color={colors.primary} />
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.exerciseMuscle, { color: colors.secondaryText }]}>{item.muscle}</Text>
                    <View style={styles.exerciseMeta}>
                      <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
                        <Text style={[styles.difficultyText, { color: getDifficultyColor(item.difficulty) }]}>{item.difficulty}</Text>
                      </View>
                      <Text style={[styles.equipmentText, { color: colors.secondaryText }]}>{item.equipment}</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<View style={{ height: 100 }} />}
          />
        </>
      )}

      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedExercise && (
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalIconContainer}>
                <View style={[styles.modalIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name={selectedExercise.icon as any} size={48} color={colors.primary} />
                </View>
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedExercise.name}</Text>
              <View style={[styles.detailsCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>Muscles</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedExercise.muscle}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>Difficulty</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedExercise.difficulty}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>Equipment</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedExercise.equipment}</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function getExerciseIcon(pattern: string): string {
  const map: Record<string, string> = {
    push: 'arrow-up',
    pull: 'arrow-down',
    squat: 'body',
    hinge: 'barbell',
    core: 'fitness',
    cardio: 'heart',
    flexibility: 'leaf',
  };
  return map[pattern] || 'barbell';
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'beginner': return '#4CAF50';
    case 'intermediate': return '#FF9800';
    case 'advanced': return '#F44336';
    default: return '#9E9E9E';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700' },
  viewToggle: { flexDirection: 'row', borderRadius: 20, overflow: 'hidden' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  toggleText: { fontSize: 14, fontWeight: '600' },
  todayCard: { marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 16 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  todayTitle: { fontSize: 18, fontWeight: '600' },
  todaySubtitle: { fontSize: 13, marginTop: 2 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 25, gap: 8, marginBottom: 16,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  exercisePreview: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  exerciseDot: { width: 8, height: 8, borderRadius: 4 },
  exercisePreviewName: { flex: 1, fontSize: 14, fontWeight: '500' },
  exercisePreviewSets: { fontSize: 13 },
  sessionCard: { marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 16 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sessionTitle: { fontSize: 20, fontWeight: '700' },
  sessionSubtitle: { fontSize: 13, marginBottom: 16 },
  sessionExercise: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  sessionExerciseDone: { opacity: 0.6 },
  sessionExerciseInfo: { flex: 1 },
  sessionExerciseName: { fontSize: 15, fontWeight: '600' },
  exerciseNameDone: { textDecorationLine: 'line-through' },
  sessionExerciseSets: { fontSize: 13, marginTop: 2 },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 25, gap: 8, marginTop: 16,
  },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyCard: {
    marginHorizontal: 20, borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  weekCard: { marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 16 },
  weekTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  weekDay: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  weekDayToday: { borderLeftWidth: 3, borderLeftColor: '#4CAF50', paddingLeft: 8 },
  weekDayName: { fontSize: 14, fontWeight: '600', width: 40 },
  weekDaySession: { fontSize: 14, flex: 1 },
  historyCard: { marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  historyName: { flex: 1, fontSize: 14, fontWeight: '500' },
  historyDate: { fontSize: 12 },
  categoriesContainer: { maxHeight: 50, marginBottom: 16 },
  categoriesContent: { paddingHorizontal: 20, gap: 10 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 20, gap: 6,
  },
  categoryChipText: { fontSize: 14, fontWeight: '500' },
  listContent: { paddingHorizontal: 20 },
  exerciseCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 16, marginBottom: 12,
  },
  exerciseCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  exerciseIcon: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center',
    justifyContent: 'center', marginRight: 14,
  },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  exerciseMuscle: { fontSize: 13, marginBottom: 6 },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  difficultyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  difficultyText: { fontSize: 11, fontWeight: '600' },
  equipmentText: { fontSize: 12 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20 },
  modalIconContainer: { alignItems: 'center', marginBottom: 16 },
  modalIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  detailsCard: { marginHorizontal: 20, borderRadius: 16, padding: 16, marginBottom: 16 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },
});
`;
const target = path.join(__dirname, "..", "app", "(tabs)", "exercise.tsx");
fs.writeFileSync(target, content);
console.log("Written to", target);
