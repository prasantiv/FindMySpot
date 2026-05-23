import { useId, useRef, useState, type FormEvent } from 'react';

interface AddressFormProps {
  onSubmit: (address: string) => void;
  disabled?: boolean;
}

const EXAMPLES = [
  '1300 SW 5th Ave, Portland, OR',
  'Powell\'s City of Books',
  'Portland State University',
];

/**
 * Mobile-first, single-input search form. All form controls have programmatic
 * labels; the submit button is never the only way to submit (Enter works too).
 */
export function AddressForm({ onSubmit, disabled = false }: AddressFormProps) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setError('Please enter at least 3 characters.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-describedby={helpId}>
      <label htmlFor={inputId} className="block text-base font-medium text-slate-900">
        Address or place in Portland, OR
      </label>
      <p id={helpId} className="mt-1 text-sm text-slate-600">
        We&rsquo;ll find the 5 closest ADA-accessible parking spots within Portland city limits.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="street-address"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          required
          aria-required="true"
          aria-invalid={error != null}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          placeholder="e.g. 1300 SW 5th Ave"
          className="block w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand-500 focus:ring-0 disabled:bg-slate-100 disabled:text-slate-500"
        />
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-md bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {disabled ? 'Searching…' : 'Find ADA spots'}
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Try one of these
        </legend>
        <ul className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => {
                  setValue(example);
                  setError(null);
                  inputRef.current?.focus();
                }}
                disabled={disabled}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    </form>
  );
}
