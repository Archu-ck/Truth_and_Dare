import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSocket, getPlayerId } from '../lib/socket';
import ThemeToggle from '../components/ThemeToggle';

export default function Home() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const router = useRouter();
  const socket = getSocket();

  useEffect(() => {
    socket.on('room_created', ({ code }) => {
      router.push(`/room/${code}`);
    });

    socket.on('joined_success', ({ room }) => {
      router.push(`/room/${room.code}`);
    });

    socket.on('error', (msg) => {
      alert(msg);
    });

    return () => {
      socket.off('room_created');
      socket.off('joined_success');
      socket.off('error');
    };
  }, [router, socket]);

  const createRoom = () => {
    if (!nickname) return alert('Enter a nickname!');
    const playerId = getPlayerId();
    console.log('Emitting create_room', { nickname, playerId });
    socket.emit('create_room', { nickname, playerId });
  };

  const joinRoom = () => {
    if (!nickname || !roomCode) return alert('Enter nickname and room code!');
    const playerId = getPlayerId();
    socket.emit('join_room', { code: roomCode.toUpperCase(), nickname, playerId });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <ThemeToggle />
      <div className="glass-panel p-8 w-full max-w-md text-center">
        <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] mb-8">
          Truth and Dare
        </h1>

        <div className="space-y-6">
          <div>
            <input
              type="text"
              placeholder="Your Nickname"
              className="input-field text-center text-xl"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <button onClick={createRoom} className="btn-primary w-1/2">
              Create Room
            </button>
            <div className="w-1/2 space-y-2">
              <input
                type="text"
                placeholder="Room Code"
                className="input-field text-center uppercase"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
              <button onClick={joinRoom} className="btn-secondary w-full">
                Join
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-theme-dim font-medium">
        Made with ❤️ by <span className="text-theme-primary">archis</span>
      </footer>
    </div>
  );
}
