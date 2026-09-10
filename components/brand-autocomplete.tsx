'use client';

import { LoaderCircle, Tags } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

type BrandSuggestion = { id: number; name: string };

export function BrandAutocomplete({
  id,
  name = 'brand',
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  placeholder = 'e.g. Almarai',
}: {
  id: string;
  name?: string;
  defaultValue?: string | null;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const value = controlledValue ?? internalValue;
  const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = `${useId().replace(/:/g, '')}-brands`;

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/brands?q=${encodeURIComponent(term)}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error('Brand search failed');
        setSuggestions((await response.json()) as BrandSuggestion[]);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  function choose(brand: BrandSuggestion) {
    setInternalValue(brand.name);
    onValueChange?.(brand.name);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length : index) - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === 'Escape') setOpen(false);
  }

  return (
    <div className="product-autocomplete">
      <input
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        autoComplete="off"
        id={id}
        name={name}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          setInternalValue(event.target.value);
          onValueChange?.(event.target.value);
          setOpen(event.target.value.trim().length >= 2);
        }}
        onFocus={() => setOpen(value.trim().length >= 2)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={value}
      />
      {loading && <LoaderCircle aria-hidden="true" className="product-spin" />}
      {open && value.trim().length >= 2 && (
        <div className="product-suggestions" id={listId}>
          {suggestions.length ? (
            suggestions.map((brand, index) => (
              <button
                className={activeIndex === index ? 'active' : ''}
                id={`${listId}-${index}`}
                key={brand.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(brand)}
                type="button"
              >
                <Tags aria-hidden="true" size={16} />
                <span>
                  <strong>{brand.name}</strong>
                </span>
              </button>
            ))
          ) : loading ? null : (
            <p>No existing brand found. You can use this new name.</p>
          )}
        </div>
      )}
    </div>
  );
}
