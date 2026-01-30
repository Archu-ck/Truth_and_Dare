require('dotenv').config();
const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Room = require('./models/Room');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/truthndare';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
}).then(() => console.log('âœ… MongoDB Connected Successfully'))
  .catch(err => {
    console.error('âŒ MongoDB Connection Error Details:', {
      message: err.message,
      name: err.name,
      code: err.code
    });
  });

mongoose.connection.on('connecting', () => console.log('â³ Connecting to MongoDB...'));
mongoose.connection.on('error', (err) => console.error('âŒ Mongoose Error:', err));
mongoose.connection.on('disconnected', () => console.warn('âš ï¸ MongoDB Disconnected'));

// Timer Management
const roomTimers = {};

function startRoomTimer(code) {
  if (roomTimers[code]) clearInterval(roomTimers[code]);

  roomTimers[code] = setInterval(async () => {
    const room = await Room.findOne({ code });
    if (!room) {
      clearInterval(roomTimers[code]);
      return;
    }

    if (room.timer > 0) {
      room.timer--;
      // Optimization: Don't write to DB every second unless needed.
      // But for syncing, we might want to emit 'timer_update' 
      // without saving every single second to minimize DB writes.
      // But if server crashes, state is lost. 
      // For this scale, saving every few seconds or just emitting is fine.
      // We'll emit every second, save every 5?
      // Let's just emit to clients. Clients decrease their own timer. Server syncs periodically.
      // Simple approach: Emit tick.
      io.to(code).emit('timer_tick', room.timer);

      if (room.timer % 5 === 0) await room.save(); // Save periodically
    } else {
      // Timer expired
      clearInterval(roomTimers[code]);
      handleTimerExpiry(code, room);
    }
  }, 1000);
}

function stopRoomTimer(code) {
  if (roomTimers[code]) clearInterval(roomTimers[code]);
}

function resetRoomTimer(code) {
  startRoomTimer(code);
}

async function handleTimerExpiry(code, room) {
  if (room.phase === 'input') {
    // Fill in default values for anyone who didn't get a prompt
    room.players.forEach(p => {
      const writer = room.players.find(w => w.targetId === p.id);
      if (p.role === 'truth' && !p.truth) p.truth = "(No question provided)";
      if (p.role === 'dare' && !p.dare) p.dare = "(No dare provided)";
    });

    if (room.currentRole === 'truth') {
      room.phase = 'action';
      room.timer = room.turnTimerUsed;
      room.players.forEach(p => p.isReady = false); // Reset for next phase
      await room.save();
      io.to(code).emit('phase_change', { room, phase: 'action' });
      startRoomTimer(code);
    } else {
      room.phase = 'reveal';
      room.timer = 0;
      room.players.forEach(p => p.isReady = false);
      await room.save();
      io.to(code).emit('phase_change', { room, phase: 'reveal' });
      stopRoomTimer(code);
    }
  } else if (room.phase === 'action') {
    // Fill in default values for anyone who didn't respond
    room.players.forEach(p => {
      if (!p.response) p.response = "(No response provided)";
    });

    room.phase = 'reveal';
    room.timer = 0;
    await room.save();
    io.to(code).emit('phase_change', { room, phase: 'reveal' });
    stopRoomTimer(code);
  }
}

// Global IO reference
let io;

const server = express();
const httpServer = http.createServer(server);
io = new Server(httpServer);

// Start listening immediately so Sockets work even while Next.js compiles
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, (err) => {
  if (err) throw err;
  console.log(`> Server active on http://localhost:${PORT}`);
});

