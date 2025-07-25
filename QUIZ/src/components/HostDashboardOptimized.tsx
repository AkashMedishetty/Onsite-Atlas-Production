import React, { useState, useEffect, useMemo } from 'react';
import { Download, Trophy } from 'lucide-react';
import { useOptimizedSupabaseQuiz } from '../hooks/useOptimizedSupabaseQuiz';
import { TemplateManager } from './TemplateManager';
import { QuestionManager } from './host/QuestionManager';
import { QuizControls } from './host/QuizControls';
import { LiveLeaderboard } from './host/LiveLeaderboard';
import { HostHeader } from './host/HostHeader';
import { supabase } from '../lib/supabase';
import { Question, QuizSettings } from '../types';

interface HostDashboardOptimizedProps {
  sessionId: string;
  displayCode: string;
  hostId: string;
  onBack: () => void;
}

interface SettingsModalProps {
  settings: QuizSettings;
  onUpdateSettings: (settings: Partial<QuizSettings>) => Promise<void>;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdateSettings, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Quiz Settings</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-white font-medium mb-2">Quiz Title</label>
          <input
            type="text"
            value={settings.title}
            onChange={(e) => onUpdateSettings({ title: e.target.value })}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        
        <div>
          <label className="block text-white font-medium mb-2">Description</label>
          <textarea
            value={settings.description}
            onChange={(e) => onUpdateSettings({ description: e.target.value })}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 h-24"
          />
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-white font-medium mb-2">Default Time Limit (seconds)</label>
            <input
              type="number"
              value={settings.defaultTimeLimit}
              onChange={(e) => onUpdateSettings({ defaultTimeLimit: parseInt(e.target.value) || 30 })}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="5"
              max="300"
            />
          </div>
          
          <div>
            <label className="block text-white font-medium mb-2">Points per Question</label>
            <input
              type="number"
              value={settings.pointsPerQuestion}
              onChange={(e) => onUpdateSettings({ pointsPerQuestion: parseInt(e.target.value) || 100 })}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="10"
              max="1000"
            />
          </div>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Scoring Options</h3>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.speedBonus}
                onChange={(e) => onUpdateSettings({ speedBonus: e.target.checked })}
                className="w-5 h-5 text-blue-500 rounded focus:ring-blue-400"
              />
              <span className="text-white">Speed Bonus</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.streakBonus}
                onChange={(e) => onUpdateSettings({ streakBonus: e.target.checked })}
                className="w-5 h-5 text-blue-500 rounded focus:ring-blue-400"
              />
              <span className="text-white">Streak Bonus</span>
            </label>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Quiz Options</h3>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.allowLateJoining}
                onChange={(e) => onUpdateSettings({ allowLateJoining: e.target.checked })}
                className="w-5 h-5 text-blue-500 rounded focus:ring-blue-400"
              />
              <span className="text-white">Allow Late Joining</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.shuffleQuestions}
                onChange={(e) => onUpdateSettings({ shuffleQuestions: e.target.checked })}
                className="w-5 h-5 text-blue-500 rounded focus:ring-blue-400"
              />
              <span className="text-white">Shuffle Questions</span>
            </label>
          </div>
        </div>
      </div>
      
      <div className="flex gap-3 mt-8">
        <button
          onClick={onClose}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg transition-colors"
        >
          Save Settings
        </button>
        <button
          onClick={onClose}
          className="px-6 bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

