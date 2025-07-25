import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Trophy, Zap, Target, Users, CheckCircle, XCircle, Award, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unifiedSync } from '../lib/realtimeSync';

interface ParticipantQuizProps {
  sessionId: string;
  participantId: string;
  participantName: string;
  participantMobile: string;
  onBack: () => void;
}

interface QuizState {
  isActive: boolean;
  isFinished: boolean;
  currentQuestionIndex: number;
  currentQuestionStartTime: string | null;
  showResults: boolean;
  title: string;
  description: string;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  time_limit: number;
  points: number;
  order_index: number;
  image_url?: string;
  option_images?: string[];
}

interface Participant {
  id: string;
  name: string;
  score: number;
  streak: number;
  badges: string[];
  avatar_color: string;
}

export const ParticipantQuiz: React.FC<ParticipantQuizProps> = ({
  sessionId,
  participantId,
  participantName,
  participantMobile,
  onBack,
}) => {
  // Update last seen timestamp on mount and periodically
  useEffect(() => {
    const updateLastSeen = async () => {
      try {
        await supabase
          .from('quiz_participants')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', participantId);
      } catch (error) {
        console.error('Failed to update last seen:', error);
      }
    };
    
    updateLastSeen();
    const interval = setInterval(updateLastSeen, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [participantId]);

  const [quizState, setQuizState] = useState<QuizState>({
    isActive: false,
    isFinished: false,
    currentQuestionIndex: -1,
    currentQuestionStartTime: null,
    showResults: false,
    title: 'Loading...',
    description: '',
  });
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to unified sync updates
  useEffect(() => {
    if (!sessionId) return;

    console.log('⚡ [PARTICIPANT] Setting up unified sync for session:', sessionId);

    const unsubscribe = unifiedSync.subscribeToUpdates(sessionId, (update) => {
      console.log('🚀 [PARTICIPANT] Unified sync update:', update.type, 'at', new Date(update.timestamp).toISOString());
      
      // Immediate state updates without delays
      switch (update.type) {
        case 'START_QUIZ':
        case 'START_QUESTION':
          console.log('⚡ [PARTICIPANT] Question update, reloading data immediately');
          // Reset answer state immediately
          setHasAnswered(false);
          setSelectedAnswer(null);
          loadQuizData();
          break;
        case 'SHOW_RESULTS':
          console.log('⚡ [PARTICIPANT] Results update, reloading data immediately');
          loadQuizData();
          break;
        case 'FINISH_QUIZ':
          console.log('⚡ [PARTICIPANT] Quiz finished, reloading data immediately');
          loadQuizData();
          break;
      }
    }, 'participant');

    return unsubscribe;
  }, [sessionId]);
  // Load initial data
  useEffect(() => {
    console.log('🎮 [PARTICIPANT] Initializing for session:', sessionId, 'participant:', participantId);
    loadQuizData();
    
    // Setup real-time subscriptions
    const cleanup = setupRealtimeSubscriptions();
    
    return () => {
      console.log('🔄 [PARTICIPANT] Cleaning up subscriptions');
      cleanup();
    };
  }, [sessionId]);

  // Timer for current question
  useEffect(() => {
    if (quizState.isActive && quizState.currentQuestionStartTime && !quizState.showResults && currentQuestion) {
      const startTime = new Date(quizState.currentQuestionStartTime).getTime();
      const timeLimit = currentQuestion.time_limit * 1000;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, timeLimit - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          clearInterval(interval);
          setTimeRemaining(0);
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [quizState.currentQuestionStartTime, quizState.showResults, currentQuestion]);

  const loadQuizData = async () => {
    try {
      setLoading(true);
      
      // Load quiz session
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      setQuizState({
        isActive: session.is_active,
        isFinished: session.is_finished,
        currentQuestionIndex: session.current_question_index,
        currentQuestionStartTime: session.current_question_start_time,
        showResults: session.show_results,
        title: session.title,
        description: session.description,
      });

      // Load current question if quiz is active
      if (session.current_question_index >= 0) {
        const { data: question, error: questionError } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_session_id', sessionId)
          .eq('order_index', session.current_question_index)
          .single();

        if (!questionError && question) {
          setCurrentQuestion(question);
          
          // Check if participant has already answered this question
          const { data: existingAnswer } = await supabase
            .from('quiz_answers')
            .select('*')
            .eq('participant_id', participantId)
            .eq('question_id', question.id)
            .single();

          if (existingAnswer) {
            setHasAnswered(true);
            setSelectedAnswer(existingAnswer.answer_index);
          }
        }
      }

      // Load participants for leaderboard
      const { data: participantsData, error: participantsError } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('quiz_session_id', sessionId)
        .order('score', { ascending: false });

      if (!participantsError && participantsData) {
        setParticipants(participantsData);
        const me = participantsData.find(p => p.id === participantId);
        if (me) setMyParticipant(me);
      }

    } catch (err) {
      console.error('Error loading quiz data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz data');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    console.log('📡 [PARTICIPANT] Setting up subscriptions for session:', sessionId, 'participant:', participantId);
    
    // Create unique channel name
    const channelName = `participant_db_${sessionId}_${participantId}_${Date.now()}`;
    
    const sessionChannel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          console.log('🔄 [PARTICIPANT] Session update:', payload.new);
          const session = payload.new;
          
          // Update state immediately
          setQuizState(prev => {
            const newState = {
              ...prev,
              isActive: session.is_active,
              isFinished: session.is_finished,
              currentQuestionIndex: session.current_question_index,
              currentQuestionStartTime: session.current_question_start_time,
              showResults: session.show_results,
              title: session.title || prev.title,
              description: session.description || prev.description,
            };
            
            // Handle question changes
            if (prev.currentQuestionIndex !== session.current_question_index) {
              setHasAnswered(false);
              setSelectedAnswer(null);
              loadCurrentQuestion(session.current_question_index);
            }
            
            return newState;
          });
          // Let unified sync handle this
          loadQuizData();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_participants', filter: `quiz_session_id=eq.${sessionId}` },
        (payload) => {
          console.log('👥 [PARTICIPANT] Participants update received:', payload);
          loadParticipants();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_answers', filter: `quiz_session_id=eq.${sessionId}` },
        (payload) => {
          console.log('💬 [PARTICIPANT] Answers update received:', payload);
          loadParticipants();
        }
      )
      .subscribe((status) => {
        console.log('📡 [PARTICIPANT] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [PARTICIPANT] Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [PARTICIPANT] Channel subscription error');
          // Retry subscription after delay
          setTimeout(() => {
            console.log('🔄 [PARTICIPANT] Retrying subscription...');
            setupRealtimeSubscriptions();
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ [PARTICIPANT] Subscription timed out');
          // Retry subscription
          setTimeout(() => {
            console.log('🔄 [PARTICIPANT] Retrying after timeout...');
            setupRealtimeSubscriptions();
          }, 1000);
        }
      });

    return () => {
      console.log('🔄 [PARTICIPANT] Cleaning up subscriptions');
      supabase.removeChannel(sessionChannel);
    };
  };

  const loadCurrentQuestion = async (questionIndex: number) => {
    if (questionIndex >= 0) {
      const { data: question, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_session_id', sessionId)
        .eq('order_index', questionIndex)
        .single();

      if (!error && question) {
        setCurrentQuestion(question);
        
        // Check if already answered
        const { data: existingAnswer } = await supabase
          .from('quiz_answers')
          .select('*')
          .eq('participant_id', participantId)
          .eq('question_id', question.id)
          .single();

        if (existingAnswer) {
          setHasAnswered(true);
          setSelectedAnswer(existingAnswer.answer_index);
        }
      }
    } else {
      setCurrentQuestion(null);
    }
  };

  const loadParticipants = async () => {
    const { data: participantsData, error } = await supabase
      .from('quiz_participants')
      .select('*')
      .eq('quiz_session_id', sessionId)
      .order('score', { ascending: false });

    if (!error && participantsData) {
      setParticipants(participantsData);
      const me = participantsData.find(p => p.id === participantId);
      if (me) setMyParticipant(me);
    }
  };

  const submitAnswer = async (answerIndex: number) => {
    if (!currentQuestion || hasAnswered || !quizState.currentQuestionStartTime) return;

    try {
      const timeToAnswer = (Date.now() - new Date(quizState.currentQuestionStartTime).getTime()) / 1000;
      const isCorrect = answerIndex === currentQuestion.correct_answer;
      
      // Calculate points (simplified version)
      let pointsEarned = 0;
      if (isCorrect) {
        pointsEarned = currentQuestion.points;
        // Speed bonus
        const speedMultiplier = Math.max(0.5, 1 - (timeToAnswer / currentQuestion.time_limit) * 0.5);
        pointsEarned = Math.round(pointsEarned * speedMultiplier);
      }

      // Submit answer
      const { error: answerError } = await supabase
        .from('quiz_answers')
        .insert({
          quiz_session_id: sessionId,
          participant_id: participantId,
          question_id: currentQuestion.id,
          answer_index: answerIndex,
          is_correct: isCorrect,
          time_to_answer: timeToAnswer,
          points_earned: pointsEarned,
        });

      if (answerError) throw answerError;

      // Update participant score and streak
      const newScore = (myParticipant?.score || 0) + pointsEarned;
      const newStreak = isCorrect ? (myParticipant?.streak || 0) + 1 : 0;

      const { error: participantError } = await supabase
        .from('quiz_participants')
        .update({
          score: newScore,
          streak: newStreak,
          last_seen: new Date().toISOString(),
        })
        .eq('id', participantId);

      if (participantError) throw participantError;

      setSelectedAnswer(answerIndex);
      setHasAnswered(true);

    } catch (err) {
      console.error('Error submitting answer:', err);
      alert('Failed to submit answer. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-2xl font-black text-white mb-4 font-mono">CONNECTING TO QUIZ</div>
          <div className="text-cyan-400 font-mono">SYNCHRONIZING DATA...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500 p-8 text-center max-w-md">
          <h2 className="text-xl font-black text-red-300 mb-4 font-mono">CONNECTION ERROR</h2>
          <p className="text-red-200 mb-6 font-mono">{error}</p>
          <button
            onClick={onBack}
            className="bg-red-500 hover:bg-red-400 text-white px-6 py-3 font-mono font-bold uppercase tracking-wider transition-colors"
          >
            RETURN TO HOME
          </button>
        </div>
      </div>
    );
  }

  // Waiting for quiz to start
  if (!quizState.isActive) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Cyberpunk grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        
        {/* Neon accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent"></div>
        
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <div className="text-center max-w-2xl">
            <div className="w-24 h-24 bg-black border-2 border-cyan-400 flex items-center justify-center mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-cyan-400/10 animate-pulse"></div>
              <Users className="w-12 h-12 text-cyan-400 relative z-10" />
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black text-white mb-6 font-mono tracking-tight">
              STANDBY MODE
            </h1>
            
            <div className="bg-black border border-cyan-400/50 p-6 mb-8">
              <div className="text-cyan-400 font-mono font-bold mb-2">PARTICIPANT STATUS</div>
              <div className="text-white font-mono text-xl font-black mb-4">{participantName}</div>
              <div className="text-gray-400 font-mono text-sm">MOBILE: {participantMobile}</div>
            </div>
            
            <div className="bg-black border border-yellow-400/50 p-6 mb-8">
              <div className="text-yellow-400 font-mono font-bold mb-2">QUIZ SESSION</div>
              <div className="text-white font-mono text-2xl font-black mb-2">{quizState.title}</div>
              <div className="text-gray-400 font-mono text-sm">{quizState.description}</div>
            </div>
            
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="w-4 h-4 bg-yellow-400 animate-pulse"></div>
              <span className="text-yellow-400 font-mono font-bold text-lg tracking-wider">WAITING FOR HOST TO START QUIZ</span>
              <div className="w-4 h-4 bg-cyan-400 animate-pulse delay-500"></div>
            </div>
            
            {participants.length > 0 && (
              <div className="bg-black border border-purple-400/50 p-6">
                <div className="text-purple-400 font-mono font-bold mb-4">PARTICIPANTS ONLINE: {participants.length}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {participants.slice(0, 12).map((participant) => (
                    <div key={participant.id} className="text-white font-mono text-sm p-2 bg-gray-800/50 border border-gray-600">
                      {participant.name}
                    </div>
                  ))}
                  {participants.length > 12 && (
                    <div className="text-gray-400 font-mono text-sm p-2 bg-gray-800/50 border border-gray-600">
                      +{participants.length - 12} more
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <button
              onClick={onBack}
              className="mt-8 bg-black border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white px-6 py-3 font-mono font-bold uppercase tracking-wider transition-colors"
            >
              LEAVE QUIZ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz finished - show final results
  if (quizState.isFinished) {
    const myRank = participants.findIndex(p => p.id === participantId) + 1;
    
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Cyberpunk grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,215,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        
        {/* Neon accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
        
        <div className="relative z-10 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-black border-2 border-yellow-400 flex items-center justify-center mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-yellow-400/10 animate-pulse"></div>
                <Trophy className="w-12 h-12 text-yellow-400 relative z-10" />
              </div>
              
              <h1 className="text-4xl sm:text-6xl font-black text-white mb-4 font-mono tracking-tight">
                QUIZ COMPLETE
              </h1>
              
              <div className="text-yellow-400 font-mono text-lg font-bold tracking-wider">
                FINAL RESULTS
              </div>
            </div>

            {/* My Results */}
            <div className="bg-black border border-yellow-400 p-6 mb-8">
              <div className="text-center">
                <div className="text-yellow-400 font-mono font-bold mb-2">YOUR PERFORMANCE</div>
                <div className="text-white font-mono text-3xl font-black mb-4">{participantName}</div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-black border border-gray-600 p-4">
                    <div className="text-yellow-400 font-mono text-xs font-bold mb-1">RANK</div>
                    <div className="text-white font-mono text-2xl font-black">#{myRank}</div>
                  </div>
                  <div className="bg-black border border-gray-600 p-4">
                    <div className="text-green-400 font-mono text-xs font-bold mb-1">SCORE</div>
                    <div className="text-white font-mono text-2xl font-black">{myParticipant?.score || 0}</div>
                  </div>
                  <div className="bg-black border border-gray-600 p-4">
                    <div className="text-orange-400 font-mono text-xs font-bold mb-1">STREAK</div>
                    <div className="text-white font-mono text-2xl font-black">{myParticipant?.streak || 0}</div>
                  </div>
                  <div className="bg-black border border-gray-600 p-4">
                    <div className="text-purple-400 font-mono text-xs font-bold mb-1">BADGES</div>
                    <div className="text-white font-mono text-2xl font-black">{myParticipant?.badges?.length || 0}</div>
                  </div>
                </div>
                
                {myParticipant?.badges && myParticipant.badges.length > 0 && (
                  <div className="mt-4">
                    <div className="text-purple-400 font-mono text-sm font-bold mb-2">ACHIEVEMENTS UNLOCKED</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {myParticipant.badges.map((badge, index) => (
                        <span key={index} className="px-3 py-1 bg-purple-500/20 border border-purple-400 text-purple-300 font-mono text-xs font-bold">
                          {badge.replace('-', ' ').toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-black border border-cyan-400 p-6 mb-8">
              <div className="text-cyan-400 font-mono font-bold mb-4 text-center">FINAL LEADERBOARD</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {participants.slice(0, 10).map((participant, index) => (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-3 border transition-all duration-300 ${
                      participant.id === participantId
                        ? 'bg-cyan-400/20 border-cyan-400 shadow-lg'
                        : index === 0
                        ? 'bg-yellow-400/20 border-yellow-400'
                        : index === 1
                        ? 'bg-gray-400/20 border-gray-400'
                        : index === 2
                        ? 'bg-orange-400/20 border-orange-400'
                        : 'bg-gray-800/50 border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center font-mono font-bold text-sm ${
                        index === 0 ? 'bg-yellow-400 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-orange-400 text-black' :
                        'bg-gray-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-white font-mono font-bold">{participant.name}</div>
                        {participant.streak > 1 && (
                          <div className="text-orange-300 font-mono text-xs">🔥 {participant.streak} streak</div>
                        )}
                      </div>
                    </div>
                    <div className="text-white font-mono font-bold text-lg">
                      {participant.score.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={onBack}
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-8 py-4 font-mono font-bold uppercase tracking-wider transition-colors"
              >
                RETURN TO HOME
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active question
  if (currentQuestion && quizState.currentQuestionIndex >= 0 && !quizState.showResults) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Cyberpunk grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        
        {/* Neon accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent"></div>
        
        <div className="relative z-10 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-cyan-400 font-mono font-bold">
                QUESTION {quizState.currentQuestionIndex + 1}
              </div>
              <div className="flex items-center gap-4">
                {timeRemaining !== null && (
                  <div className={`text-2xl font-black font-mono ${
                    timeRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-white'
                  }`}>
                    <Clock className="w-6 h-6 inline mr-2" />
                    {timeRemaining}s
                  </div>
                )}
                <div className="text-white font-mono">
                  <Target className="w-5 h-5 inline mr-1" />
                  {currentQuestion.points} PTS
                </div>
              </div>
            </div>

            {/* Question */}
            <div className="bg-black border border-cyan-400 p-6 sm:p-8 mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-6 font-mono leading-tight">
                {currentQuestion.question}
              </h2>
              
              {/* Question Image */}
              {currentQuestion.image_url && (
                <div className="mb-6 flex justify-center">
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="max-w-full max-h-64 object-contain rounded-lg border border-cyan-400/50"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="grid gap-4">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !hasAnswered && submitAnswer(index)}
                    disabled={hasAnswered || timeRemaining === 0}
                    className={`p-4 sm:p-6 text-left transition-all duration-300 font-mono font-bold text-lg border-2 ${
                      hasAnswered
                        ? selectedAnswer === index
                          ? index === currentQuestion.correct_answer
                            ? 'bg-green-500/20 border-green-400 text-green-300'
                            : 'bg-red-500/20 border-red-400 text-red-300'
                          : index === currentQuestion.correct_answer
                          ? 'bg-green-500/20 border-green-400 text-green-300'
                          : 'bg-gray-800/50 border-gray-600 text-gray-400'
                        : 'bg-black border-gray-600 text-white hover:border-cyan-400 hover:bg-cyan-400/10 cursor-pointer transform hover:scale-105'
                    } ${timeRemaining === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Option Image */}
                        {currentQuestion.option_images?.[index] && (
                          <img
                            src={currentQuestion.option_images[index]}
                            alt={`Option ${index + 1}`}
                            className="w-16 h-16 object-contain rounded border border-gray-600"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <span className="flex-1">{option}</span>
                      </div>
                      {hasAnswered && (
                        <div className="ml-4">
                          {selectedAnswer === index && index === currentQuestion.correct_answer && (
                            <CheckCircle className="w-6 h-6 text-green-400" />
                          )}
                          {selectedAnswer === index && index !== currentQuestion.correct_answer && (
                            <XCircle className="w-6 h-6 text-red-400" />
                          )}
                          {selectedAnswer !== index && index === currentQuestion.correct_answer && (
                            <CheckCircle className="w-6 h-6 text-green-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {hasAnswered && (
                <div className="mt-6 p-4 bg-black border border-cyan-400/50">
                  <div className="text-cyan-400 font-mono font-bold text-center">
                    ANSWER SUBMITTED - WAITING FOR OTHER PARTICIPANTS
                  </div>
                </div>
              )}
              
              {timeRemaining === 0 && !hasAnswered && (
                <div className="mt-6 p-4 bg-red-500/20 border border-red-400">
                  <div className="text-red-400 font-mono font-bold text-center">
                    TIME'S UP!
                  </div>
                </div>
              )}
            </div>

            {/* My Stats */}
            {myParticipant && (
              <div className="bg-black border border-purple-400/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${myParticipant.avatar_color} flex items-center justify-center font-mono font-bold text-white`}>
                      {participantName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-mono font-bold">{participantName}</div>
                      <div className="text-gray-400 font-mono text-sm">
                        <Smartphone className="w-3 h-3 inline mr-1" />
                        {participantMobile}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono font-bold text-xl">{myParticipant.score.toLocaleString()}</div>
                    <div className="text-purple-400 font-mono text-sm">
                      {myParticipant.streak > 1 && `🔥 ${myParticipant.streak} streak`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show results screen
  if (quizState.showResults && currentQuestion) {
    const correctAnswers = participants.reduce((count, p) => {
      // This would need to be calculated from answers data
      return count;
    }, 0);

    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Cyberpunk grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,165,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,165,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        
        {/* Neon accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-400 to-transparent"></div>
        
        <div className="relative z-10 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 font-mono tracking-tight">
                QUESTION RESULTS
              </h1>
              <div className="text-orange-400 font-mono text-lg font-bold tracking-wider">
                QUESTION {quizState.currentQuestionIndex + 1} ANALYSIS
              </div>
            </div>

            {/* Question and Correct Answer */}
            <div className="bg-black border border-green-400 p-6 mb-8">
              <div className="text-green-400 font-mono font-bold mb-4">CORRECT ANSWER</div>
              <div className="text-white font-mono text-xl font-bold mb-4">{currentQuestion.question}</div>
              <div className="bg-green-500/20 border border-green-400 p-4">
                <div className="text-green-300 font-mono font-bold text-lg">
                  {currentQuestion.options[currentQuestion.correct_answer]}
                </div>
              </div>
            </div>

            {/* Current Leaderboard */}
            <div className="bg-black border border-cyan-400 p-6">
              <div className="text-cyan-400 font-mono font-bold mb-4 text-center">CURRENT STANDINGS</div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {participants.slice(0, 10).map((participant, index) => (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-3 border transition-all duration-300 ${
                      participant.id === participantId
                        ? 'bg-cyan-400/20 border-cyan-400 shadow-lg'
                        : index === 0
                        ? 'bg-yellow-400/20 border-yellow-400'
                        : 'bg-gray-800/50 border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center font-mono font-bold text-sm ${
                        index === 0 ? 'bg-yellow-400 text-black' : 'bg-gray-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-white font-mono font-bold">{participant.name}</div>
                        {participant.streak > 1 && (
                          <div className="text-orange-300 font-mono text-xs">🔥 {participant.streak} streak</div>
                        )}
                      </div>
                    </div>
                    <div className="text-white font-mono font-bold text-lg">
                      {participant.score.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default waiting state
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-2xl font-black text-white mb-4 font-mono">WAITING FOR NEXT QUESTION</div>
        <div className="text-cyan-400 font-mono">STAND BY...</div>
      </div>
    </div>
  );
};