const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  playerId: String, // Persistent ID from localStorage
  socketId: String, // Ephemeral socket ID
  nickname: String,
  isHost: { type: Boolean, default: false },
  truth: String, // Question to ask (Phase 1)
  dare: String, // Challenge to give (Phase 1)
  targetId: String, // Who they are assigning to (Randomly assigned)
  response: String, // Response to the received truth/dare
  role: { type: String, enum: ['truth', 'dare', null], default: null }, // Assigned role for round
  isReady: { type: Boolean, default: false }, // Has clicked submit
  // Phase 1: Player writes a Truth/Dare for SOMEONE ELSE? 
  // Prompt says: "Players write their own 'Truth' question or 'Dare' challenge for the other person" 
  // It implies 1v1 or pair matching. If >2 players, logic needs specific pairing. 
  // Assuming 1v1 for MVP or Round Robin. "Display *both players* questions" implies 1v1 or specifically 2 active players.
  // We'll stick to a general structure where everyone can play.
});

const RoomSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  hostId: String,
  players: [PlayerSchema],
  phase: { type: String, enum: ['lobby', 'input', 'action', 'reveal'], default: 'lobby' },
  currentRole: { type: String, enum: ['truth', 'dare', null], default: null },
  timer: { type: Number, default: 60 },
  round: { type: Number, default: 1 },
  turnTimerUsed: { type: Number, default: 60 },
  createdAt: { type: Date, expires: '24h', default: Date.now }
});

module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);
