import { io, Socket } from 'socket.io-client';

interface BackendConfig {
  url: string;
  wsUrl: string;
  enableFallback: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  connectionId: string | null;
  latency: number;
  reconnectAttempts: number;
}

interface SessionJoinData {
  sessionId: string;
  participantId: string;
  role: 'host' | 'participant' | 'display';
}

interface AnswerSubmissionData {
  sessionId: string;
  participantId: string;
  questionId: string;
  answerIndex: number;
  timeToAnswer: number;
}

interface QuizControlData {
  action: 'start-quiz' | 'next-question' | 'show-results' | 'end-quiz';
  sessionId: string;
  data?: any;
}

class EnterpriseBackendClient {
  private socket: Socket | null = null;
  private config: BackendConfig;
  private status: ConnectionStatus = {
    connected: false,
    connectionId: null,
    latency: 0,
    reconnectAttempts: 0
  };
  private eventHandlers: Map<string, Function[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: BackendConfig) {
    this.config = config;
    this.setupEventHandlers();
  }

  // Initialize connection
  async connect(): Promise<boolean> {
    try {
      console.log('🔌 [BACKEND] Connecting to enterprise backend...');
      
      // Create socket connection
      this.socket = io(this.config.wsUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 10000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
      });

      // Setup socket event listeners
      this.setupSocketEvents();

      // Wait for connection
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('❌ [BACKEND] Connection timeout');
          resolve(false);
        }, 15000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          this.status.connected = true;
          this.status.connectionId = this.socket!.id || null;
          this.status.reconnectAttempts = 0;
          console.log('✅ [BACKEND] Connected to enterprise backend');
          this.startHeartbeat();
          resolve(true);
        });

        this.socket!.on('connect_error', (error: Error) => {
          clearTimeout(timeout);
          console.error('❌ [BACKEND] Connection failed:', error);
          resolve(false);
        });
      });
      
    } catch (error) {
      console.error('❌ [BACKEND] Failed to connect:', error);
      return false;
    }
  }

  // Disconnect
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.status.connected = false;
    this.status.connectionId = null;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    console.log('🔌 [BACKEND] Disconnected from backend');
  }

  // Join quiz session
  async joinSession(data: SessionJoinData): Promise<boolean> {
    if (!this.socket || !this.status.connected) {
      console.error('❌ [BACKEND] Not connected to backend');
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.error('❌ [BACKEND] Join session timeout');
        resolve(false);
      }, 10000);

      this.socket!.emit('join-session', data);

      this.socket!.once('session-joined', (response: any) => {
        clearTimeout(timeout);
        console.log('✅ [BACKEND] Joined session:', response);
        resolve(true);
      });

      this.socket!.once('error', (error: any) => {
        clearTimeout(timeout);
        console.error('❌ [BACKEND] Join session error:', error);
        resolve(false);
      });
    });
  }

  // Submit answer
  async submitAnswer(data: AnswerSubmissionData): Promise<any> {
    if (!this.socket || !this.status.connected) {
      throw new Error('Not connected to backend');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Answer submission timeout'));
      }, 10000);

      this.socket!.emit('submit-answer', data);

      this.socket!.once('answer-confirmed', (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket!.once('answer-error', (error: any) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });
    });
  }

  // Quiz control (host only)
  async quizControl(data: QuizControlData): Promise<boolean> {
    if (!this.socket || !this.status.connected) {
      console.error('❌ [BACKEND] Not connected to backend');
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.error('❌ [BACKEND] Quiz control timeout');
        resolve(false);
      }, 10000);

      this.socket!.emit('quiz-control', data);

      // Listen for successful control events
      const successEvents = ['quiz-started', 'question-started', 'results-shown', 'quiz-ended'];
      
      const handleSuccess = () => {
        clearTimeout(timeout);
        successEvents.forEach(event => {
          this.socket!.off(event, handleSuccess);
        });
        resolve(true);
      };

      successEvents.forEach(event => {
        this.socket!.once(event, handleSuccess);
      });

      this.socket!.once('error', (error: any) => {
        clearTimeout(timeout);
        console.error('❌ [BACKEND] Quiz control error:', error);
        resolve(false);
      });
    });
  }

  // Event subscription
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    // If socket is already connected, register the event
    if (this.socket) {
      this.socket.on(event, handler as any);
    }
  }

  // Remove event listener
  off(event: string, handler?: Function): void {
    if (handler) {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
      if (this.socket) {
        this.socket.off(event, handler as any);
      }
    } else {
      this.eventHandlers.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  // Get connection status
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  // Get session statistics
  async getSessionStats(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.url}/api/session/${sessionId}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ [BACKEND] Failed to get session stats:', error);
      throw error;
    }
  }

  // Get system metrics
  async getSystemMetrics(): Promise<any> {
    try {
      const response = await fetch(`${this.config.url}/api/metrics`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ [BACKEND] Failed to get system metrics:', error);
      throw error;
    }
  }

  // Quiz Management Methods

  // Get complete quiz data for a session
  async getQuizData(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ [BACKEND] Failed to get quiz data:', error);
      throw error;
    }
  }

  // Add a question to the quiz
  async addQuestion(sessionId: string, questionData: any): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(questionData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [BACKEND] Failed to add question:', error);
      throw error;
    }
  }

  // Start a specific question
  async startQuestion(sessionId: string, questionIndex: number): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}/start-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionIndex }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [BACKEND] Failed to start question:', error);
      throw error;
    }
  }

  // Show quiz results
  async showResults(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}/show-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [BACKEND] Failed to show results:', error);
      throw error;
    }
  }

  // Make quiz live
  async makeLive(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}/make-live`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [BACKEND] Failed to make quiz live:', error);
      throw error;
    }
  }

  // Start the quiz
  async startQuiz(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [BACKEND] Failed to start quiz:', error);
      throw error;
    }
  }

  // Finish the quiz
  async finishQuiz(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [BACKEND] Failed to finish quiz:', error);
      throw error;
    }
  }

  // Update quiz settings
  async updateQuizSettings(sessionId: string, settings: any): Promise<void> {
    try {
      const response = await fetch(`${this.config.url}/api/quiz/${sessionId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [BACKEND] Failed to update quiz settings:', error);
      throw error;
    }
  }

  // Subscribe to session real-time updates
  subscribeToSession(sessionId: string, callback: (update: any) => void): () => void {
    if (!this.socket) {
      console.error('❌ [BACKEND] Socket not connected');
      return () => {};
    }

    // Join the session room
    this.socket.emit('join-session', {
      sessionId,
      participantId: 'host',
      role: 'host'
    });

    // Listen for real-time updates
    const handleUpdate = (data: any) => {
      callback(data);
    };

    this.socket.on('quiz-update', handleUpdate);
    this.socket.on('participant-joined', handleUpdate);
    this.socket.on('participant-left', handleUpdate);
    this.socket.on('answer-submitted', handleUpdate);
    this.socket.on('question-started', handleUpdate);
    this.socket.on('results-shown', handleUpdate);
    this.socket.on('quiz-started', handleUpdate);
    this.socket.on('quiz-ended', handleUpdate);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        this.socket.off('quiz-update', handleUpdate);
        this.socket.off('participant-joined', handleUpdate);
        this.socket.off('participant-left', handleUpdate);
        this.socket.off('answer-submitted', handleUpdate);
        this.socket.off('question-started', handleUpdate);
        this.socket.off('results-shown', handleUpdate);
        this.socket.off('quiz-started', handleUpdate);
        this.socket.off('quiz-ended', handleUpdate);
      }
    };
  }

  // Private methods

  private setupEventHandlers(): void {
    // Core quiz events that should be handled
    const coreEvents = [
      'participant-joined',
      'participant-left',
      'answer-submitted',
      'quiz-started',
      'question-started',
      'results-shown',
      'quiz-ended'
    ];

    coreEvents.forEach(event => {
      this.eventHandlers.set(event, []);
    });
  }

  private setupSocketEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.status.connected = true;
      this.status.connectionId = this.socket!.id ?? null;
      this.status.reconnectAttempts = 0;
      console.log('✅ [BACKEND] Socket connected');
    });

    this.socket.on('disconnect', (reason: string) => {
      this.status.connected = false;
      this.status.connectionId = null;
      console.log('🔌 [BACKEND] Socket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.attemptReconnect();
      }
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      this.status.connected = true;
      this.status.connectionId = this.socket!.id ?? null;
      this.status.reconnectAttempts = attemptNumber;
      console.log(`✅ [BACKEND] Reconnected after ${attemptNumber} attempts`);
    });

    this.socket.on('reconnect_error', (error: Error) => {
      this.status.reconnectAttempts++;
      console.error(`❌ [BACKEND] Reconnect attempt ${this.status.reconnectAttempts} failed:`, error);
    });

    // Register all event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket!.on(event, handler as any);
      });
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.status.connected) {
        const start = Date.now();
        this.socket.emit('ping', start);
        
        this.socket.once('pong', (timestamp: number) => {
          this.status.latency = Date.now() - timestamp;
        });
      }
    }, 30000); // 30 second heartbeat
  }

  private attemptReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('🔄 [BACKEND] Attempting to reconnect...');
      this.connect();
    }, 5000);
  }
}

// Singleton instance
let backendClient: EnterpriseBackendClient | null = null;

// Factory function
export function createBackendClient(config?: Partial<BackendConfig>): EnterpriseBackendClient {
  const defaultConfig: BackendConfig = {
    url: process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001',
    wsUrl: process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'ws://localhost:3001',
    enableFallback: true
  };

  const finalConfig = { ...defaultConfig, ...config };
  
  if (!backendClient) {
    backendClient = new EnterpriseBackendClient(finalConfig);
  }
  
  return backendClient;
}

// Check if backend is available
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
    const response = await fetch(`${url}/health`, { 
      method: 'GET',
      timeout: 5000 
    } as any);
    return response.ok;
  } catch (error) {
    console.warn('⚠️ [BACKEND] Backend not available, using fallback');
    return false;
  }
}

export default EnterpriseBackendClient; 