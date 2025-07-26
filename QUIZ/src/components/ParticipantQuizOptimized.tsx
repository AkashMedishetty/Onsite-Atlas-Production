import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOptimizedSupabaseQuiz } from '../hooks/useOptimizedSupabaseQuiz';
import { createBackendClient, isBackendAvailable } from '../lib/backendClient';
import { supabase } from '../lib/supabase';
import { ParticipantWaitingRoom } from './participant/ParticipantWaitingRoom';
import { ParticipantQuestion } from './participant/ParticipantQuestion';
import { ParticipantResults } from './participant/ParticipantResults';
import { SimpleErrorBoundary, useErrorHandler } from './ErrorBoundary';
import type { Question, Participant, QuizSettings, ParticipantAnswer } from '../types';

interface ParticipantQuizOptimizedProps {
  sessionId: string;
  participantId: string;
  participantName: string;
  participantMobile: string;
  onBack: () => void;
}

export const ParticipantQuizOptimized: React.FC<ParticipantQuizOptimizedProps> = ({
  sessionId,
  participantId,
  participantName,
  participantMobile,
  onBack,
}) => {
  // Use the optimized hook for backend-first approach
  const {
    quizState,
    loading: quizLoading,
    error: quizError,
    isConnected,
    isUsingBackend
  } = useOptimizedSupabaseQuiz(sessionId);

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendClient, setBackendClient] = useState<any>(null);
  
  const handleError = useErrorHandler();

  // Initialize backend client if available
  useEffect(() => {
    const initBackend = async () => {
      if (isUsingBackend) {
        try {
          const client = createBackendClient();
          const connected = await client.connect();
          if (connected) {
            setBackendClient(client);
            console.log('🚀 [PARTICIPANT] Connected to backend for answer submission');
          }
        } catch (error) {
          console.error('❌ [PARTICIPANT] Backend connection failed:', error);
        }
      }
    };

    initBackend();
  }, [isUsingBackend]);

  // Get current question
  const currentQuestion = useMemo(() => {
    if (quizState.currentQuestionIndex >= 0 && quizState.questions[quizState.currentQuestionIndex]) {
      return quizState.questions[quizState.currentQuestionIndex];
    }
    return null;
  }, [quizState.questions, quizState.currentQuestionIndex]);

  // Find my participant data
  useEffect(() => {
    const participant = quizState.participants.find(p => p.id === participantId);
    if (participant) {
      setMyParticipant(participant);
    }
  }, [quizState.participants, participantId]);

  // Check if participant has answered current question
  useEffect(() => {
    if (currentQuestion && myParticipant) {
      const hasAnsweredQuestion = myParticipant.answers && 
        Object.prototype.hasOwnProperty.call(myParticipant.answers, currentQuestion.id);
      setHasAnswered(hasAnsweredQuestion);
      
             if (hasAnsweredQuestion) {
         const answer = myParticipant.answers[currentQuestion.id];
         setSelectedAnswer(answer ? (answer as any).selectedAnswer || null : null);
       } else {
         setSelectedAnswer(null);
       }
    }
  }, [currentQuestion, myParticipant]);

  // Update last seen timestamp periodically
  useEffect(() => {
    const updateLastSeen = async () => {
      try {
        if (isUsingBackend && backendClient) {
          // Use backend API for last seen update
          await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/participant/${participantId}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // Fallback to Supabase
          await supabase
            .from('quiz_participants')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', participantId);
        }
      } catch (error) {
        console.warn('Failed to update last seen:', error);
      }
    };
    
    updateLastSeen();
    const interval = setInterval(updateLastSeen, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [participantId, isUsingBackend, backendClient]);

  // Timer effect for current question
  useEffect(() => {
    if (quizState.isActive && 
        quizState.currentQuestionStartTime && 
        !quizState.showResults && 
        currentQuestion && 
        !hasAnswered) {
      
      const startTime = quizState.currentQuestionStartTime;
      const timeLimit = (currentQuestion.timeLimit || 30) * 1000;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, timeLimit - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          clearInterval(interval);
          setTimeRemaining(0);
          // Auto-submit if time runs out and no answer selected
          if (selectedAnswer === null) {
            handleSubmitAnswer(-1); // Submit -1 for no answer
          }
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [quizState.currentQuestionStartTime, quizState.showResults, currentQuestion, quizState.isActive, hasAnswered, selectedAnswer]);

  // Handle answer submission with backend preference
  const handleSubmitAnswer = useCallback(async (answerIndex: number) => {
    if (!currentQuestion || hasAnswered || submitLoading) return;

    try {
      setSubmitLoading(true);
      setError(null);

      const timeToAnswer = quizState.currentQuestionStartTime 
        ? Date.now() - quizState.currentQuestionStartTime 
        : 0;

      if (isUsingBackend && backendClient) {
        // Use backend for answer submission
        console.log('📡 [PARTICIPANT] Submitting answer via backend...');
        
        const result = await backendClient.submitAnswer({
          sessionId,
          participantId,
          questionId: currentQuestion.id,
          answerIndex,
          timeToAnswer
        });

        console.log('✅ [PARTICIPANT] Answer submitted via backend:', result);
        
      } else {
        // Fallback to Supabase
        console.log('📊 [PARTICIPANT] Submitting answer via Supabase fallback...');
        
        const isCorrect = answerIndex === currentQuestion.correctAnswer;
        const points = isCorrect ? (currentQuestion.points || 100) : 0;

        // Insert answer
        const { error: answerError } = await supabase
          .from('quiz_answers')
          .insert({
            quiz_session_id: sessionId,
            participant_id: participantId,
            question_id: currentQuestion.id,
            selected_answer: answerIndex,
            is_correct: isCorrect,
            points_earned: points,
            time_to_answer: timeToAnswer,
            answered_at: new Date().toISOString()
          });

        if (answerError) throw answerError;

        // Update participant score
        const newScore = (myParticipant?.score || 0) + points;
        const { error: scoreError } = await supabase
          .from('quiz_participants')
          .update({ 
            score: newScore,
            last_seen: new Date().toISOString()
          })
          .eq('id', participantId);

        if (scoreError) throw scoreError;

        console.log('✅ [PARTICIPANT] Answer submitted via Supabase');
      }

      setSelectedAnswer(answerIndex);
      setHasAnswered(true);
      
    } catch (err) {
      console.error('❌ [PARTICIPANT] Answer submission failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmitLoading(false);
    }
  }, [currentQuestion, hasAnswered, submitLoading, quizState.currentQuestionStartTime, isUsingBackend, backendClient, sessionId, participantId, myParticipant]);

  // Get leaderboard for results
  const topParticipants = useMemo(() => {
    return [...quizState.participants]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [quizState.participants]);

  // Handle loading and error states
  if (quizLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading quiz...</p>
          {isUsingBackend && (
            <p className="text-green-400 text-sm mt-2">🚀 Backend Mode (300+ participants)</p>
          )}
        </div>
      </div>
    );
  }

  if (quizError || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-400 text-xl mb-4">❌ Error</div>
          <p className="text-white mb-4">{quizError || error}</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render appropriate component based on quiz state
  return (
    <SimpleErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        {/* Backend Status Indicator */}
        {isUsingBackend && (
          <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            🚀 Backend Mode
          </div>
        )}
        
                 {!quizState.isActive && !quizState.isFinished && (
          <ParticipantWaitingRoom
            participantName={participantName}
            participantMobile={participantMobile}
            participants={quizState.participants as any[]}
            quizTitle={quizState.quizSettings.title}
            quizDescription={quizState.quizSettings.description}
            onBack={onBack}
          />
        )}

        {quizState.isActive && !quizState.showResults && currentQuestion && (
          <ParticipantQuestion
            question={currentQuestion as any}
            questionIndex={quizState.currentQuestionIndex}
            totalQuestions={quizState.questions.length}
            timeRemaining={timeRemaining}
            selectedAnswer={selectedAnswer}
            hasAnswered={hasAnswered}
            myParticipant={myParticipant as any}
            loading={submitLoading}
            showResults={quizState.showResults}
            onSelectAnswer={handleSubmitAnswer}
          />
        )}

        {(quizState.showResults || quizState.isFinished) && myParticipant && (
          <ParticipantResults
            isQuizFinished={quizState.isFinished}
            currentQuestion={quizState.showResults && !quizState.isFinished ? (currentQuestion as any) : undefined}
            myParticipant={myParticipant as any}
            participants={topParticipants as any[]}
            totalQuestions={quizState.questions.length}
            quizTitle={quizState.quizSettings.title}
            onReturnHome={onBack}
          />
        )}
      </div>
    </SimpleErrorBoundary>
  );
}; 