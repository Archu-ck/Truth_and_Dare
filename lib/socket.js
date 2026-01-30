import io from 'socket.io-client';

let socket;

export const getSocket = () => {
  if (typeof window !== 'undefined' && !socket) {
    socket = io();

    // Manage persistent ID
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
      playerId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('playerId', playerId);
    }
  }
  return socket;
};

export const getPlayerId = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('playerId');
  }
  return null;
};
