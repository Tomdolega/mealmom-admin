type FormFieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
};

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