export const HostDashboardOptimized: React.FC<HostDashboardOptimizedProps> = ({
  sessionId,
  displayCode,
  hostId,
  onBack,
}) => {
  const {
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
  } = useOptimizedSupabaseQuiz(sessionId);

  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Calculate current question and stats
  const currentQuestion = useMemo(() => {
    return quizState.questions[quizState.currentQuestionIndex];
  }, [quizState.questions, quizState.currentQuestionIndex]);

  const answeredCount = useMemo(() => {
    if (!currentQuestion) return 0;
    return quizState.participants.filter(p => p.answers[currentQuestion.id]).length;
  }, [currentQuestion, quizState.participants]);

  // Timer for current question
  useEffect(() => {
    if (quizState.isActive && quizState.currentQuestionStartTime && !quizState.showResults && currentQuestion) {
      const timeLimit = (currentQuestion.timeLimit || quizState.quizSettings.defaultTimeLimit) * 1000;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - (quizState.currentQuestionStartTime || 0);
        const remaining = Math.max(0, timeLimit - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          clearInterval(interval);
          showResults();
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [quizState.isActive, quizState.currentQuestionStartTime, quizState.showResults, currentQuestion, quizState.quizSettings.defaultTimeLimit, showResults]);

  // Handler functions
  const handleUpdateDisplayCode = async (code: string) => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ access_code: code })
        .eq('id', sessionId);
      
      if (error) throw error;
      
      // Force refresh the quiz data to get the updated access code
      await forceRefresh();
      
      // Show success notification
      const notification = document.createElement('div');
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #10B981; color: white; padding: 16px; border-radius: 8px; z-index: 9999; font-family: monospace; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          ✅ ACCESS CODE UPDATED!<br/>
          <small style="opacity: 0.9;">New code: ${code}</small>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Failed to update session code:', error);
      throw error;
    }
  };

  const handleShareLink = () => {
    const currentAccessCode = (quizState as any).accessCode || displayCode;
    const shareableLink = currentAccessCode 
      ? `${window.location.origin}?code=${currentAccessCode}` 
      : `${window.location.origin}?join=${sessionId}`;
    
    navigator.clipboard.writeText(shareableLink).then(() => {
      // Create notification
      const notification = document.createElement('div');
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #10B981; color: white; padding: 16px; border-radius: 8px; z-index: 9999; font-family: monospace; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          ✅ SHAREABLE LINK COPIED!<br/>
          <small style="opacity: 0.9;">Share: ${shareableLink}</small>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
    }).catch(() => {
      alert('Shareable link: ' + shareableLink);
    });
  };

  const handleOpenBigScreen = () => {
    const bigScreenUrl = `${window.location.origin}/big-screen/${displayCode}`;
    window.open(bigScreenUrl, '_blank', 'width=1920,height=1080,fullscreen=yes');
  };

  const exportResults = () => {
    // Create comprehensive Excel-compatible CSV data
    const csvData = [];
    
    // Quiz Summary Header
    csvData.push(['QUIZ RESULTS EXPORT']);
    csvData.push(['Quiz Title:', quizState.quizSettings.title]);
    csvData.push(['Description:', quizState.quizSettings.description]);
    csvData.push(['Export Date:', new Date().toLocaleString()]);
    csvData.push(['Total Questions:', quizState.questions.length]);
    csvData.push(['Total Participants:', quizState.participants.length]);
    csvData.push(['Average Score:', Math.round(quizState.statistics.averageScore)]);
    csvData.push([]);
    
    // Participant Results
    csvData.push(['Rank', 'Name', 'Mobile', 'Final Score', 'Streak', 'Badges']);
    
    const sortedParticipants = [...quizState.participants].sort((a, b) => b.score - a.score);
    sortedParticipants.forEach((participant, index) => {
      csvData.push([
        index + 1,
        participant.name,
        participant.mobile,
        participant.score,
        participant.streak,
        participant.badges.join('; '),
      ]);
    });
    
    // Convert to CSV string
    const csvString = csvData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    // Download file
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purplehat-quiz-results-${quizState.quizSettings.title.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadTemplate = (templateQuestions: Question[], templateSettings: QuizSettings) => {
    alert('Template loading functionality will be implemented');
  };

  const handleCreateSessionFromTemplate = (sessionId: string) => {
    window.location.href = `/host/${sessionId}`;
  };

  // Final Results View
  if (quizState.showResults && quizState.isFinished) {
    const sortedParticipants = [...quizState.participants].sort((a, b) => b.score - a.score);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-3xl p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-4 mb-2">
                  <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400" />
                  Final Results
                </h1>
                <p className="text-gray-300 text-lg">{quizState.quizSettings.title}</p>
                <p className="text-sm text-purple-300">Powered by Purplehat Events</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportResults}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base"
                >
                  <Download className="w-4 h-4" />
                  Export Results
                </button>
                <button
                  onClick={onBack}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
                >
                  New Quiz
                </button>
              </div>
            </div>
            
            {/* Leaderboard */}
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Final Leaderboard</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedParticipants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-4 sm:p-6 rounded-xl transition-all duration-300 ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-400/50 shadow-2xl'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border border-gray-400/50'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-600/20 to-yellow-600/20 border border-orange-400/50'
                        : 'bg-gray-800/50 border border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-base sm:text-lg ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-black shadow-lg' :
                        index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-black' :
                        index === 2 ? 'bg-gradient-to-r from-orange-400 to-yellow-500 text-black' :
                        'bg-gray-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg sm:text-xl">{participant.name}</div>
                        <div className="text-gray-400 text-sm">{participant.mobile}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl sm:text-3xl font-bold text-white">
                        {participant.score.toLocaleString()}
                      </div>
                      {participant.streak > 0 && (
                        <div className="text-xs text-orange-300">
                          🔥 {participant.streak} streak
                        </div>
                      )}
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

  // Loading state
  if (loading && quizState.questions.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 font-mono text-sm">LOADING QUIZ DATA...</p>
          <p className="text-gray-500 font-mono text-xs mt-2">Session: {sessionId}</p>
          <div className="mt-4">
            <button
              onClick={forceRefresh}
              className="text-green-400 hover:text-green-300 font-mono text-xs underline mr-4"
            >
              FORCE RELOAD
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-orange-400 hover:text-orange-300 font-mono text-xs underline"
            >
              REFRESH PAGE
            </button>
          </div>
          {!isConnected && (
            <p className="text-red-400 font-mono text-xs mt-2">⚠ REAL-TIME CONNECTION LOST</p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-red-300 mb-4">Error Loading Quiz</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={forceRefresh}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onBack}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-black p-4">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,165,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,165,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-400 to-transparent"></div>
      
      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={quizState.quizSettings}
          onUpdateSettings={updateQuizSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <HostHeader
          quizTitle={quizState.quizSettings.title}
          displayCode={(quizState as any).accessCode || displayCode}
          participantCount={quizState.statistics.totalParticipants}
          onUpdateTitle={(title) => updateQuizSettings({ title })}
          onUpdateDisplayCode={handleUpdateDisplayCode}
          onShareLink={handleShareLink}
          onOpenBigScreen={handleOpenBigScreen}
          onShowTemplates={() => setShowTemplates(!showTemplates)}
          onShowSettings={() => setShowSettings(true)}
          onRefresh={forceRefresh}
          onBack={onBack}
          loading={loading}
        />

        <div className="grid xl:grid-cols-3 gap-6 sm:gap-8">
          {/* Question Management */}
          <div className={`${showTemplates ? 'xl:col-span-1' : 'xl:col-span-2'}`}>
            <QuestionManager
              questions={quizState.questions}
              currentQuestionIndex={quizState.currentQuestionIndex}
              isQuizActive={quizState.isActive}
              defaultTimeLimit={quizState.quizSettings.defaultTimeLimit}
              defaultPoints={quizState.quizSettings.pointsPerQuestion}
              onAddQuestion={addQuestion}
              loading={loading}
            />
          </div>

          {/* Template Manager */}
          {showTemplates && (
            <div>
              <TemplateManager
                questions={quizState.questions}
                settings={quizState.quizSettings}
                hostId={hostId}
                onCreateSession={handleCreateSessionFromTemplate}
                onLoadTemplate={handleLoadTemplate}
              />
            </div>
          )}

          {/* Quiz Controls & Live Stats */}
          <div className="space-y-6 xl:space-y-8">
            {/* Quiz Controls */}
            <QuizControls
              isActive={quizState.isActive}
              isFinished={quizState.isFinished}
              currentQuestionIndex={quizState.currentQuestionIndex}
              totalQuestions={quizState.questions.length}
              currentQuestion={currentQuestion}
              timeRemaining={timeRemaining}
              answeredCount={answeredCount}
              totalParticipants={quizState.statistics.totalParticipants}
              showResults={quizState.showResults}
              loading={loading}
              onMakeLive={makeLive}
              onStartQuiz={startQuiz}
              onNextQuestion={async () => {
                const nextIndex = quizState.currentQuestionIndex + 1;
                if (nextIndex < quizState.questions.length) {
                  await startQuestion(nextIndex);
                } else {
                  await finishQuiz();
                }
              }}
              onShowResults={showResults}
            />

            {/* Live Leaderboard */}
            <LiveLeaderboard
              participants={quizState.participants}
              totalQuestions={quizState.questions.length}
              averageScore={quizState.statistics.averageScore}
              participationRate={quizState.statistics.participationRate}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}; 