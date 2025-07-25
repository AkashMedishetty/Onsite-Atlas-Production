// Unified real-time synchronization system
import { supabase } from './supabase';

export interface QuizStateUpdate {
  type: 'START_QUIZ' | 'START_QUESTION' | 'SHOW_RESULTS' | 'FINISH_QUIZ' | 'NEXT_QUESTION' | 'PARTICIPANT_UPDATE' | 'LEADERBOARD_UPDATE';
  sessionId: string;
  questionIndex?: number;
  timestamp: number;
  data?: any;
}

class UnifiedRealtimeSync {
  private channels: Map<string, any> = new Map();
  private listeners: Map<string, Set<(update: QuizStateUpdate) => void>> = new Map();
  private lastUpdate: Map<string, number> = new Map();

  // Send instant updates with deduplication
  sendUpdate(sessionId: string, update: Omit<QuizStateUpdate, 'sessionId' | 'timestamp'>) {
    const fullUpdate: QuizStateUpdate = {
      ...update,
      sessionId,
      timestamp: Date.now()
    };

    // Prevent duplicate updates within 100ms
    const lastTime = this.lastUpdate.get(`${sessionId}_${update.type}`) || 0;
    if (Date.now() - lastTime < 100) {
      console.log('🚫 [SYNC] Skipping duplicate update:', update.type);
      return;
    }
    this.lastUpdate.set(`${sessionId}_${update.type}`, Date.now());

    console.log('🚀 [SYNC] Broadcasting update:', fullUpdate.type, 'for session:', sessionId);

    const channelName = `unified_sync_${sessionId}`;
    
    // Get or create the broadcast channel
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = supabase.channel(channelName);
      this.channels.set(channelName, channel);
    }

    // Send the broadcast immediately
    console.log('📤 [SYNC] Broadcasting on channel:', fullUpdate.type);
    channel.send({
      type: 'broadcast',
      event: 'quiz_update',
      payload: fullUpdate
    });
  }

  // Subscribe to updates with unified handling
  subscribeToUpdates(sessionId: string, callback: (update: QuizStateUpdate) => void, clientType: 'host' | 'participant' | 'bigscreen') {
    const channelName = `unified_sync_${sessionId}`;
    
    console.log(`📡 [SYNC] ${clientType.toUpperCase()} subscribing to session:`, sessionId);

    // Add to listeners
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(callback);

    // Get or create the shared channel for this session
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = supabase.channel(channelName);
      this.channels.set(channelName, channel);
    }

    // Subscribe to broadcasts on the same channel
    channel.on('broadcast', { event: 'quiz_update' }, (payload: any) => {
      if (payload.payload.sessionId === sessionId) {
        const update = payload.payload as QuizStateUpdate;
        console.log(`⚡ [SYNC] ${clientType.toUpperCase()} received:`, update.type, 'at', new Date(update.timestamp).toISOString());
        
        // Immediate callback execution
        try {
          callback(update);
        } catch (error) {
          console.error(`❌ [SYNC] ${clientType.toUpperCase()} callback error:`, error);
        }
      }
    });

    // Subscribe to the channel if not already subscribed
    if (channel.subscribe) {
      channel.subscribe((status: any) => {
        console.log(`📡 [SYNC] ${clientType.toUpperCase()} subscription status:`, status);
      });
    }

    // Return unsubscribe function
    return () => {
      console.log(`🔄 [SYNC] ${clientType.toUpperCase()} unsubscribing from session:`, sessionId);
      const sessionListeners = this.listeners.get(sessionId);
      if (sessionListeners) {
        sessionListeners.delete(callback);
        if (sessionListeners.size === 0) {
          this.listeners.delete(sessionId);
          // Remove the channel if no more listeners
          const storedChannel = this.channels.get(channelName);
          if (storedChannel) {
            supabase.removeChannel(storedChannel);
            this.channels.delete(channelName);
          }
        }
      }
    };
  }

  // Cleanup all channels
  cleanup() {
    this.channels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.listeners.clear();
    this.lastUpdate.clear();
  }
}

export const unifiedSync = new UnifiedRealtimeSync();