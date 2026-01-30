
export default function Modal({ isOpen, title, children, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", singleButton = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md p-6 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <h3 className="text-2xl font-bold text-theme-primary mb-4 border-b border-[var(--glass-border)] pb-2">
          {title}
        </h3>

        <div className="mb-8 text-text-main text-lg">
          {children}
        </div>

        <div className="flex justify-end gap-4">
          {!singleButton && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-text-dim hover:bg-white/5 transition-colors font-medium"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="btn-primary"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
