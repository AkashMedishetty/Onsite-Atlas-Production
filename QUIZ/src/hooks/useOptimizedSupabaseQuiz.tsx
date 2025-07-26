import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createBackendClient, isBackendAvailable } from '../lib/backendClient';
import { optimizedSync } from '../lib/optimizedRealtimeSync';
import { supabase } from '../lib/supabase';
import type { QuizState, Question, Participant, QuizSettings, ParticipantAnswer } from '../types';

// Constants for optimization
const LOADING_DEBOUNCE = 500;
const DEFAULT_CACHE_TTL = 30000; // 30 seconds
const FALLBACK_CACHE_TTL = 60000; // 1 minute for cached fallback
const MAX_CACHE_ENTRIES = 50;

// Check if strict backend mode is enabled
const STRICT_BACKEND_MODE = process.env.NEXT_PUBLIC_BACKEND_STRICT === 'true';

console.log(`🔧 [QUIZ] Strict backend mode: ${STRICT_BACKEND_MODE ? 'ENABLED' : 'DISABLED'}`);

// Global cache for quiz data
const quizDataCache = new Map<string, {
  data: QuizState;
  timestamp: number;
  ttl: number;
}>();

// Cache cleanup function
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, cached] of quizDataCache.entries()) {
    if (now - cached.timestamp > cached.ttl) {
      quizDataCache.delete(key);
    }
  }
  
  // Limit cache size
  if (quizDataCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(quizDataCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    toRemove.forEach(([key]) => quizDataCache.delete(key));
  }
};

// Cleanup cache every 5 minutes
setInterval(cleanupCache, 5 * 60 * 1000);

