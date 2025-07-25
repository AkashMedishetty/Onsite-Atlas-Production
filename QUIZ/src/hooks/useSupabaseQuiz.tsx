import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Question, QuizState, QuizSettings, Participant } from '../types';
import { unifiedSync, QuizStateUpdate } from '../lib/realtimeSync';

export const useSupabaseQuiz = (sessionId: string) => {
  // Skip hook execution if sessionId is invalid
  const shouldSkip = !sessionId || sessionId === 'skip' || sessionId === '';
  
  // Use useRef to ensure we always have the latest state
  const quizStateRef = useRef<QuizState>({
    questions: [],
    participants: [],
    currentQuestionIndex: -1,
    currentQuestionStartTime: undefined,
    isActive: false,
    isFinished: false,
    showResults: false,
    quizSettings: {
      title: 'New Quiz',
      description: '',
      defaultTimeLimit: 30,
      pointsPerQuestion: 100,
      speedBonus: true,
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
    },
  });

  const [quizState, setQuizState] = useState<QuizState>(quizStateRef.current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update state function
  const updateQuizState = useCallback((newState: QuizState) => {
    console.log('🎯 [QUIZ] UPDATING STATE:', {
      currentQuestionIndex: newState.currentQuestionIndex,
      isActive: newState.isActive,
      showResults: newState.showResults,
      questionsCount: newState.questions.length
    });
    
    quizStateRef.current = newState;
    setQuizState(newState);
  }, []);

  // Load initial quiz data
  const loadQuizData = useCallback(async (retryCount = 0) => {
    if (shouldSkip) return;
    
    try {
      console.log('📊 [QUIZ] Loading quiz data for session:', sessionId);
      
      // Load quiz session
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      console.log('✅ [QUIZ] Session loaded:', {
        id: session.id,
        isActive: session.is_active,
        isFinished: session.is_finished,
        currentQuestionIndex: session.current_question_index,
        showResults: session.show_results
      });

      console.log('🔍 [QUIZ] RAW SESSION DATA:', session);
      // Load questions
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_session_id', sessionId)
        .order('order_index');

      if (questionsError) throw questionsError;

      // Load participants
      const { data: participants, error: participantsError } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('quiz_session_id', sessionId);

      if (participantsError) throw participantsError;

      // Load answers
      const { data: answers, error: answersError } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('quiz_session_id', sessionId);

      if (answersError) throw answersError;

      // Process participants with their answers
      const processedParticipants: Participant[] = (participants || []).map(p => ({
        id: p.id,
        name: p.name,
        mobile: p.mobile,
        score: p.score || 0,
        streak: p.streak || 0,
        badges: p.badges || [],
        avatarColor: p.avatar_color || 'bg-gradient-to-r from-blue-400 to-purple-400',
        joinedAt: new Date(p.joined_at).getTime(),
        lastSeen: p.last_seen,
        answers: (answers || [])
          .filter(a => a.participant_id === p.id)
          .reduce((acc, answer) => {
            acc[answer.question_id] = {
              answerIndex: answer.answer_index,
              isCorrect: answer.is_correct,
              timeToAnswer: parseFloat(answer.time_to_answer),
              pointsEarned: answer.points_earned || 0,
              answeredAt: answer.answered_at,
            };
            return acc;
          }, {} as Record<string, any>),
      }));

      const processedQuestions: Question[] = (questions || []).map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correct_answer,
        timeLimit: q.time_limit || 30,
        points: q.points || 100,
        category: q.category,
        difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
        orderIndex: q.order_index,
        imageUrl: q.image_url || undefined,
        image_url: q.image_url || undefined,
        option_images: q.option_images || undefined,
      }));

      const newState: QuizState = {
        questions: processedQuestions,
        participants: processedParticipants,
        currentQuestionIndex: session.current_question_index ?? -1,
        currentQuestionStartTime: session.current_question_start_time ? new Date(session.current_question_start_time).getTime() : undefined,
        isActive: session.is_active || false,
        isFinished: session.is_finished || false,
        showResults: session.show_results || false,
        quizSettings: {
          title: session.title,
          description: session.description || '',
          defaultTimeLimit: 30,
          pointsPerQuestion: 100,
          speedBonus: true,
          streakBonus: true,
          showLeaderboardDuringQuiz: true,
          allowLateJoining: true,
          shuffleQuestions: false,
          shuffleAnswers: false,
          maxParticipants: 100,
          requireApproval: false,
          ...(session.settings || {}),
        },
        statistics: {
          totalParticipants: processedParticipants.length,
          averageScore: processedParticipants.length > 0 
            ? processedParticipants.reduce((sum, p) => sum + p.score, 0) / processedParticipants.length 
            : 0,
          questionsAnswered: processedParticipants.reduce((sum, p) => sum + Object.keys(p.answers).length, 0),
          averageTimePerQuestion: 0, // This would need to be calculated from answers
          participationRate: processedQuestions.length > 0 && processedParticipants.length > 0
            ? (processedParticipants.reduce((sum, p) => sum + Object.keys(p.answers).length, 0) / (processedQuestions.length * processedParticipants.length)) * 100
            : 0,
          completionRate: processedQuestions.length > 0 && processedParticipants.length > 0
            ? (processedParticipants.filter(p => Object.keys(p.answers).length === processedQuestions.length).length / processedParticipants.length) * 100
            : 0,
        },
      };

      console.log('🎯 [QUIZ] NEW STATE CREATED:', {
        currentQuestionIndex: `DB:${session.current_question_index} -> STATE:${newState.currentQuestionIndex}`,
        isActive: newState.isActive,
        showResults: newState.showResults,
        questionsCount: newState.questions.length
      });

      updateQuizState(newState);

    } catch (err) {
      console.error('❌ [QUIZ] Error loading quiz data:', err);
      
      // Retry logic for network errors
      if (retryCount < 3 && err instanceof Error && err.message.includes('Failed to fetch')) {
        console.log(`🔄 [QUIZ] Retrying loadQuizData (attempt ${retryCount + 1}/3)`);
        setTimeout(() => loadQuizData(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load quiz data');
    }
  }, [sessionId, shouldSkip]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (shouldSkip) return;
    
    console.log('🔄 [QUIZ] Setting up real-time subscriptions for session:', sessionId);
    
    // Load initial data
    loadQuizData();
    
    // Create a single channel for all quiz updates
    const channel = supabase
      .channel(`quiz_realtime_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🔄 [REALTIME] Session update:', payload);
          // Immediate reload for session changes
          loadQuizData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_participants',
          filter: `quiz_session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('👥 [REALTIME] Participants update:', payload);
          loadQuizData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_answers',
          filter: `quiz_session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('💬 [REALTIME] Answers update:', payload);
          loadQuizData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_questions',
          filter: `quiz_session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('❓ [REALTIME] Questions update:', payload);
          loadQuizData();
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Subscription status:', status);
      });

    return () => {
      console.log('🔄 [QUIZ] Cleaning up subscriptions');
      supabase.removeChannel(channel);
    };
  }, [sessionId, shouldSkip, loadQuizData]);

  const addQuestion = async (questionData: Omit<Question, 'id' | 'orderIndex'>) => {
    try {
      setLoading(true);
      console.log('🔄 [QUIZ] Adding question:', questionData.question);
      
      const { data, error } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_session_id: sessionId,
          question: questionData.question,
          options: questionData.options,
          correct_answer: questionData.correctAnswer,
          time_limit: questionData.timeLimit,
          points: questionData.points,
          category: questionData.category,
          difficulty: questionData.difficulty,
          order_index: quizStateRef.current.questions.length,
          image_url: questionData.imageUrl || null,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [QUIZ] Question added successfully:', data);
      
      // Update state immediately without full reload
      const newQuestion: Question = {
        id: data.id,
        question: data.question,
        options: data.options,
        correctAnswer: data.correct_answer,
        timeLimit: data.time_limit,
        points: data.points,
        category: data.category,
        difficulty: data.difficulty as 'easy' | 'medium' | 'hard',
        orderIndex: data.order_index,
        imageUrl: data.image_url || undefined,
      };
      
      const newState = {
        ...quizStateRef.current,
        questions: [...quizStateRef.current.questions, newQuestion],
      };
      
      updateQuizState(newState);
    } catch (err) {
      console.error('❌ [QUIZ] Error adding question:', err);
      // Don't throw, just log the error and reload data immediately
      loadQuizData();
    } finally {
      setLoading(false);
    }
  };

  const makeLive = async () => {
    try {
      setLoading(true);
      console.log('🔄 [QUIZ] Making quiz live...');

      const { error } = await supabase
        .from('quiz_sessions')
        .update({ is_active: true })
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('✅ [QUIZ] Quiz is now live');
      
      // Update state immediately
      const newState = {
        ...quizStateRef.current,
        isActive: true,
      };
      
      updateQuizState(newState);
    } catch (err) {
      console.error('❌ [QUIZ] Error making quiz live:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    try {
      setLoading(true);
      console.log('🔄 [QUIZ] Starting quiz...');
      
      if (quizStateRef.current.questions.length === 0) {
        throw new Error('Cannot start quiz without questions');
      }

      const startTime = new Date().toISOString();

      console.log('🎯 [QUIZ] UPDATING DATABASE - setting current_question_index to 0');
      const { error } = await supabase
        .from('quiz_sessions')
        .update({
          current_question_index: 0,
          current_question_start_time: startTime,
          show_results: false,
        })
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('✅ [QUIZ] Quiz started successfully');
      console.log('🎯 [QUIZ] After start - currentQuestionIndex should be 0');
      
      // Update state immediately
      const newState = {
        ...quizStateRef.current,
        currentQuestionIndex: 0,
        currentQuestionStartTime: new Date(startTime).getTime(),
        showResults: false,
      };
      
      updateQuizState(newState);
      
      // Send unified sync update
      unifiedSync.sendUpdate(sessionId, {
        type: 'START_QUIZ',
        questionIndex: 0,
      });
    } catch (err) {
      console.error('❌ [QUIZ] Error starting quiz:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startQuestion = async (questionIndex: number) => {
    try {
      setLoading(true);
      console.log('🔄 [QUIZ] Starting question', questionIndex + 1);
      
      const startTime = new Date().toISOString();


      const { error } = await supabase
        .from('quiz_sessions')
        .update({
          current_question_index: questionIndex,
          current_question_start_time: startTime,
          show_results: false,
        })
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('✅ [QUIZ] Question started successfully');
      
      // Update state immediately
      const newState = {
        ...quizStateRef.current,
        currentQuestionIndex: questionIndex,
        currentQuestionStartTime: new Date(startTime).getTime(),
        showResults: false,
      };
      
      updateQuizState(newState);
      
      // Send unified sync update
      unifiedSync.sendUpdate(sessionId, {
        type: 'START_QUESTION',
        questionIndex,
      });
    } catch (err) {
      console.error('❌ [QUIZ] Error starting question:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const showResults = async () => {
    try {
      setLoading(true);
      console.log('🔄 [QUIZ] Showing results...');


      const { error } = await supabase
        .from('quiz_sessions')
        .update({ show_results: true })
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('✅ [QUIZ] Results shown successfully');
      
      // Update state immediately
      const newState = {
        ...quizStateRef.current,
        showResults: true,
      };
      
      updateQuizState(newState);
      
      // Send unified sync update
      unifiedSync.sendUpdate(sessionId, {
        type: 'SHOW_RESULTS',
      });
    } catch (err) {
      console.error('❌ [QUIZ] Error showing results:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const finishQuiz = async () => {
    try {
      setLoading(true);
      console.log('🔄 [QUIZ] Finishing quiz...');


      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          is_finished: true,
          show_results: true,
        })
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('✅ [QUIZ] Quiz finished successfully');
      
      // Update state immediately
      const newState = {
        ...quizStateRef.current,
        isFinished: true,
        showResults: true,
      };
      
      updateQuizState(newState);
      
      // Send unified sync update
      unifiedSync.sendUpdate(sessionId, {
        type: 'FINISH_QUIZ',
      });
    } catch (err) {
      console.error('❌ [QUIZ] Error finishing quiz:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateQuizSettings = useCallback(async (newSettings: Partial<QuizSettings>) => {
    try {
      const updatedSettings = { ...quizStateRef.current.quizSettings, ...newSettings };

      const { error } = await supabase
        .from('quiz_sessions')
        .update({
          title: updatedSettings.title,
          description: updatedSettings.description,
          settings: updatedSettings,
        })
        .eq('id', sessionId);

      if (error) throw error;
      
      // Reload data after settings update immediately
      loadQuizData();
    } catch (err) {
      console.error('❌ [QUIZ] Error updating quiz settings:', err);
      throw err;
    }
  }, [sessionId, loadQuizData]);

  // Force update function for manual data reload
  const forceUpdate = useCallback(() => {
    console.log('🔄 [QUIZ] Force update triggered');
    loadQuizData();
  }, [loadQuizData]);

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
    setLoading,
    forceUpdate,
  };
};