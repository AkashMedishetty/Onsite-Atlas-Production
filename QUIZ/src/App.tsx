import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { ParticipantLogin } from './components/ParticipantLogin';
import { ParticipantQuiz } from './components/ParticipantQuiz';
import { HostDashboard } from './components/HostDashboard';
import { BigScreenDisplay } from './components/BigScreenDisplay';
import { LiveQuizDashboard } from './components/LiveQuizDashboard';
import { useQuizTemplates } from './hooks/useQuizTemplates';
import { supabase } from './lib/supabase';
import { v4 as uuidv4 } from 'uuid';

type AppState = 
  | { type: 'landing' }
  | { type: 'participant-login' }
  | { type: 'participant-quiz'; sessionId: string; participantId: string; participantName: string; participantMobile: string }
  | { type: 'host-dashboard'; sessionId: string; displayCode: string; hostId: string }
  | { type: 'live-quiz-dashboard'; hostId: string }
  | { type: 'big-screen'; accessCode: string };

// Participant session storage keys
const PARTICIPANT_SESSION_KEY = 'participant_session';
const PARTICIPANT_STATE_KEY = 'participant_state';

interface ParticipantSession {
  sessionId: string;
  participantId: string;
  participantName: string;
  participantMobile: string;
  accessCode: string;
  timestamp: number;
}

