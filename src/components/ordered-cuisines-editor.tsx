"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type OrderedCuisinesEditorProps = {
  available: string[];
  value: string[];
  onChange: (value: string[]) => void;
};

export function OrderedCuisinesEditor({ available, value, onChange }: OrderedCuisinesEditorProps) {
  const remaining = available.filter((item) => !value.includes(item));

  function move(index: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= value.length) return;
    const next = [...value];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <Select
        defaultValue=""
        onChange={(event) => {
          const chosen = event.target.value;
          if (!chosen) return;
          onChange([...value, chosen]);
          event.currentTarget.value = "";
        }}
      >
        <option value="">Add cuisine to your ranking...</option>
        {remaining.map((cuisine) => (
          <option key={cuisine} value={cuisine}>
            {cuisine}
          </option>
        ))}
      </Select>

      <div className="space-y-2">
        {value.length === 0 ? <p className="text-sm text-slate-500">No cuisines selected yet.</p> : null}
        {value.map((cuisine, index) => (
          <div key={cuisine} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-800">
              {index + 1}. {cuisine}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => move(index, "up")}>Up</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => move(index, "down")}>Down</Button>
              <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => onChange(value.filter((item) => item !== cuisine))}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
