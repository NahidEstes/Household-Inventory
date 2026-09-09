'use client';

import { LoaderCircle, PackageSearch } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

export type ProductSuggestion = {
  inventoryItemId: number;
  name: string;
  category: string;
  unit: string;
  location: string;
  specificSpot: string | null;
};

type ProductNameAutocompleteProps = {
  id: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
  onProductSelect?: (product: ProductSuggestion) => void;
};

export function ProductNameAutocomplete({
  id,
  name,
  value,
  defaultValue = '',
  placeholder,
  ariaLabel,
  required,
  onValueChange,
  onProductSelect,
}: ProductNameAutocompleteProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearch = useRef(false);
  const listId = `${useId().replace(/:/g, '')}-products`;
  const currentValue = value ?? internalValue;

  useEffect(() => {
    const term = currentValue.trim();
    if (term.length < 2) return;
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/products?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('Product search failed');
        const rows = (await response.json()) as ProductSuggestion[];
        setSuggestions(rows);
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
  }, [currentValue]);

  function updateValue(next: string) {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
    if (next.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
    }
    setOpen(next.trim().length >= 2);
  }

  function choose(product: ProductSuggestion) {
    skipNextSearch.current = true;
    if (value === undefined) setInternalValue(product.name);
    onValueChange?.(product.name);
    onProductSelect?.(product);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
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
        aria-label={ariaLabel}
        autoComplete="off"
        id={id}
        name={name}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => updateValue(event.target.value)}
        onFocus={() => setOpen(currentValue.trim().length >= 2)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        role="combobox"
        value={currentValue}
      />
      {loading && <LoaderCircle aria-hidden="true" className="product-spin" />}
      {open && currentValue.trim().length >= 2 && (
        <div className="product-suggestions" id={listId}>
          {suggestions.length ? (
            suggestions.map((product, index) => (
              <button
                className={activeIndex === index ? 'active' : ''}
                id={`${listId}-${index}`}
                key={product.name.toLowerCase()}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(product)}
                type="button"
              >
                <PackageSearch aria-hidden="true" size={16} />
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {product.category} · {product.unit} · {product.location}
                  </small>
                </span>
              </button>
            ))
          ) : loading ? null : (
            <p>No existing product found. You can use this new name.</p>
          )}
        </div>
      )}
    </div>
  );
}
