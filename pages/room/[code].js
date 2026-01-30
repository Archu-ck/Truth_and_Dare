import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getSocket, getPlayerId } from '../../lib/socket';
import PlayerList from '../../components/PlayerList';
import ChatBox from '../../components/ChatBox';
import GameStage from '../../components/GameStage';

import Modal from '../../components/Modal';

import ThemeToggle from '../../components/ThemeToggle';

export default function RoomPage() {
  const router = useRouter();
  const { code } = router.query;
  const socket = getSocket();

  const [room, setRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // Keep track of self
  const [timer, setTimer] = useState(0);

  // Modal States
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [notification, setNotification] = useState(null); // { title: string, message: string }

  useEffect(() => {
    if (!code) return;

    const playerId = getPlayerId();

    // Identify self
    setCurrentUser({ playerId });

    // Request current room state
    socket.emit('request_room_data', { code, playerId });

    // If we just landed here (e.g. refresh), we might need to re-join or fetch state?
    // For now, assume flow comes from Home which joins.
    // If refresh, socket is new -> new ID -> not in room.
    // Handling refresh is complex with ephemeral sockets. 
    // We will assume "Don't Refresh" for this MVP or prompt to rejoin.

    // Listeners
    socket.on('player_joined', ({ room }) => setRoom(room));
    socket.on('player_left', ({ room }) => setRoom(room));
    socket.on('game_started', ({ room }) => setRoom(room));
    socket.on('room_updated', ({ room }) => setRoom(room));
    socket.on('phase_change', ({ room }) => setRoom(room));
    socket.on('timer_tick', (t) => setTimer(t));
    socket.on('room_closed', () => {
      // Should technically be handled by notifications now if host re-assigned? 
      // Assuming server deletes room ONLY if empty.
      // But if server.js emits room_closed string...
      // Previous logic: Host left -> Room Closed. New logic: Host left -> new Host.
      // So 'room_closed' shouldn't fire unless room deleted?
      // Actually server.js code for delete says: await Room.deleteOne({ code }) if players.length===0.
      // So active players shouldn't receive 'room_closed'.
      alert('Room closed.');
      router.push('/');
    });

    socket.on('player_left_notification', ({ nickname, isNewHost }) => {
      setNotification({
        title: 'Player Left',
        message: `${nickname} has left the game. The game has been reset to the lobby.` + (isNewHost ? ' A new host has been assigned.' : '')
      });
    });

    return () => {
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('game_started');
      socket.off('room_updated');
      socket.off('phase_change');
      socket.off('timer_tick');
      socket.off('room_closed');
      socket.off('player_left_notification');
    };
  }, [code, router, socket]);

  // Set current player object if available in room players
  useEffect(() => {
    const playerId = getPlayerId();
    if (room && playerId) {
      const me = room.players.find(p => p.playerId === playerId);
      if (me) setCurrentUser(me);
    }
  }, [room]);

  const confirmLeaveRoom = () => {
    socket.emit('leave_room', { code, playerId: getPlayerId() });
    router.push('/');
  };

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center text-theme-main">
      <div className="tex-center">
        <h2 className="text-2xl mb-4">Joining Room...</h2>
        <button
          onClick={() => router.push('/')}
          className="text-theme-primary hover:underline"
        >
          Values lost? Go Home
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 h-screen flex flex-col">
      <ThemeToggle />

      {/* Leave Modal */}
      <Modal
        isOpen={showLeaveModal}
        title="Leave Match"
        onConfirm={confirmLeaveRoom}
        onCancel={() => setShowLeaveModal(false)}
        confirmText="Leave"
        cancelText="Stay"
      >
        Are you sure you want to leave the match?
      </Modal>

      {/* Notification Modal */}
      <Modal
        isOpen={!!notification}
        title={notification?.title || 'Notice'}
        singleButton
        confirmText="Okay"
        onConfirm={() => setNotification(null)}
      >
        {notification?.message}
      </Modal>

      {/* Header */}
      <header className="flex justify-between items-center mb-6 px-4">
        <div className="flex flex-col">
          <h1 className="font-bold text-2xl text-theme-main leading-tight">
            Truth and Dare
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono bg-theme-primary/10 text-theme-primary px-2 py-0.5 rounded border border-theme-primary/20">
              #{code}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-theme-dim font-bold">
              • {room.phase} Phase
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowLeaveModal(true)}
          className="group flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-red-500/20 active:scale-95"
        >
          <span>Leave Room</span>
          <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
        </button>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 overflow-hidden">
        {/* Left: Players (Desktop Only) */}
        <div className="w-1/4 max-w-[250px] hidden lg:block">
          <PlayerList players={room.players} currentUser={currentUser} />
        </div>

        {/* Center: Stage (Top on Mobile) */}
        <div className="flex-[3] flex flex-col min-h-0 order-1 md:order-2">
          <div className="flex-1 glass-panel relative p-2 md:p-6 overflow-y-auto">
            <GameStage room={room} socket={socket} currentUser={currentUser} timer={timer} />
          </div>
        </div>

        {/* Right: Chat (Bottom on Mobile) */}
        <div className="flex-[2] md:w-1/4 lg:max-w-[300px] flex flex-col min-h-0 order-2 md:order-3">
          <ChatBox socket={socket} roomCode={code} nickname={currentUser?.nickname || 'Anon'} />
        </div>
      </div>

      {/* Mobile/Tablet Fallback for panels (optional, for MVP just hiding/stacking) */}
    </div>
  );
}
