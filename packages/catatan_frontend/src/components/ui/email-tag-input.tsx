import { createSignal, For, Show } from "solid-js";

interface EmailTagInputProps {
  emails: string[];
  onEmailsChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function EmailTagInput(props: EmailTagInputProps) {
  const [inputValue, setInputValue] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) return;

    if (!validateEmail(trimmedEmail)) {
      setError("Invalid email format");
      return;
    }

    if (props.emails.includes(trimmedEmail)) {
      setError("Email already added");
      return;
    }

    props.onEmailsChange([...props.emails, trimmedEmail]);
    setInputValue("");
    setError(null);
  };

  const removeEmail = (emailToRemove: string) => {
    props.onEmailsChange(props.emails.filter((email) => email !== emailToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail(inputValue());
    } else if (e.key === "Backspace" && !inputValue() && props.emails.length > 0) {
      // Remove last email when backspace is pressed on empty input
      removeEmail(props.emails[props.emails.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue()) {
      addEmail(inputValue());
    }
  };

  return (
    <div class="w-full">
      <div class="flex flex-wrap gap-2 p-2 bg-secondary border border-custom rounded min-h-[42px] focus-within:border-primary transition-colors">
        <For each={props.emails}>
          {(email) => (
            <div class="flex items-center gap-1 px-2 py-1 bg-primary text-background rounded text-sm">
              <span>{email}</span>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                disabled={props.disabled}
                class="ml-1 hover:text-red-300 disabled:opacity-50"
                aria-label={`Remove ${email}`}
              >
                ×
              </button>
            </div>
          )}
        </For>
        <input
          type="text"
          value={inputValue()}
          onInput={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={props.disabled}
          placeholder={props.emails.length === 0 ? props.placeholder : ""}
          class="flex-1 min-w-[120px] bg-transparent outline-none text-sm disabled:opacity-50"
        />
      </div>
      <Show when={error()}>
        <p class="text-red-500 text-xs mt-1">{error()}</p>
      </Show>
    </div>
  );
}
