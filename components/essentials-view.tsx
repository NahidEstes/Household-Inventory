'use client';

import {
  AlertTriangle,
  Box,
  Check,
  Pencil,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type SyntheticEvent } from 'react';
import { type EssentialStatus } from '@/lib/essentials-core';
import { formatQuantity } from '@/lib/quantity';

export type EssentialItem = {
  id: number;
  name: string;
  brand: string | null;
  normalizedName: string;
  normalizedBrand: string;
  unit: string;
  minimumStock: number;
  minimumStockUnit: string;
  autoAddToShoppingList: boolean;
  currentStock: number;
  category: string;
  location: string;
  status: EssentialStatus;
};

export type EssentialInventoryItem = {
  id: number;
  name: string;
  brand: string | null;
  unit: string;
  category: string;
  quantity: number;
};

export type EssentialShoppingItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  completed: boolean;
};

export type EssentialInput = {
  inventoryItemId?: number;
  id?: number;
  minimumStock: number;
  minimumStockUnit?: string;
  autoAddToShoppingList: boolean;
};

type Props = {
  items: EssentialItem[];
  inventory: EssentialInventoryItem[];
  shopping: EssentialShoppingItem[];
  autoAddWhenLow: boolean;
  readOnly: boolean;
  query: string;
  dialogOpen: boolean;
  editing: EssentialItem | null;
  onOpenAdd: () => void;
  onOpenEdit: (item: EssentialItem) => void;
  onCloseDialog: () => void;
  onSave: (input: EssentialInput) => Promise<boolean>;
  onRemove: (item: EssentialItem) => Promise<boolean>;
  onAddToShopping: (item: EssentialItem) => Promise<void>;
  onToggleAuto: (enabled: boolean) => Promise<boolean>;
  onGoShopping: () => void;
  onGoInventory: () => void;
};

