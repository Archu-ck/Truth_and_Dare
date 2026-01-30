import { useState, useEffect, useRef } from 'react';

export default function ChatBox({ socket, roomCode, nickname }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat_message', handleMessage);

    return () => {
      socket.off('chat_message', handleMessage);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('send_message', { code: roomCode, message: input, nickname });
    setInput('');
  };

  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold text-secondary mb-4 border-b border-[var(--glass-border)] pb-2">Chat</h2>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {messages.map((msg, idx) => (
          <div key={idx} className="bg-black/5 dark:bg-white/5 p-2 rounded-lg">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-bold text-primary text-sm">{msg.nickname}</span>
              <span className="text-[10px] text-text-dim">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-sm text-text-main break-words">{msg.message}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="input-field text-sm py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          placeholder="Type a message..."
        />
        <button type="submit" className="bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 p-2 rounded-lg text-primary transition-colors">
          ➤
        </button>
      </form>
    </div>
  );
}
