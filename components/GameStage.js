import { useState, useEffect } from 'react';
import { getPlayerId } from '../lib/socket';

export default function GameStage({ room, socket, currentUser, timer }) {
  const [inputContent, setInputContent] = useState('');
  const [responseContent, setResponseContent] = useState('');

  if (!room) return <div className="text-white text-center">Loading Room...</div>;

  const currentPlayerId = getPlayerId();
  const isHost = currentPlayerId === room.hostId;
  const myPlayer = room.players.find(p => p.playerId === currentPlayerId);

  // -- Handlers --
  const startGame = () => {
    socket.emit('start_game', { code: room.code, turnTimer: 120, playerId: getPlayerId() });
  };

  const nextRound = () => {
    socket.emit('next_round', { code: room.code, playerId: getPlayerId() });
  };

  const submitInput = () => {
    if (!inputContent) return;
    socket.emit('submit_input', { code: room.code, content: inputContent, playerId: getPlayerId() });
  };

  const submitResponse = () => {
    if (!responseContent) return;
    socket.emit('submit_response', { code: room.code, response: responseContent, playerId: getPlayerId() });
  };

  // Auto-submit on timer end
  useEffect(() => {
    if (timer === 0 && room.phase !== 'reveal' && room.phase !== 'lobby') {
      const playerId = getPlayerId();
      if (room.phase === 'input' && !myPlayer?.isReady) {
        socket.emit('submit_input', { code: room.code, content: inputContent || "(Time's up!)", playerId });
      } else if (room.phase === 'action' && !myPlayer?.isReady) {
        socket.emit('submit_response', { code: room.code, response: responseContent || "(Time's up!)", playerId });
      }
    }
  }, [timer]);

  // -- Phase Rendering --

  if (room.phase === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-4 animate-pulse uppercase">
          Waiting for Players
        </h1>
        <div className="text-2xl text-text-dim mb-8">Room Code: <span className="text-text-main font-mono bg-white/10 px-2 py-1 rounded">{room.code}</span></div>

        <div className="flex flex-col gap-4">
          {isHost ? (
            <button onClick={startGame} className="btn-primary text-2xl px-12 py-4 shadow-xl">
              START GAME
            </button>
          ) : (
            <p className="text-text-dim animate-bounce">Waiting for host to start...</p>
          )}
        </div>
      </div>
    );
  }

  if (room.phase === 'input') {
    const target = room.players.find(p => p.playerId === myPlayer?.targetId);

    let promptLabel = "Write something...";
    let colorClass = "text-text-main";

    if (target) {
      if (target.role === 'truth') {
        promptLabel = `Ask ${target.nickname} a Truth Question:`;
        colorClass = "text-primary";
      } else {
        promptLabel = `Dare ${target.nickname} to do something:`;
        colorClass = "text-secondary";
      }
    }

    return (
      <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
        <div className="text-6xl font-mono mb-8 text-text-main">{timer}s</div>

        <h2 className={`text-3xl font-bold mb-4 ${colorClass}`}>{promptLabel}</h2>

        {!myPlayer?.isReady ? (
          <div className="w-full space-y-4">
            <textarea
              className="input-field h-32 text-xl"
              placeholder="..."
              value={inputContent}
              onChange={e => setInputContent(e.target.value)}
            />
            <button onClick={submitInput} className="btn-primary w-full">Submit</button>
          </div>
        ) : (
          <div className="text-2xl text-text-dim animate-pulse">Waiting for other players...</div>
        )}
      </div>
    );
  }

  if (room.phase === 'action') {
    const myRole = myPlayer.role;
    const myPrompt = myRole === 'truth' ? myPlayer.truth : myPlayer.dare;

    return (
      <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
        <div className="text-6xl font-mono mb-8 text-text-main">{timer}s</div>

        <div className="mb-8 text-center">
          <h3 className="text-xl text-text-dim mb-2 uppercase tracking-widest">{myRole} Challenge</h3>
          <p className="text-4xl font-bold text-text-main leading-tight">"{myPrompt}"</p>
        </div>

        {!myPlayer?.isReady ? (
          <div className="w-full space-y-4">
            <textarea
              className="input-field h-32 text-xl"
              placeholder={myRole === 'truth' ? "Type your honest answer..." : "Type 'Done' or describe how you did it..."}
              value={responseContent}
              onChange={e => setResponseContent(e.target.value)}
            />
            <button onClick={submitResponse} className="btn-secondary w-full">Submit Response</button>
          </div>
        ) : (
          <div className="text-2xl text-text-dim animate-pulse">Response Submitted! Waiting for others...</div>
        )}
      </div>
    );
  }

  if (room.phase === 'reveal') {
    return (
      <div className="h-full flex flex-col p-4">
        <h2 className="text-3xl font-bold text-center text-text-main mb-6">Round Results</h2>

        <div className="grid grid-cols-2 gap-2 md:gap-4 overflow-y-auto flex-1 pb-20">
          {room.players.map(p => (
            <div key={p.playerId} className="glass-panel p-3 md:p-6 relative overflow-hidden group hover:border-primary/40 transition-colors">
              <div className={`absolute top-0 right-0 p-1 md:p-2 text-[8px] md:text-xs font-bold uppercase ${p.role === 'truth' ? 'bg-primary text-white dark:text-black' : 'bg-secondary text-white dark:text-black'} rounded-bl-lg`}>
                {p.role}
              </div>
              <h3 className="text-sm md:text-xl font-bold text-text-main mb-1 md:mb-2 truncate">{p.nickname}</h3>

              <div className="mb-2 md:mb-4">
                <p className="text-[10px] text-text-dim uppercase">Ask/Dare</p>
                <p className="text-xs md:text-lg text-text-main italic line-clamp-3">"{p.role === 'truth' ? p.truth : p.dare}"</p>
              </div>

              {p.role === 'truth' && (
                <div>
                  <p className="text-[10px] text-text-dim uppercase">Response</p>
                  <p className="text-xs md:text-lg text-text-main font-medium line-clamp-3">{p.response || "(No answer)"}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {isHost && (
          <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4">
            <button onClick={nextRound} className="btn-primary shadow-2xl text-xl px-10 py-3 animate-bounce">
              Next Round ➤
            </button>
          </div>
        )}
      </div>
    );
  }

  return <div>Unknown Phase</div>;
}
