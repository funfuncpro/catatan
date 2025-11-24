import { createSignal, onMount } from "solid-js";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

export function Toast(props: ToastProps) {
  const [isVisible, setIsVisible] = createSignal(false);
  const duration = props.duration ?? 3000;

  onMount(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-close after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(props.onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  });

  const getTypeStyles = () => {
    switch (props.type) {
      case "success":
        return "bg-green-500 text-white";
      case "error":
        return "bg-red-500 text-white";
      case "info":
      default:
        return "bg-primary text-background";
    }
  };

  const getIcon = () => {
    switch (props.type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "info":
      default:
        return "ℹ";
    }
  };

  return (
    <div
      class={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${getTypeStyles()} ${
        isVisible()
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2"
      }`}
    >
      <span class="text-lg font-semibold">{getIcon()}</span>
      <span class="text-sm font-medium">{props.message}</span>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: number; message: string; type?: "success" | "error" | "info" }>;
  onRemove: (id: number) => void;
}

export function ToastContainer(props: ToastContainerProps) {
  return (
    <div class="fixed bottom-0 right-0 z-50 p-4 pointer-events-none">
      {props.toasts.map((toast) => (
        <div class="pointer-events-auto mb-2">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => props.onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
