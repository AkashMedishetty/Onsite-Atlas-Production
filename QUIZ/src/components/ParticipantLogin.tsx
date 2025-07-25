import React, { useState } from 'react';
import { ArrowLeft, Users, Zap, Shield, Wifi, Activity, Terminal, Lock } from 'lucide-react';

interface ParticipantLoginProps {
  onJoin: (name: string, sessionId: string, mobile: string, institute: string) => Promise<void>;
  onBack: () => void;
  directSessionId?: string;
}

export const ParticipantLogin: React.FC<ParticipantLoginProps> = ({
  onJoin,
  onBack,
  directSessionId,
}) => {
  const [name, setName] = useState('');
  const [sessionId, setSessionId] = useState(directSessionId || '');
  const [mobile, setMobile] = useState('');
  const [institute, setInstitute] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sessionId.trim() || !mobile.trim() || !institute.trim()) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onJoin(name.trim(), sessionId.trim(), mobile.trim(), institute.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Cyberpunk grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      
      {/* Neon accent lines */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent"></div>
      <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-transparent via-cyan-400 to-transparent"></div>
      <div className="absolute right-0 top-0 w-1 h-full bg-gradient-to-b from-transparent via-purple-400 to-transparent"></div>
      
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-black border-2 border-cyan-400 rounded-none mb-8 relative">
              <div className="absolute inset-0 bg-cyan-400/10 animate-pulse"></div>
              <Users className="w-10 h-10 text-cyan-400 relative z-10" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 animate-ping"></div>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 font-mono tracking-tight">
              JOIN QUIZ
            </h1>
            
            <div className="inline-flex items-center gap-3 bg-black border border-cyan-400/30 px-6 py-3 mb-8">
              <div className="w-2 h-2 bg-green-400 animate-pulse"></div>
              <span className="text-cyan-400 font-mono text-sm uppercase tracking-wider">LIVE CONNECTION ACTIVE</span>
              <div className="w-2 h-2 bg-purple-400 animate-pulse"></div>
            </div>
            
            <p className="text-lg text-gray-300 font-mono">
              Enter your details to join the quiz
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-cyan-400 font-mono font-bold mb-3 uppercase tracking-wider">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-black border-2 border-gray-600 focus:border-cyan-400 text-white font-mono text-lg focus:outline-none placeholder-gray-400 transition-all duration-300"
                placeholder="Enter your name..."
                required
              />
            </div>

            <div>
              <label className="block text-cyan-400 font-mono font-bold mb-3 uppercase tracking-wider">
                Session Code
              </label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                className="w-full p-4 bg-black border-2 border-gray-600 focus:border-cyan-400 text-white font-mono text-center text-2xl font-bold tracking-widest focus:outline-none placeholder-gray-400 transition-all duration-300"
                placeholder="ENTER CODE..."
                required
              />
            </div>

            <div>
              <label className="block text-cyan-400 font-mono font-bold mb-3 uppercase tracking-wider">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full p-4 bg-black border-2 border-gray-600 focus:border-cyan-400 text-white font-mono text-lg focus:outline-none placeholder-gray-400 transition-all duration-300"
                placeholder="Enter your mobile number..."
                required
              />
            </div>

            <div>
              <label className="block text-cyan-400 font-mono font-bold mb-3 uppercase tracking-wider">
                Institute / Organization
              </label>
              <input
                type="text"
                value={institute}
                onChange={(e) => setInstitute(e.target.value)}
                className="w-full p-4 bg-black border-2 border-gray-600 focus:border-cyan-400 text-white font-mono text-lg focus:outline-none placeholder-gray-400 transition-all duration-300"
                placeholder="Enter your institute or organization..."
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border-2 border-red-500 p-4">
                <div className="text-red-400 font-mono font-bold">
                  ⚠ {error}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-600 disabled:to-gray-500 text-black disabled:text-gray-400 p-4 font-mono font-bold text-lg uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-105 disabled:transform-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black animate-spin"></div>
                  JOINING...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  JOIN QUIZ
                  <Zap className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <button
            onClick={onBack}
            className="w-full mt-6 bg-black border-2 border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white p-4 font-mono font-bold text-lg uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            BACK TO HOME
          </button>
          
          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-4 bg-black border border-green-400/50 px-6 py-3">
              <div className="w-3 h-3 bg-green-400 animate-pulse"></div>
              <span className="text-green-400 font-mono font-bold tracking-wider">PURPLEHAT EVENTS PLATFORM</span>
              <div className="w-3 h-3 bg-cyan-400 animate-pulse delay-500"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};