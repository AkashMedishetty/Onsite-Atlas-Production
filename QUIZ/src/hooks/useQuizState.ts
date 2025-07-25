import { useState, useEffect } from 'react';
import { QuizState, Participant, Question, QuizSettings, ParticipantAnswer } from '../types';

const STORAGE_KEY = 'quiz-state';

const defaultSettings: QuizSettings = {
  title: 'Purplehat Events Quiz',
  description: 'Interactive quiz powered by Purplehat Events',
  defaultTimeLimit: 30,
  pointsPerQuestion: 100,
  speedBonus: true,
  streakBonus: true,
  showLeaderboardDuringQuiz: true,
  allowLateJoining: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
};

const initialState: QuizState = {
  questions: [],
  currentQuestionIndex: -1,
  isActive: false,
  isFinished: false,
  participants: [],
  showResults: false,
  quizSettings: defaultSettings,
  statistics: {
    totalParticipants: 0,
    averageScore: 0,
    questionsAnswered: 0,
    averageTimePerQuestion: 0,
    participationRate: 0,
  },
};

export const useQuizState = () => {
  const [quizState, setQuizState] = useState<QuizState>(initialState);

  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setQuizState({ ...initialState, ...parsed });
      } catch (error) {
        console.error('Error parsing saved quiz state:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizState));
  }, [quizState]);

  const updateQuizState = (newState: Partial<QuizState>) => {
    setQuizState(prev => ({ ...prev, ...newState }));
  };

  const updateQuizSettings = (newSettings: Partial<QuizSettings>) => {
    setQuizState(prev => ({
      ...prev,
      quizSettings: { ...prev.quizSettings, ...newSettings }
    }));
  };

  const addParticipant = (name: string): string => {
    const id = Date.now().toString();
    const participant: Participant = {
      id,
      name,
      score: 0,
      answers: {},
      joinedAt: Date.now(),
      streak: 0,
      badges: [],
    };
    
    setQuizState(prev => ({
      ...prev,
      participants: [...prev.participants, participant],
      statistics: {
        ...prev.statistics,
        totalParticipants: prev.participants.length + 1,
      }
    }));
    
    return id;
  };

  const calculatePoints = (isCorrect: boolean, timeToAnswer: number, timeLimit: number, basePoints: number, streak: number): number => {
    if (!isCorrect) return 0;
    
    let points = basePoints;
    
    // Speed bonus
    if (quizState.quizSettings.speedBonus) {
      const speedMultiplier = Math.max(0.5, 1 - (timeToAnswer / timeLimit) * 0.5);
      points *= speedMultiplier;
    }
    
    // Streak bonus
    if (quizState.quizSettings.streakBonus && streak > 1) {
      points *= Math.min(2, 1 + (streak - 1) * 0.1);
    }
    
    return Math.round(points);
  };

  const submitAnswer = (participantId: string, questionId: string, answerIndex: number, timeToAnswer: number) => {
    setQuizState(prev => {
      const participants = prev.participants.map(p => {
        if (p.id === participantId) {
          const question = prev.questions.find(q => q.id === questionId);
          const isCorrect = question ? question.correctAnswer === answerIndex : false;
          const basePoints = question?.points || prev.quizSettings.pointsPerQuestion;
          const timeLimit = question?.timeLimit || prev.quizSettings.defaultTimeLimit;
          
          const newStreak = isCorrect ? p.streak + 1 : 0;
          const pointsEarned = calculatePoints(isCorrect, timeToAnswer, timeLimit, basePoints, p.streak);
          
          const answer: ParticipantAnswer = {
            answerIndex,
            timeToAnswer,
            isCorrect,
            pointsEarned,
          };
          
          // Award badges
          const newBadges = [...p.badges];
          if (newStreak === 3 && !newBadges.includes('streak-3')) {
            newBadges.push('streak-3');
          }
          if (newStreak === 5 && !newBadges.includes('streak-5')) {
            newBadges.push('streak-5');
          }
          if (timeToAnswer < 5 && isCorrect && !newBadges.includes('speed-demon')) {
            newBadges.push('speed-demon');
          }
          
          return {
            ...p,
            answers: { ...p.answers, [questionId]: answer },
            score: p.score + pointsEarned,
            streak: newStreak,
            badges: newBadges,
          };
        }
        return p;
      });
      
      // Update statistics
      const answeredCount = participants.reduce((acc, p) => acc + Object.keys(p.answers).length, 0);
      const totalScore = participants.reduce((acc, p) => acc + p.score, 0);
      const averageScore = participants.length > 0 ? totalScore / participants.length : 0;
      
      return {
        ...prev,
        participants,
        statistics: {
          ...prev.statistics,
          averageScore,
          questionsAnswered: answeredCount,
          participationRate: participants.length > 0 ? (answeredCount / (participants.length * prev.questions.length)) * 100 : 0,
        }
      };
    });
  };

  const startQuestion = (questionIndex: number) => {
    setQuizState(prev => ({
      ...prev,
      currentQuestionIndex: questionIndex,
      currentQuestionStartTime: Date.now(),
      showResults: false,
    }));
  };

  const resetQuiz = () => {
    setQuizState(initialState);
    localStorage.removeItem(STORAGE_KEY);
  };

  const exportResults = () => {
    const results = {
      quiz: quizState.quizSettings,
      participants: quizState.participants,
      questions: quizState.questions,
      statistics: quizState.statistics,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    quizState,
    updateQuizState,
    updateQuizSettings,
    addParticipant,
    submitAnswer,
    startQuestion,
    resetQuiz,
    exportResults,
  };
};