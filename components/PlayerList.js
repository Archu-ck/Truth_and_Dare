export default function PlayerList({ players, currentUser }) {
  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold text-primary mb-4 border-b border-[var(--glass-border)] pb-2">Players</h2>
      <div className="space-y-2 overflow-y-auto flex-1">
        {players.map((p) => (
          <div
            key={p.playerId}
            className={`p-3 rounded-lg flex items-center justify-between ${p.playerId === currentUser?.playerId
                ? 'bg-primary/20 border border-primary/50'
                : 'bg-black/5 dark:bg-white/5'
              }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${p.isHost ? 'bg-secondary' : 'bg-gray-400'}`}></div>
              <span className="font-medium text-text-main">{p.nickname}</span>
            </div>
            {p.isHost && <span className="text-xs text-secondary bg-secondary/10 px-2 py-0.5 rounded">HOST</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