export function EssentialsView({
  items,
  inventory,
  shopping,
  autoAddWhenLow,
  readOnly,
  query,
  dialogOpen,
  editing,
  onOpenAdd,
  onOpenEdit,
  onCloseDialog,
  onSave,
  onRemove,
  onAddToShopping,
  onToggleAuto,
  onGoShopping,
  onGoInventory,
}: Props) {
  const [filter, setFilter] = useState<
    'All' | 'In Stock' | 'Low Stock' | 'Out of Stock'
  >('All');
  const [busy, setBusy] = useState(false);
  const attention = items.filter((item) => item.status !== 'In Stock');
  const openShopping = shopping.filter((item) => !item.completed);
  const filtered = items.filter((item) => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Low Stock'
        ? item.status === 'Low Stock' || item.status === 'Buy Soon'
        : item.status === filter);
    return (
      matchesFilter &&
      `${item.name} ${item.brand ?? ''} ${item.category} ${item.location}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  });
  const shoppingNames = new Set(
    openShopping.map(
      (item) => `${item.name.trim().toLowerCase()}|${item.unit.toLowerCase()}`,
    ),
  );

  async function remove(item: EssentialItem) {
    if (
      !window.confirm(
        `Remove ${item.name} from Essentials? Its inventory stock will stay unchanged.`,
      )
    )
      return;
    setBusy(true);
    try {
      await onRemove(item);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="essentials-page">
      <section
        className="summary-grid essentials-summary"
        aria-label="Essentials summary"
      >
        {(
          [
            ['All', items.length, Box],
            [
              'In Stock',
              items.filter((item) => item.status === 'In Stock').length,
              Check,
            ],
            [
              'Low Stock',
              items.filter(
                (item) =>
                  item.status === 'Low Stock' || item.status === 'Buy Soon',
              ).length,
              AlertTriangle,
            ],
            [
              'Out of Stock',
              items.filter((item) => item.status === 'Out of Stock').length,
              ShoppingBasket,
            ],
          ] as const
        ).map(([label, count, Icon]) => (
          <button
            className={`summary-card essentials-summary-card${filter === label ? ' selected' : ''}`}
            key={label}
            onClick={() => setFilter(label)}
            type="button"
          >
            <span className="summary-icon"><Icon size={20} /></span>
            <span>
              <small>{label}</small>
              <strong>{count}</strong>
            </span>
          </button>
        ))}
      </section>

      <div className="essentials-layout">
        <section className="panel essentials-list-panel">
          <div className="essentials-panel-heading">
            <div>
              <h2>All Essentials</h2>
              <p>
                {filtered.length} shown · stock combines all matching inventory
                batches
              </p>
            </div>
          </div>
          {filtered.length ? (
            <div className="table-wrap">
              <table aria-label="Essentials">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Current stock</th>
                    <th>Minimum stock</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const shoppingKey = `${item.name.trim().toLowerCase()}|${item.unit.toLowerCase()}`;
                    return (
                      <tr key={item.id}>
                        <td aria-label={`${item.name}, ${item.category}`} data-label="Item">
                          <span className="table-item">
                            <span className="food-icon" aria-hidden="true">
                              <Box size={18} />
                            </span>
                            <span>
                              <strong>{item.name}</strong>
                              {item.brand && <small>{item.brand}</small>}
                            </span>
                          </span>
                        </td>
                        <td data-label="Current stock">
                          {formatQuantity(item.currentStock)} {item.unit}
                        </td>
                        <td data-label="Minimum stock">
                          {formatQuantity(item.minimumStock)}{' '}
                          {item.minimumStockUnit}
                        </td>
                        <td data-label="Category">{item.category}</td>
                        <td data-label="Location">{item.location}</td>
                        <td data-label="Status">
                          <span
                            className={`status ${statusClass(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td data-label="Actions">
                          <div className="essentials-row-actions">
                            {!readOnly && item.status !== 'In Stock' && (
                              <button
                                className="essential-add-list"
                                disabled={busy || shoppingNames.has(shoppingKey)}
                                onClick={async () => {
                                  setBusy(true);
                                  try { await onAddToShopping(item); }
                                  finally { setBusy(false); }
                                }}
                                type="button"
                              >
                                {shoppingNames.has(shoppingKey)
                                  ? 'On list'
                                  : 'Add to list'}
                              </button>
                            )}
                            {!readOnly && (
                              <div className="row-actions">
                                <button aria-label={`Edit ${item.name}`} onClick={() => onOpenEdit(item)} title="Edit essential" type="button"><Pencil size={15} /></button>
                                <button aria-label={`Remove ${item.name} from Essentials`} disabled={busy} onClick={() => remove(item)} title="Remove essential" type="button"><Trash2 size={15} /></button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <span>
                <Box size={24} />
              </span>
              <h3>
                {items.length ? 'No essentials match' : 'No essentials yet'}
              </h3>
              <p>
                {items.length
                  ? 'Try another search or summary filter.'
                  : 'Choose an inventory product and set the stock level you want to keep at home.'}
              </p>
              {!items.length && !readOnly && (
                <button
                  className="primary-button"
                  onClick={onOpenAdd}
                  type="button"
                >
                  Add Essential
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="essentials-side">
          <section className="panel essentials-side-card">
            <div className="essentials-side-heading">
              <h2>Needs Attention</h2>
              <small>{attention.length} items</small>
            </div>
            {attention.length ? (
              attention.slice(0, 5).map((item) => (
                <div className="essentials-side-row" key={item.id}>
                  <span className="food-icon" aria-hidden="true">
                    <Box size={17} />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {formatQuantity(item.currentStock)} {item.unit} · min{' '}
                      {formatQuantity(item.minimumStock)} {item.unit}
                    </small>
                  </span>
                  <span className={`status ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="essentials-muted">
                All essentials have enough stock.
              </p>
            )}
          </section>
          <section className="panel essentials-side-card">
            <div className="essentials-side-heading">
              <h2>Shopping List Preview</h2>
              <small>{openShopping.length} items</small>
            </div>
            {openShopping.length ? (
              openShopping.slice(0, 4).map((item) => (
                <div className="essentials-side-row" key={item.id}>
                  <span className="food-icon" aria-hidden="true">
                    <ShoppingBasket size={17} />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {formatQuantity(item.quantity)} {item.unit}
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p className="essentials-muted">Nothing to buy right now.</p>
            )}
            <button
              className="secondary-button essentials-full-button"
              onClick={onGoShopping}
              type="button"
            >
              View Shopping List
            </button>
          </section>
          <section className="panel essentials-side-card essentials-auto-card">
            <label>
              <span>
                <strong>Auto-add essentials when low</strong>
                <small>
                  Add enabled essentials to Shopping List when stock reaches the
                  minimum.
                </small>
              </span>
              <input
                aria-label="Auto-add essentials when low"
                checked={autoAddWhenLow}
                disabled={readOnly || busy}
                onChange={async (event) => {
                  setBusy(true);
                  try {
                    await onToggleAuto(event.target.checked);
                  } finally {
                    setBusy(false);
                  }
                }}
                role="switch"
                aria-checked={autoAddWhenLow}
                type="checkbox"
              />
            </label>
          </section>
        </aside>
      </div>
      {dialogOpen && (
        <EssentialDialog
          editing={editing}
          inventory={inventory}
          items={items}
          onClose={onCloseDialog}
          onGoInventory={onGoInventory}
          onSave={async (input) => {
            const saved = await onSave(input);
            if (saved) onCloseDialog();
            return saved;
          }}
        />
      )}
    </div>
  );
}

function statusClass(status: EssentialStatus) {
  if (status === 'Out of Stock') return 'out-of-stock';
  if (status === 'Low Stock') return 'expiring';
  if (status === 'Buy Soon') return 'low-stock';
  return '';
}

function EssentialDialog({
  editing,
  inventory,
  items,
  onClose,
  onGoInventory,
  onSave,
}: {
  editing: EssentialItem | null;
  inventory: EssentialInventoryItem[];
  items: EssentialItem[];
  onClose: () => void;
  onGoInventory: () => void;
  onSave: (input: EssentialInput) => Promise<boolean>;
}) {
  const choices = useMemo(() => {
    const existing = new Set(
      items.map(
        (item) =>
          `${item.normalizedName}|${item.normalizedBrand}|${item.unit.toLowerCase()}`,
      ),
    );
    const seen = new Set<string>();
    return inventory.filter((item) => {
      const key = `${item.name.trim().toLowerCase()}|${(item.brand ?? '').trim().toLowerCase()}|${item.unit.toLowerCase()}`;
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [inventory, items]);
  const [selectedId, setSelectedId] = useState(choices[0]?.id ?? 0);
  const [minimumStock, setMinimumStock] = useState(editing?.minimumStock ?? 1);
  const [autoAdd, setAutoAdd] = useState(
    editing?.autoAddToShoppingList ?? false,
  );
  const [saving, setSaving] = useState(false);
  const selected = choices.find((item) => item.id === selectedId);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !selected) return;
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        inventoryItemId: selected?.id,
        minimumStock,
        minimumStockUnit: editing?.unit ?? selected?.unit,
        autoAddToShoppingList: autoAdd,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-overlay">
      <dialog
        aria-labelledby="essential-dialog-title"
        className="inventory-dialog"
        open
      >
        <button
          aria-label="Close essential dialog"
          className="dialog-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
        <header className="dialog-header">
          <h2 id="essential-dialog-title">
            {editing ? `Edit ${editing.name}` : 'Add Essential'}
          </h2>
          <p>
            Set a minimum for an inventory product. Stock stays in Inventory.
          </p>
        </header>
        {!editing && !choices.length ? (
          <div className="essentials-dialog-empty">
            <p>
              {inventory.length
                ? 'Every inventory product is already an essential.'
                : 'Add an item to Inventory first.'}
            </p>
            <button
              className="secondary-button"
              onClick={() => {
                onClose();
                onGoInventory();
              }}
              type="button"
            >
              Go to Inventory
            </button>
          </div>
        ) : (
          <form className="dialog-form" onSubmit={submit}>
            {editing ? (
              <label>
                Inventory item
                <input
                  readOnly
                  value={`${editing.name}${editing.brand ? ` · ${editing.brand}` : ''} (${editing.unit})`}
                />
              </label>
            ) : (
              <label htmlFor="essential-inventory-item">
                Inventory item
                <select
                  id="essential-inventory-item"
                  onChange={(event) =>
                    setSelectedId(Number(event.target.value))
                  }
                  required
                  value={selectedId}
                >
                  {choices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.brand ? ` · ${item.brand}` : ''} · {item.unit}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="form-grid">
              <label htmlFor="essential-minimum">
                Minimum stock
                <input
                  id="essential-minimum"
                  min="0.001"
                  onChange={(event) =>
                    setMinimumStock(Number(event.target.value))
                  }
                  required
                  step="0.001"
                  type="number"
                  value={minimumStock}
                />
              </label>
              <label>
                Unit
                <input readOnly value={editing?.unit ?? selected?.unit ?? ''} />
              </label>
            </div>
            <label className="essentials-checkbox">
              <input
                checked={autoAdd}
                onChange={(event) => setAutoAdd(event.target.checked)}
                type="checkbox"
              />{' '}
              Auto-add this item to Shopping List
            </label>
            <button
              className="primary-button dialog-submit"
              disabled={saving}
              type="submit"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add Essential'}
            </button>
          </form>
        )}
      </dialog>
    </div>
  );
}
