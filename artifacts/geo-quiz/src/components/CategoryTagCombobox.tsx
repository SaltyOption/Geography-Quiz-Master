import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type CategoryTag = {
  id: number;
  name: string;
  depth: number;
  taggedQuestionCount: number;
};

type CategoryTagComboboxProps = {
  tags: CategoryTag[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  /** When provided, shows a top option that clears the selection. */
  noneLabel?: string;
};

export function CategoryTagCombobox({
  tags,
  value,
  onChange,
  placeholder = "Select a category",
  noneLabel,
}: CategoryTagComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = tags.find((t) => t.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected
              ? `${selected.name} (${selected.taggedQuestionCount})`
              : noneLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {noneLabel && (
                <CommandItem
                  value="__none__"
                  keywords={[noneLabel]}
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {noneLabel}
                </CommandItem>
              )}
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={String(tag.id)}
                  keywords={[tag.name]}
                  disabled={tag.taggedQuestionCount === 0}
                  onSelect={(val) => {
                    onChange(Number(val));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === tag.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span style={{ paddingLeft: `${tag.depth * 0.75}rem` }}>
                    {tag.name} ({tag.taggedQuestionCount})
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
