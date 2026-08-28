'use client';
import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children, pendingLabel, className = 'btn btn-primary', ...rest }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...rest}>
      {pending ? (pendingLabel ?? 'Working\u2026') : children}
    </button>
  );
}