app.prepare().then(() => {
  console.log('> Next.js Ready');


  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- Lobby Events ---
    socket.on('create_room', async ({ nickname, playerId }) => {
      console.log('Event: create_room received', { nickname, playerId });
      if (mongoose.connection.readyState !== 1) {
        return socket.emit('error', 'Database not connected.');
      }
      try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = await Room.create({
          code,
          hostId: playerId,
          players: [{ playerId, socketId: socket.id, nickname, isHost: true }]
        });
        socket.join(code);
        socket.emit('room_created', { code, room });
      } catch (err) {
        console.error('Error creating room:', err);
        socket.emit('error', 'Failed to create room');
      }
    });

    socket.on('join_room', async ({ code, nickname, playerId }) => {
      try {
        const room = await Room.findOne({ code });
        if (!room) return socket.emit('error', 'Room not found');

        // Check if player already in room (reconnection)
        let player = room.players.find(p => p.playerId === playerId);
        if (player) {
          player.socketId = socket.id;
        } else {
          room.players.push({ playerId, socketId: socket.id, nickname, isHost: false });
        }

        await room.save();
        socket.join(code);
        io.to(code).emit('player_joined', { room });
        socket.emit('joined_success', { room });
      } catch (err) {
        console.error(err);
      }
    });

    // --- Game Events ---
    socket.on('start_game', async ({ code, turnTimer, playerId }) => {
      try {
        const room = await Room.findOne({ code });
        if (!room || room.hostId !== playerId) return; // Only host

        room.turnTimerUsed = turnTimer || 60;
        room.round = 1;

        // Assign Roles (50/50 Chance) to ALL players
        if (room.players.length < 2) return socket.emit('error', 'Need 2 players to start');

        const sharedRole = Math.random() < 0.5 ? 'truth' : 'dare';
        room.currentRole = sharedRole;

        room.players.forEach(p => {
          p.role = sharedRole;
          p.truth = '';
          p.dare = '';
          p.response = '';
          p.isReady = false;
        });

        // Target assignment: P1->P2, P2->P3... Pn->P1
        for (let i = 0; i < room.players.length; i++) {
          const nextIdx = (i + 1) % room.players.length;
          room.players[i].targetId = room.players[nextIdx].playerId;
        }

        room.phase = 'input';
        room.timer = room.turnTimerUsed;

        await room.save();
        io.to(code).emit('game_started', { room });

        startRoomTimer(code);

      } catch (err) {
        console.error(err);
      }
    });

    socket.on('submit_input', async ({ code, content, playerId }) => {
      try {
        const room = await Room.findOne({ code });
        if (!room) return;

        const player = room.players.find(p => p.playerId === playerId);
        if (!player) return;

        player.isReady = true;

        // Save input to the TARGET's record
        const target = room.players.find(p => p.playerId === player.targetId);
        if (target) {
          if (target.role === 'truth') target.truth = content || "(Empty Question)";
          if (target.role === 'dare') target.dare = content || "(Empty Dare)";
        }

        const allSubmitted = room.players.every(p => p.isReady);
        // Actually, simpler: Check if every target has a filled prompt?
        // Yes.

        await room.save();
        io.to(code).emit('room_updated', { room });

        if (allSubmitted) {
          if (room.currentRole === 'truth') {
            room.phase = 'action';
            room.timer = room.turnTimerUsed;
            room.players.forEach(p => p.isReady = false);
            await room.save();
            io.to(code).emit('phase_change', { room, phase: 'action' });
            resetRoomTimer(code);
          } else {
            room.phase = 'reveal';
            room.timer = 0;
            room.players.forEach(p => p.isReady = false);
            await room.save();
            io.to(code).emit('phase_change', { room, phase: 'reveal' });
            stopRoomTimer(code);
          }
        }

      } catch (err) {
        console.error(err);
      }
    });

    socket.on('submit_response', async ({ code, response, playerId }) => {
      try {
        const room = await Room.findOne({ code });
        if (!room) return;

        const player = room.players.find(p => p.playerId === playerId);
        if (!player) return;

        player.response = response || "(Empty Response)";
        player.isReady = true;

        await room.save();
        io.to(code).emit('room_updated', { room });

        const allResponded = room.players.every(p => p.isReady);
        if (allResponded) {
          room.phase = 'reveal';
          room.timer = 0;
          room.players.forEach(p => p.isReady = false);
          await room.save();
          io.to(code).emit('phase_change', { room, phase: 'reveal' });
          stopRoomTimer(code);
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('next_round', async ({ code, playerId }) => {
      const room = await Room.findOne({ code });
      if (!room || room.hostId !== playerId) return;

      room.round++;
      room.phase = 'input';
      room.timer = room.turnTimerUsed;

      const sharedRole = room.currentRole === 'truth' ? 'dare' : 'truth';
      room.currentRole = sharedRole;

      room.players.forEach(p => {
        p.role = sharedRole;
        p.truth = '';
        p.dare = '';
        p.response = '';
        p.isReady = false;
      });

      await room.save();
      io.to(code).emit('game_started', { room });
      startRoomTimer(code);
    });

    socket.on('request_room_data', async ({ code, playerId }) => {
      console.log('Event: request_room_data', { code, playerId });
      try {
        const room = await Room.findOne({ code });
        if (room) {
          socket.join(code);
          // Update socket ID for the player
          const player = room.players.find(p => p.playerId === playerId);
          if (player) {
            player.socketId = socket.id;
            await room.save();
          }
          socket.emit('room_updated', { room });
        } else {
          socket.emit('error', 'Room not found');
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('leave_room', async ({ code, playerId }) => {
      try {
        const room = await Room.findOne({ code });
        if (!room) return;

        const leaverIndex = room.players.findIndex(p => p.playerId === playerId);
        if (leaverIndex === -1) return;

        const leaver = room.players[leaverIndex];
        const wasHost = leaver.isHost;

        // Remove player
        room.players.splice(leaverIndex, 1);

        if (room.players.length === 0) {
          // No players left -> Delete room
          await Room.deleteOne({ code });
          // Clear timer if exists
          if (roomTimers[code]) clearInterval(roomTimers[code]);
        } else {
          // Players remain -> Handle Host reassignment + Game Reset
          if (wasHost && room.players.length > 0) {
            room.players[0].isHost = true; // Assign new host
            room.hostId = room.players[0].playerId; // Update Top-Level Host ID
          }

          // Reset game state to Lobby (Initial Start Scene)
          room.phase = 'lobby';
          room.round = 0;
          room.timer = 0;
          room.currentRole = null;
          // Clear player game states
          room.players.forEach(p => {
            p.truth = '';
            p.dare = '';
            p.response = '';
            p.isReady = false;
            p.role = null;
            p.targetId = null;
          });

          // Stop timer
          if (roomTimers[code]) clearInterval(roomTimers[code]);

          await room.save();

          // Notify others
          socket.to(code).emit('player_left_notification', {
            nickname: leaver.nickname,
            isNewHost: wasHost // If true, the receiver might check if THEY are the new host
          });

          // Send updated room state
          io.to(code).emit('room_updated', { room });
        }

        socket.leave(code);
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('send_message', ({ code, message, nickname }) => {
      io.to(code).emit('chat_message', { nickname, message, timestamp: new Date() });
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      // We don't remove players immediately anymore to allow reconnection.
      // The room will persist because of the TTL on Room schema.
    });
  });

  server.all(/.*/, (req, res) => {
    return handle(req, res);
  });
});