export const useOptimizedSupabaseQuiz = (sessionId: string, hostId?: string) => {
  const shouldSkip = !sessionId;

  // Core state
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    participants: [],
    currentQuestionIndex: -1,
    currentQuestionStartTime: undefined,
    isActive: false,
    isFinished: false,
    showResults: false,
    quizSettings: {
      title: 'Loading...',
      description: '',
      defaultTimeLimit: 30,
      pointsPerQuestion: 100,
      speedBonus: false,
      streakBonus: true,
      showLeaderboardDuringQuiz: true,
      allowLateJoining: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      maxParticipants: 100,
      requireApproval: false,
    },
    statistics: {
      totalParticipants: 0,
      averageScore: 0,
      questionsAnswered: 0,
      averageTimePerQuestion: 0,
      participationRate: 0,
      completionRate: 0,
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isUsingBackend, setIsUsingBackend] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Refs for stable references
  const sessionIdRef = useRef(sessionId);
  const backendClientRef = useRef<any>(null);
  const loadingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update session ref when sessionId changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Check backend availability on mount
  useEffect(() => {
    const checkBackend = async () => {
      if (shouldSkip) return;
      
      try {
        console.log('🔍 [QUIZ] Checking backend availability...');
        const available = await isBackendAvailable();
        setBackendAvailable(available);
        
        if (available) {
          console.log('✅ [QUIZ] Backend available, initializing connection...');
          backendClientRef.current = createBackendClient();
          const connected = await backendClientRef.current.connect();
          setIsUsingBackend(connected);
          setIsConnected(connected);
          
          if (connected) {
            console.log('🚀 [QUIZ] Using Railway backend for 300+ participants');
          } else {
            console.log('⚠️ [QUIZ] Backend connection failed, falling back to Supabase');
            
            // In strict mode, fail if backend is not available
            if (STRICT_BACKEND_MODE) {
              throw new Error('Backend required in strict mode but connection failed');
            }
          }
        } else {
          console.log('⚠️ [QUIZ] Backend not available, using Supabase fallback');
          
          // In strict mode, fail if backend is not available
          if (STRICT_BACKEND_MODE) {
            throw new Error('Backend required in strict mode but not available');
          }
          
          setIsUsingBackend(false);
        }
      } catch (error) {
        console.error('❌ [QUIZ] Backend check failed:', error);
        setBackendAvailable(false);
        setIsUsingBackend(false);
        
        // In strict mode, set error state
        if (STRICT_BACKEND_MODE) {
          setError(error instanceof Error ? error.message : 'Backend required but not available');
          return;
        }
      }
    };

    checkBackend();
  }, [shouldSkip]);

  // Debounced loading setter to prevent flickering
  const setLoadingDebounced = useCallback((isLoading: boolean) => {
    if (loadingDebounceRef.current) {
      clearTimeout(loadingDebounceRef.current);
    }

    if (isLoading) {
      setLoading(true);
    } else {
      loadingDebounceRef.current = setTimeout(() => {
        setLoading(false);
      }, LOADING_DEBOUNCE);
    }
  }, []);

  // Optimized cache management
  const getCachedData = useCallback((sessionId: string): QuizState | null => {
    const cached = quizDataCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }, []);

  const setCachedData = useCallback((sessionId: string, data: QuizState, ttl: number = DEFAULT_CACHE_TTL) => {
    quizDataCache.set(sessionId, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }, []);

  // Backend-enabled data loading
  const loadQuizDataFromBackend = useCallback(async (): Promise<QuizState | null> => {
    if (!backendClientRef.current || !isUsingBackend) return null;

    try {
      console.log('📡 [QUIZ] Loading data from Railway backend...');
      
      // Use backend client to get quiz data
      const quizData = await backendClientRef.current.getQuizData(sessionId);
      
      if (quizData) {
        console.log('✅ [QUIZ] Data loaded from backend:', quizData);
        return quizData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [QUIZ] Backend data loading failed:', error);
      return null;
    }
  }, [sessionId, isUsingBackend]);

  // Supabase fallback data loading
  const loadQuizDataFromSupabase = useCallback(async (): Promise<QuizState | null> => {
    // In strict mode, don't allow Supabase fallback
    if (STRICT_BACKEND_MODE) {
      throw new Error('Supabase fallback not allowed in strict backend mode');
    }
    
    try {
      console.log('📊 [QUIZ] Loading quiz data from Supabase...');

      // Load session data
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', sessionIdRef.current)
        .single();

      if (sessionError) throw sessionError;

      // Load questions with proper ordering
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_session_id', sessionIdRef.current)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      // Load participants with institute field
      const { data: participants, error: participantsError } = await supabase
        .from('quiz_participants')
        .select('id, name, mobile, score, streak, badges, avatar_color, joined_at, last_seen, institute')
        .eq('quiz_session_id', sessionIdRef.current)
        .order('score', { ascending: false });

      if (participantsError) throw participantsError;

      // Process questions
      const processedQuestions: Question[] = (questions || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options || [],
        optionImages: q.option_images || [],
        correctAnswer: q.correct_answer,
        timeLimit: q.time_limit || 30,
        points: q.points || 100,
        category: q.category || '',
        difficulty: q.difficulty || 'medium',
        orderIndex: q.order_index,
        imageUrl: q.image_url || undefined,
      }));

      // Process participants with institute field
      const processedParticipants: Participant[] = (participants || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        mobile: p.mobile,
        institute: p.institute || '',
        score: p.score || 0,
        streak: p.streak || 0,
        badges: p.badges || [],
        avatarColor: p.avatar_color || 'bg-gradient-to-r from-blue-400 to-purple-400',
        joinedAt: new Date(p.joined_at).getTime(),
        lastSeen: p.last_seen,
        answers: {} // Will be loaded when needed
      }));

      const newState: QuizState = {
        questions: processedQuestions,
        participants: processedParticipants,
        currentQuestionIndex: session.current_question_index ?? -1,
        currentQuestionStartTime: session.current_question_start_time ? new Date(session.current_question_start_time).getTime() : null,
        isActive: session.is_active || false,
        isFinished: session.is_finished || false,
        showResults: session.show_results || false,
        quizSettings: {
          title: session.title,
          description: session.description || '',
          defaultTimeLimit: session.settings?.defaultTimeLimit || 30,
          pointsPerQuestion: session.settings?.pointsPerQuestion || 100,
          ...session.settings,
        },
        statistics: {
          totalParticipants: processedParticipants.length,
          averageScore: processedParticipants.length > 0 
            ? processedParticipants.reduce((sum, p) => sum + p.score, 0) / processedParticipants.length 
            : 0,
          participationRate: processedQuestions.length > 0 && processedParticipants.length > 0
            ? (processedParticipants.reduce((sum, p) => sum + Object.keys(p.answers).length, 0) / (processedQuestions.length * processedParticipants.length)) * 100
            : 0,
        },
      };

      return newState;
      
    } catch (error) {
      console.error('❌ [QUIZ] Supabase data loading failed:', error);
      throw error;
    }
  }, []);

  // Unified data loading with backend preference
  const loadQuizData = useCallback(async (useCache: boolean = true): Promise<void> => {
    if (shouldSkip) return;

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    // Check cache first
    if (useCache) {
      const cachedData = getCachedData(currentSessionId);
      if (cachedData) {
        setQuizState(cachedData);
        setError(null);
        return;
      }
    }

    try {
      setLoadingDebounced(true);
      setError(null);

      let newState: QuizState | null = null;

      // Try backend first if available
      if (isUsingBackend && backendClientRef.current) {
        newState = await loadQuizDataFromBackend();
      }

      // Fallback to Supabase if backend fails or unavailable (only if not in strict mode)
      if (!newState && !STRICT_BACKEND_MODE) {
        console.log('🔄 [QUIZ] Using Supabase fallback...');
        newState = await loadQuizDataFromSupabase();
      }

      // In strict mode, fail if no backend data available
      if (!newState && STRICT_BACKEND_MODE) {
        throw new Error('No data available in strict backend mode');
      }

      if (newState) {
        setQuizState(newState);
        setCachedData(currentSessionId, newState);
        console.log(`✅ [QUIZ] Data loaded via ${isUsingBackend ? 'Backend' : 'Supabase'}`);
      }

    } catch (err) {
      console.error('[QUIZ] Error loading quiz data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz data');
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionIdRef, getCachedData, setCachedData, setLoadingDebounced, isUsingBackend, loadQuizDataFromBackend, loadQuizDataFromSupabase]);

  // Handle real-time updates - Use useRef to avoid circular dependencies
  const handleRealtimeUpdateRef = useRef<(update: any) => void>();
  
  // Setup the real-time update handler
  useEffect(() => {
    handleRealtimeUpdateRef.current = (update: any) => {
      console.log('[QUIZ] Received real-time update:', update.type);
      
      // CRITICAL: Only reload for meaningful updates, ignore participant spam
      if (update.type === 'PARTICIPANT_UPDATE') {
        console.log('[QUIZ] Ignoring PARTICIPANT_UPDATE to prevent infinite loop');
        return;
      }
      
      // Invalidate cache for this session
      quizDataCache.delete(sessionIdRef.current);
      
      // Reload data
      loadQuizData(false); // Don't use cache
    };
  }, [loadQuizData]);

  // Setup real-time subscription (backend WebSocket or Supabase)
  useEffect(() => {
    if (shouldSkip || backendAvailable === null) return;

    sessionIdRef.current = sessionId;
    console.log(`[QUIZ] Setting up ${isUsingBackend ? 'backend' : 'Supabase'} subscription for session:`, sessionId);

    // Initial data load
    loadQuizData(true);

    if (isUsingBackend && backendClientRef.current) {
      // Use backend WebSocket for real-time updates
      console.log('🔌 [QUIZ] Setting up backend WebSocket subscription...');
      
      const unsubscribe = backendClientRef.current.subscribeToSession(sessionId, (update: any) => {
        if (handleRealtimeUpdateRef.current) {
          handleRealtimeUpdateRef.current(update);
        }
      });
      
      // Store cleanup for connection interval
      const originalUnsubscribe = unsubscribe;
      unsubscribeRef.current = () => {
        originalUnsubscribe();
        clearInterval(connectionInterval);
      };
    } else {
      // Fallback to Supabase real-time
      console.log('📡 [QUIZ] Setting up Supabase real-time subscription...');
      
      const handleUpdate = (update: any) => {
        if (handleRealtimeUpdateRef.current) {
          handleRealtimeUpdateRef.current(update);
        }
      };

      const unsubscribe = optimizedSync.subscribe(sessionId, handleUpdate, 'host');
      unsubscribeRef.current = unsubscribe;

      // Monitor connection status
      const connectionInterval = setInterval(() => {
        const connected = optimizedSync.getConnectionStatus(sessionId);
        setIsConnected(connected);
      }, 5000);

      // Store cleanup for connection interval
      const originalUnsubscribe = unsubscribe;
      unsubscribeRef.current = () => {
        originalUnsubscribe();
        clearInterval(connectionInterval);
      };
    }

    // Cleanup function
    return () => {
      console.log('[QUIZ] Cleaning up subscription for session:', sessionId);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [sessionId, shouldSkip, isUsingBackend, backendAvailable]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (loadingDebounceRef.current) {
        clearTimeout(loadingDebounceRef.current);
      }
    };
  }, []);

  // Quiz action methods with backend preference
  const addQuestion = useCallback(async (questionData: Omit<Question, 'id' | 'orderIndex'>) => {
    if (shouldSkip) return;

    try {
      setLoadingDebounced(true);
      setError(null);

      if (isUsingBackend && backendClientRef.current) {
        // Use backend API
        console.log('📡 [QUIZ] Adding question via backend...');
        await backendClientRef.current.addQuestion(sessionId, questionData);
      } else {
        // Fallback to Supabase
        console.log('📊 [QUIZ] Adding question via Supabase fallback...');
        const orderIndex = quizState.questions.length;
        const { error } = await supabase
          .from('quiz_questions')
          .insert({
            quiz_session_id: sessionId,
            question: questionData.question,
            options: questionData.options,
            correct_answer: questionData.correctAnswer,
            time_limit: questionData.timeLimit || 30,
            points: questionData.points || 100,
            category: questionData.category || null,
            difficulty: questionData.difficulty || 'medium',
            order_index: orderIndex,
            image_url: questionData.imageUrl || null,
            option_images: questionData.optionImages || null,
          });

        if (error) throw error;
      }

      // Reload data to get the new question
      await loadQuizData(false);
    } catch (err) {
      console.error('[QUIZ] Error adding question:', err);
      setError(err instanceof Error ? err.message : 'Failed to add question');
      throw err;
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionId, quizState.questions.length, loadQuizData, setLoadingDebounced, isUsingBackend]);

  const startQuestion = useCallback(async (index: number) => {
    if (shouldSkip) return;

    try {
      setLoadingDebounced(true);
      setError(null);

      // Bounds checking to prevent invalid question indices
      const totalQuestions = quizState?.questions?.length || 0;
      if (index < 0 || index >= totalQuestions) {
        console.warn(`[QUIZ] Invalid question index ${index}. Total questions: ${totalQuestions}`);
        throw new Error(`Invalid question index ${index}. Total questions: ${totalQuestions}`);
      }

      console.log(`[QUIZ] Starting question ${index + 1} of ${totalQuestions}`);

      if (isUsingBackend && backendClientRef.current) {
        // Use backend API
        console.log('📡 [QUIZ] Starting question via backend...');
        await backendClientRef.current.startQuestion(sessionId, index);
      } else {
        // Fallback to Supabase
        console.log('📊 [QUIZ] Starting question via Supabase fallback...');
        const { error } = await supabase
          .from('quiz_sessions')
          .update({
            current_question_index: index,
            current_question_start_time: new Date().toISOString(),
            show_results: false,
          })
          .eq('id', sessionId);

        if (error) throw error;
      }
    } catch (err) {
      console.error('[QUIZ] Error starting question:', err);
      setError(err instanceof Error ? err.message : 'Failed to start question');
      throw err;
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionId, setLoadingDebounced, quizState?.questions?.length, isUsingBackend]);

  const showResults = useCallback(async () => {
    if (shouldSkip) return;

    try {
      setLoadingDebounced(true);
      setError(null);

      if (isUsingBackend && backendClientRef.current) {
        // Use backend API
        console.log('📡 [QUIZ] Showing results via backend...');
        await backendClientRef.current.showResults(sessionId);
      } else {
        // Fallback to Supabase
        console.log('📊 [QUIZ] Showing results via Supabase fallback...');
        const { error } = await supabase
          .from('quiz_sessions')
          .update({ show_results: true })
          .eq('id', sessionId);

        if (error) throw error;
      }
    } catch (err) {
      console.error('[QUIZ] Error showing results:', err);
      setError(err instanceof Error ? err.message : 'Failed to show results');
      throw err;
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionId, setLoadingDebounced, isUsingBackend]);

  const makeLive = useCallback(async () => {
    if (shouldSkip) return;

    try {
      setLoadingDebounced(true);
      setError(null);
      console.log('[QUIZ] Making quiz live...');

      if (isUsingBackend && backendClientRef.current) {
        // Use backend API
        console.log('📡 [QUIZ] Making live via backend...');
        await backendClientRef.current.makeLive(sessionId);
      } else {
        // Fallback to Supabase
        console.log('📊 [QUIZ] Making live via Supabase fallback...');
        const { error } = await supabase
          .from('quiz_sessions')
          .update({ is_active: true })
          .eq('id', sessionId);

        if (error) throw error;

        // Clear cache to force refresh
        quizDataCache.delete(sessionId);
        
        // Update state immediately
        const currentState = quizState;
        if (currentState) {
          const newState = {
            ...currentState,
            isActive: true,
          };
          setQuizState(newState);
          
          // Update cache with new state
          quizDataCache.set(sessionId, { data: newState, timestamp: Date.now(), ttl: DEFAULT_CACHE_TTL });
        }
        
        // Trigger real-time update by updating the database timestamp
        await supabase
          .from('quiz_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      }
      
      console.log('✅ [QUIZ] Quiz is now live');
      
      // Also reload data to ensure consistency
      await loadQuizData(false);
      
    } catch (err) {
      console.error('[QUIZ] Error making quiz live:', err);
      setError(err instanceof Error ? err.message : 'Failed to make quiz live');
      throw err;
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionId, setLoadingDebounced, quizState, setQuizState, loadQuizData, isUsingBackend]);

  const startQuiz = useCallback(async () => {
    if (shouldSkip) return;

    try {
      setLoadingDebounced(true);
      setError(null);

      if (isUsingBackend && backendClientRef.current) {
        // Use backend API
        console.log('📡 [QUIZ] Starting quiz via backend...');
        await backendClientRef.current.startQuiz(sessionId);
      } else {
        // Fallback to Supabase
        console.log('📊 [QUIZ] Starting quiz via Supabase fallback...');
        const { error } = await supabase
          .from('quiz_sessions')
          .update({
            is_active: true,
            current_question_index: 0,
            current_question_start_time: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (error) throw error;
      }
    } catch (err) {
      console.error('[QUIZ] Error starting quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to start quiz');
      throw err;
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionId, setLoadingDebounced, isUsingBackend]);

  const finishQuiz = useCallback(async () => {
    if (shouldSkip) return;

    try {
      setLoadingDebounced(true);
      setError(null);

      if (isUsingBackend && backendClientRef.current) {
        // Use backend API
        console.log('📡 [QUIZ] Finishing quiz via backend...');
        await backendClientRef.current.finishQuiz(sessionId);
      } else {
        // Fallback to Supabase
        console.log('📊 [QUIZ] Finishing quiz via Supabase fallback...');
        const { error } = await supabase
          .from('quiz_sessions')
          .update({
            is_finished: true,
            show_results: true,
          })
          .eq('id', sessionId);

        if (error) throw error;
      }
    } catch (err) {
      console.error('[QUIZ] Error finishing quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to finish quiz');
      throw err;
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionId, setLoadingDebounced, isUsingBackend]);

  const updateQuizSettings = useCallback(async (settings: Partial<QuizSettings>) => {
    if (shouldSkip) return;

    try {
      setLoadingDebounced(true);
      setError(null);

      if (isUsingBackend && backendClientRef.current) {
        // Use backend API
        console.log('📡 [QUIZ] Updating settings via backend...');
        await backendClientRef.current.updateQuizSettings(sessionId, settings);
      } else {
        // Fallback to Supabase
        console.log('📊 [QUIZ] Updating settings via Supabase fallback...');
        const updateData: any = {};
        if (settings.title !== undefined) updateData.title = settings.title;
        if (settings.description !== undefined) updateData.description = settings.description;
        
        const { error } = await supabase
          .from('quiz_sessions')
          .update(updateData)
          .eq('id', sessionId);

        if (error) throw error;

        // Update local state immediately for better UX
        setQuizState(prev => ({
          ...prev,
          quizSettings: { ...prev.quizSettings, ...settings }
        }));

        // Trigger real-time sync to notify other components by updating session
        console.log('[QUIZ] Triggering sync update for settings change');
        
        // Force a session update to trigger real-time sync across all components
        const { error: syncError } = await supabase
          .from('quiz_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        
        if (!syncError) {
          console.log('[QUIZ] Settings sync update broadcasted successfully');
        }
      }

      // Clear cache to force refresh across all components
      quizDataCache.delete(sessionId);
      
      // Reload data to get fresh state
      setTimeout(() => {
        loadQuizData(false); // Don't use cache
      }, 200);

    } catch (err) {
      console.error('[QUIZ] Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    } finally {
      setLoadingDebounced(false);
    }
  }, [shouldSkip, sessionId, setLoadingDebounced, loadQuizData, isUsingBackend]);

  const forceRefresh = useCallback(async () => {
    if (shouldSkip) return;
    
    // Clear cache and reload
    quizDataCache.delete(sessionId);
    await loadQuizData(false);
  }, [shouldSkip, sessionId, loadQuizData]);

  return {
    quizState,
    loading,
    error,
    addQuestion,
    startQuestion,
    showResults,
    makeLive,
    startQuiz,
    finishQuiz,
    updateQuizSettings,
    forceRefresh,
    isConnected,
    isUsingBackend,
  };
}; 