function App() {
  const [appState, setAppState] = useState<AppState>({ type: 'landing' });
  const { createSessionFromTemplate, generateReadableSessionId } = useQuizTemplates('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Save participant session to localStorage
  const saveParticipantSession = (session: ParticipantSession) => {
    try {
      localStorage.setItem(PARTICIPANT_SESSION_KEY, JSON.stringify(session));
      console.log('💾 [SESSION] Participant session saved:', session);
    } catch (error) {
      console.error('Failed to save participant session:', error);
    }
  };

  // Load participant session from localStorage
  const loadParticipantSession = (): ParticipantSession | null => {
    try {
      const saved = localStorage.getItem(PARTICIPANT_SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        // Check if session is less than 24 hours old
        if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
          console.log('💾 [SESSION] Participant session loaded:', session);
          return session;
        } else {
          console.log('💾 [SESSION] Participant session expired, clearing');
          localStorage.removeItem(PARTICIPANT_SESSION_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load participant session:', error);
    }
    return null;
  };

  // Clear participant session
  const clearParticipantSession = () => {
    localStorage.removeItem(PARTICIPANT_SESSION_KEY);
    localStorage.removeItem(PARTICIPANT_STATE_KEY);
    console.log('💾 [SESSION] Participant session cleared');
  };

  // Handle client-side routing for big screen URLs
  useEffect(() => {
    if (isInitialized) return; // Prevent multiple initializations
    
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    
    console.log('🔍 [APP] Initializing routing - Path:', path, 'Search:', search);
    
    // Check for big screen routing first
    if (path.startsWith('/big-screen/')) {
      const accessCode = path.split('/big-screen/')[1];
      console.log('🎮 [APP] Big screen code detected:', accessCode);
      if (accessCode) {
        setAppState({ type: 'big-screen', accessCode });
        setIsInitialized(true);
        return;
      }
    }
    
    // Also check URL parameters for access code
    const urlParams = new URLSearchParams(search);
    const accessCodeParam = urlParams.get('code');
    if (accessCodeParam) {
      console.log('🎮 [APP] Big screen code detected in params:', accessCodeParam);
      setAppState({ type: 'big-screen', accessCode: accessCodeParam });
      setIsInitialized(true);
      return;
    }

    // Check for existing participant session on page load
    const savedSession = loadParticipantSession();
    if (savedSession) {
      console.log('💾 [APP] Restoring participant session:', savedSession);
      
      // Validate session data
      if (savedSession.sessionId && savedSession.participantId && savedSession.participantName && savedSession.participantMobile) {
      setAppState({
        type: 'participant-quiz',
        sessionId: savedSession.sessionId,
        participantId: savedSession.participantId,
        participantName: savedSession.participantName,
        participantMobile: savedSession.participantMobile
      });
        setIsInitialized(true);
      return;
      } else {
        console.warn('💾 [APP] Invalid session data, clearing:', savedSession);
        clearParticipantSession();
      }
    }
    
    // Default to landing page
    setAppState({ type: 'landing' });
    setIsInitialized(true);
  }, []);

  const handleSelectRole = (role: 'host' | 'participant') => {
    if (role === 'host') {
      const hostId = uuidv4();
      setAppState({ type: 'live-quiz-dashboard', hostId });
    } else {
      setAppState({ type: 'participant-login' });
    }
  };

  const handleParticipantJoin = async (name: string, sessionId: string, mobile: string) => {
    try {
      // Check if session exists and get session info
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('access_code', sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error('Session not found. Please check the session code.');
      }

      // Check if participant with this name and mobile already exists
      const { data: existingParticipant, error: participantError } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('quiz_session_id', session.id)
        .eq('name', name)
        .eq('mobile', mobile)
        .single();

      let participantId: string;

      if (existingParticipant) {
        // Participant exists, use existing ID
        participantId = existingParticipant.id;
        
        // Update last_seen
        await supabase
          .from('quiz_participants')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', participantId);
      } else {
        // Check if name is already taken by someone else
        const { data: nameCheck } = await supabase
          .from('quiz_participants')
          .select('*')
          .eq('quiz_session_id', session.id)
          .eq('name', name)
          .neq('mobile', mobile);

        if (nameCheck && nameCheck.length > 0) {
          throw new Error('This name is already taken by another participant. Please choose a different name.');
        }

        // Create new participant
        const avatarColors = [
          'bg-gradient-to-r from-blue-400 to-purple-400',
          'bg-gradient-to-r from-green-400 to-blue-400',
          'bg-gradient-to-r from-purple-400 to-pink-400',
          'bg-gradient-to-r from-yellow-400 to-orange-400',
          'bg-gradient-to-r from-red-400 to-pink-400',
          'bg-gradient-to-r from-indigo-400 to-purple-400',
        ];

        const { data: newParticipant, error: createError } = await supabase
          .from('quiz_participants')
          .insert({
            quiz_session_id: session.id,
            name: name,
            mobile: mobile,
            avatar_color: avatarColors[Math.floor(Math.random() * avatarColors.length)],
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        participantId = newParticipant.id;
      }

      // Save participant session for persistence
      saveParticipantSession({
        sessionId: session.id,
        participantId,
        participantName: name,
        participantMobile: mobile,
        accessCode: sessionId,
        timestamp: Date.now()
      });
      setAppState({ 
        type: 'participant-quiz', 
        sessionId: session.id, 
        participantId, 
        participantName: name,
        participantMobile: mobile
      });
    } catch (error) {
      console.error('Failed to join quiz:', error);
      throw error;
    }
  };

  const handleCreateNewQuiz = async () => {
    try {
      const hostId = uuidv4();
      const displayCode = generateReadableSessionId();
      
      // Create new quiz session
      const { data: session, error } = await supabase
        .from('quiz_sessions')
        .insert({
          title: 'New Quiz',
          description: 'Interactive quiz powered by Purplehat Events',
          host_id: hostId,
          access_code: displayCode,
          settings: {
            title: 'New Quiz',
            description: 'Interactive quiz powered by Purplehat Events',
            defaultTimeLimit: 30,
            pointsPerQuestion: 100,
            speedBonus: true,
            streakBonus: true,
            allowLateJoining: true,
            shuffleQuestions: false,
          },
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setAppState({ 
        type: 'host-dashboard', 
        sessionId: session.id, 
        displayCode,
        hostId 
      });
    } catch (error) {
      console.error('Failed to create quiz:', error);
      alert('Failed to create quiz. Please try again.');
    }
  };

  const handleSelectQuiz = (quizId: string, accessCode: string) => {
    // Extract hostId from the quiz or generate a new one
    const hostId = uuidv4(); // In a real app, this would come from authentication
    setAppState({ 
      type: 'host-dashboard', 
      sessionId: quizId, 
      displayCode: accessCode,
      hostId 
    });
  };

  const handleCreateSessionFromTemplate = async (sessionId: string) => {
    // This would be called from template manager
    // For now, just navigate to the session
    const hostId = uuidv4();
    
    // Get the session info to get the access code
    const { data: session } = await supabase
      .from('quiz_sessions')
      .select('access_code')
      .eq('id', sessionId)
      .single();

    if (session) {
      setAppState({ 
        type: 'host-dashboard', 
        sessionId, 
        displayCode: session.access_code,
        hostId 
      });
    }
  };

  const handleBackToHome = () => {
    // Clear participant session when going back to home
    clearParticipantSession();
    setAppState({ type: 'landing' });
  };

  const handleBackToLiveDashboard = (hostId: string) => {
    setAppState({ type: 'live-quiz-dashboard', hostId });
  };

  const handleParticipantBack = () => {
    // Clear session and go to landing
    clearParticipantSession();
    setAppState({ type: 'landing' });
  };
  switch (appState.type) {
    case 'landing':
      return <LandingPage onSelectRole={handleSelectRole} />;
    
    case 'participant-login':
      return (
        <ParticipantLogin 
          onJoin={handleParticipantJoin}
          onBack={handleBackToHome}
        />
      );
    
    case 'participant-quiz':
      return (
        <ParticipantQuiz 
          sessionId={appState.sessionId}
          participantId={appState.participantId}
          participantName={appState.participantName}
          participantMobile={appState.participantMobile}
          onBack={handleParticipantBack}
        />
      );
    
    case 'host-dashboard':
      return (
        <HostDashboard 
          sessionId={appState.sessionId}
          displayCode={appState.displayCode}
          hostId={appState.hostId}
          onBack={() => handleBackToLiveDashboard(appState.hostId)}
        />
      );
    
    case 'live-quiz-dashboard':
      return (
        <LiveQuizDashboard 
          onSelectQuiz={handleSelectQuiz}
          onCreateNew={handleCreateNewQuiz}
          onBack={handleBackToHome}
        />
      );
    
    case 'big-screen':
      return (
        <BigScreenDisplay 
          accessCode={appState.accessCode}
        />
      );
    
    default:
      return <LandingPage onSelectRole={handleSelectRole} />;
  }
}

export default App;