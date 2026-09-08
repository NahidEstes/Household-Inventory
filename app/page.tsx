'use client';

import {
  Bell,
  Box,
  CalendarClock,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Home,
  Moon,
  PackagePlus,
  Pencil,
  Search,
  Settings,
  ShoppingBasket,
  Sun,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Section =
  | 'Dashboard'
  | 'Inventory'
  | 'Shopping list'
  | 'Expenses'
  | 'Expiry'
  | 'Reports'
  | 'Settings';
type InventoryItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  expiryDate: string | null;
  createdAt: string;
};
type Expense = {
  id: number;
  amount: number;
  category: string;
  note: string | null;
  spentAt: string;
  createdAt: string;
};
type ShoppingItem = {
  id: number;
  name: string;
  completed: boolean;
  createdAt: string;
};
type HouseholdSettings = {
  id: number;
  householdName: string;
  monthlyBudget: number;
};
type DeleteTarget = {
  kind: 'inventory' | 'expense' | 'shopping';
  id: number;
  name: string;
} | null;

const navItems = [
  { label: 'Dashboard' as Section, icon: Home },
  { label: 'Inventory' as Section, icon: Box },
  { label: 'Shopping list' as Section, icon: ClipboardList },
  { label: 'Expenses' as Section, icon: WalletCards },
  { label: 'Expiry' as Section, icon: CalendarClock },
  { label: 'Reports' as Section, icon: ChartNoAxesCombined },
];

const categoryIcons: Record<string, string> = {
  'Dairy & eggs': '🥛',
  Vegetables: '🥬',
  Pantry: '🌾',
  Household: '🧴',
  Frozen: '❄️',
  Other: '📦',
};

const sectionCopy: Record<
  Section,
  { eyebrow: string; title: string; subtitle: string }
> = {
  Dashboard: {
    eyebrow: 'HOUSEHOLD OVERVIEW',
    title: 'Good morning',
    subtitle: 'Everything that needs your attention, in one place.',
  },
  Inventory: {
    eyebrow: 'STOCK CONTROL',
    title: 'Inventory',
    subtitle: 'Track quantities, locations and expiry dates.',
  },
  'Shopping list': {
    eyebrow: 'NEXT SHOP',
    title: 'Shopping list',
    subtitle: 'Keep the household list tidy and ready.',
  },
  Expenses: {
    eyebrow: 'MONEY TRACKER',
    title: 'Expenses',
    subtitle: 'Understand where your household budget goes.',
  },
  Expiry: {
    eyebrow: 'WASTE LESS',
    title: 'Expiry tracker',
    subtitle: 'Use food on time and reduce avoidable waste.',
  },
  Reports: {
    eyebrow: 'HOUSEHOLD INSIGHTS',
    title: 'Reports',
    subtitle: 'A clear view of spending and stock patterns.',
  },
  Settings: {
    eyebrow: 'PREFERENCES',
    title: 'Settings',
    subtitle: 'Personalise your household workspace.',
  },
};

export default function HomeInventory() {
  const [dark, setDark] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('Dashboard');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [settings, setSettings] = useState<HouseholdSettings>({
    id: 1,
    householdName: 'My Household',
    monthlyBudget: 30000,
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all(
        [
          '/api/inventory',
          '/api/expenses',
          '/api/shopping',
          '/api/settings',
        ].map((url) => fetch(url)),
      );
      if (responses.some((response) => !response.ok))
        throw new Error('Data request failed');
      const [inventoryData, expenseData, shoppingData, settingsData] =
        await Promise.all(responses.map((response) => response.json()));
      setInventory(inventoryData as InventoryItem[]);
      setExpenses(expenseData as Expense[]);
      setShopping(shoppingData as ShoppingItem[]);
      setSettings(settingsData as HouseholdSettings);
    } catch {
      setError('We could not load your household data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('home-inventory-theme');
    const nextDark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const frame = window.requestAnimationFrame(() => setDark(nextDark));
    document.documentElement.classList.toggle('dark', nextDark);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useEffect(() => {
    const context =
      typeof document === 'undefined' ? undefined : document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      context.registerTool(
        {
          name: 'get_household_summary',
          title: 'Get household summary',
          description:
            'Read the current inventory, shopping and expense totals shown in Homely.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: () => ({
            inventoryItems: inventory.length,
            shoppingItems: shopping.filter((item) => !item.completed).length,
            monthlySpend: expenses.reduce((sum, item) => sum + item.amount, 0),
            currency: 'SAR',
          }),
        },
        { signal: lifecycle.signal },
      ),
      context.registerTool(
        {
          name: 'start_inventory_item_creation',
          title: 'Add inventory item',
          description:
            'Open the same add-item form used in the visible Homely interface.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => {
            setEditingItem(null);
            setItemDialogOpen(true);
            return { status: 'ready', form: 'inventory-item' };
          },
        },
        { signal: lifecycle.signal },
      ),
    ];
    void Promise.all(tools.map((tool) => Promise.resolve(tool))).catch(
      () => undefined,
    );
    return () => lifecycle.abort();
  }, [expenses, inventory, shopping]);

  const spentTotal = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses],
  );
  const remainingBudget = Math.max(settings.monthlyBudget - spentTotal, 0);
  const categories = useMemo(
    () => [
      'All categories',
      ...Array.from(new Set(inventory.map((item) => item.category))),
    ],
    [inventory],
  );
  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const matchesQuery = `${item.name} ${item.category} ${item.location}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return (
          matchesQuery &&
          (categoryFilter === 'All categories' ||
            item.category === categoryFilter)
        );
      }),
    [categoryFilter, inventory, query],
  );
  const filteredExpenses = useMemo(
    () =>
      expenses.filter((item) =>
        `${item.category} ${item.note ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [expenses, query],
  );
  const expiryItems = useMemo(
    () =>
      inventory
        .filter((item) => item.expiryDate)
        .sort((a, b) =>
          String(a.expiryDate).localeCompare(String(b.expiryDate)),
        ),
    [inventory],
  );
  const expiringSoon = expiryItems.filter(
    (item) => daysUntil(item.expiryDate) <= 7,
  );
  const spendingByCategory = useMemo(
    () =>
      Object.entries(
        expenses.reduce<Record<string, number>>((totals, item) => {
          totals[item.category] = (totals[item.category] ?? 0) + item.amount;
          return totals;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    [expenses],
  );
  const inventoryByCategory = useMemo(
    () =>
      Object.entries(
        inventory.reduce<Record<string, number>>((totals, item) => {
          totals[item.category] = (totals[item.category] ?? 0) + 1;
          return totals;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    [inventory],
  );

  function switchSection(section: Section) {
    setActiveSection(section);
    setQuery('');
    setCategoryFilter('All categories');
  }

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    localStorage.setItem('home-inventory-theme', nextDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextDark);
  }

  function openNewItem() {
    setEditingItem(null);
    setItemDialogOpen(true);
  }

  function openEditItem(item: InventoryItem) {
    setEditingItem(item);
    setItemDialogOpen(true);
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }

  async function saveInventoryItem(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    if (editingItem) payload.id = String(editingItem.id);
    const response = await fetch('/api/inventory', {
      method: editingItem ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      return showNotice('Could not save the item. Please check the details.');
    const item = (await response.json()) as InventoryItem;
    setInventory((rows) =>
      editingItem
        ? rows.map((row) => (row.id === item.id ? item : row))
        : [item, ...rows],
    );
    setItemDialogOpen(false);
    showNotice(
      editingItem
        ? `${item.name} was updated.`
        : `${item.name} was added to inventory.`,
    );
  }

  async function saveExpense(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      return showNotice(
        'Could not save the expense. Please check the details.',
      );
    const expense = (await response.json()) as Expense;
    setExpenses((rows) => [expense, ...rows]);
    setExpenseDialogOpen(false);
    showNotice(`${sar(expense.amount)} expense saved.`);
  }

  async function addShoppingItem(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const rawName = new FormData(form).get('name');
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) return;
    const response = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) return showNotice('Could not add the shopping item.');
    const item = (await response.json()) as ShoppingItem;
    setShopping((rows) => [item, ...rows]);
    form.reset();
  }

  async function toggleShopping(item: ShoppingItem) {
    const completed = !item.completed;
    setShopping((rows) =>
      rows.map((row) => (row.id === item.id ? { ...row, completed } : row)),
    );
    const response = await fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, completed }),
    });
    if (!response.ok) {
      setShopping((rows) =>
        rows.map((row) => (row.id === item.id ? item : row)),
      );
      showNotice('Could not update the shopping item.');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const endpoint =
      deleteTarget.kind === 'inventory'
        ? 'inventory'
        : deleteTarget.kind === 'expense'
          ? 'expenses'
          : 'shopping';
    const response = await fetch(`/api/${endpoint}?id=${deleteTarget.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) return showNotice('Could not delete this record.');
    if (deleteTarget.kind === 'inventory')
      setInventory((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    if (deleteTarget.kind === 'expense')
      setExpenses((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    if (deleteTarget.kind === 'shopping')
      setShopping((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    showNotice(`${deleteTarget.name} was deleted.`);
    setDeleteTarget(null);
  }

  async function saveSettings(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return showNotice('Could not save your settings.');
    setSettings((await response.json()) as HouseholdSettings);
    showNotice('Household settings saved.');
  }

  const copy = sectionCopy[activeSection];
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => switchSection('Dashboard')}
          type="button"
        >
          <span className="brand-mark">
            <Home size={20} />
          </span>
          <span>Homely</span>
        </button>
        <nav aria-label="Primary navigation" className="nav-list">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              className={`nav-item ${activeSection === label ? 'active' : ''}`}
              key={label}
              onClick={() => switchSection(label)}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className={`nav-item ${activeSection === 'Settings' ? 'active' : ''}`}
            onClick={() => switchSection('Settings')}
            type="button"
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>
          <div className="profile-mini">
            <span className="avatar">NH</span>
            <span>
              <strong>Nahid Hasan</strong>
              <small>{settings.householdName}</small>
            </span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <label className="search-box" htmlFor="global-search">
            <Search size={18} />
            <input
              id="global-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${activeSection.toLowerCase()}...`}
              value={query}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <button
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="icon-button"
              onClick={toggleTheme}
              type="button"
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              aria-label="View expiry alerts"
              className="icon-button notification"
              onClick={() => switchSection('Expiry')}
              type="button"
            >
              <Bell size={19} />
              {expiringSoon.length > 0 && <span />}
            </button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1>
                {copy.title}
                {activeSection === 'Dashboard'
                  ? `, ${settings.householdName}`
                  : ''}
              </h1>
              <p>{copy.subtitle}</p>
            </div>
            <HeaderActions
              section={activeSection}
              onAddExpense={() => setExpenseDialogOpen(true)}
              onAddItem={openNewItem}
            />
          </div>
          {notice && (
            <div aria-live="polite" className="notice">
              <span>
                <Check size={16} />
                {notice}
              </span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={loadData} type="button">
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <LoadingState />
          ) : (
            <SectionContent
              activeSection={activeSection}
              categoryFilter={categoryFilter}
              categories={categories}
              expenses={filteredExpenses}
              expiryItems={expiryItems}
              inventory={filteredInventory}
              inventoryByCategory={inventoryByCategory}
              monthlyBudget={settings.monthlyBudget}
              onAddExpense={() => setExpenseDialogOpen(true)}
              onAddItem={openNewItem}
              onAddShopping={addShoppingItem}
              onDelete={setDeleteTarget}
              onEditItem={openEditItem}
              onFilterCategory={setCategoryFilter}
              onGo={switchSection}
              onSaveSettings={saveSettings}
              onToggleShopping={toggleShopping}
              remainingBudget={remainingBudget}
              settings={settings}
              shopping={shopping}
              spendingByCategory={spendingByCategory}
              spentTotal={spentTotal}
            />
          )}
        </div>
      </section>

      <nav aria-label="Mobile navigation" className="mobile-nav">
        {[...navItems, { label: 'Settings' as Section, icon: Settings }].map(
          ({ label, icon: Icon }) => (
            <button
              className={activeSection === label ? 'active' : ''}
              key={label}
              onClick={() => switchSection(label)}
              type="button"
            >
              <Icon size={18} />
              <span>{label === 'Shopping list' ? 'Shopping' : label}</span>
            </button>
          ),
        )}
      </nav>

      {itemDialogOpen && (
        <ItemDialog
          editingItem={editingItem}
          onClose={() => setItemDialogOpen(false)}
          onSubmit={saveInventoryItem}
        />
      )}
      {expenseDialogOpen && (
        <ExpenseDialog
          onClose={() => setExpenseDialogOpen(false)}
          onSubmit={saveExpense}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </main>
  );
}

function HeaderActions({
  section,
  onAddExpense,
  onAddItem,
}: {
  section: Section;
  onAddExpense: () => void;
  onAddItem: () => void;
}) {
  if (section === 'Inventory')
    return (
      <button className="primary-button" onClick={onAddItem} type="button">
        <PackagePlus size={18} /> Add item
      </button>
    );
  if (section === 'Expenses')
    return (
      <button className="primary-button" onClick={onAddExpense} type="button">
        <CircleDollarSign size={18} /> Add expense
      </button>
    );
  if (section !== 'Dashboard') return null;
  return (
    <div className="heading-actions">
      <button className="secondary-button" onClick={onAddExpense} type="button">
        <CircleDollarSign size={18} /> Add expense
      </button>
      <button className="primary-button" onClick={onAddItem} type="button">
        <PackagePlus size={18} /> Add item
      </button>
    </div>
  );
}

type SectionProps = {
  activeSection: Section;
  categoryFilter: string;
  categories: string[];
  expenses: Expense[];
  expiryItems: InventoryItem[];
  inventory: InventoryItem[];
  inventoryByCategory: [string, number][];
  monthlyBudget: number;
  onAddExpense: () => void;
  onAddItem: () => void;
  onAddShopping: (event: SyntheticEvent<HTMLFormElement>) => void;
  onDelete: (target: DeleteTarget) => void;
  onEditItem: (item: InventoryItem) => void;
  onFilterCategory: (value: string) => void;
  onGo: (section: Section) => void;
  onSaveSettings: (event: SyntheticEvent<HTMLFormElement>) => void;
  onToggleShopping: (item: ShoppingItem) => void;
  remainingBudget: number;
  settings: HouseholdSettings;
  shopping: ShoppingItem[];
  spendingByCategory: [string, number][];
  spentTotal: number;
};

function SectionContent(props: SectionProps) {
  if (props.activeSection === 'Inventory') return <InventoryView {...props} />;
  if (props.activeSection === 'Shopping list')
    return <ShoppingView {...props} />;
  if (props.activeSection === 'Expenses') return <ExpensesView {...props} />;
  if (props.activeSection === 'Expiry') return <ExpiryView {...props} />;
  if (props.activeSection === 'Reports') return <ReportsView {...props} />;
  if (props.activeSection === 'Settings') return <SettingsView {...props} />;
  return <DashboardView {...props} />;
}

function DashboardView(props: SectionProps) {
  const expiringSoon = props.expiryItems.filter(
    (item) => daysUntil(item.expiryDate) <= 7,
  );
  const summary = [
    {
      label: 'Spent this month',
      value: sar(props.spentTotal),
      note: `${Math.min((props.spentTotal / props.monthlyBudget) * 100, 100).toFixed(0)}% of budget`,
      icon: WalletCards,
      tone: 'green',
    },
    {
      label: 'Budget remaining',
      value: sar(props.remainingBudget),
      note: `Monthly budget ${sar(props.monthlyBudget)}`,
      icon: CircleDollarSign,
      tone: 'mint',
    },
    {
      label: 'Items in stock',
      value: String(props.inventory.length),
      note: `${new Set(props.inventory.map((item) => item.category)).size} categories`,
      icon: Box,
      tone: 'blue',
    },
    {
      label: 'Expiring soon',
      value: String(expiringSoon.length),
      note: 'Within the next 7 days',
      icon: CalendarClock,
      tone: 'coral',
    },
  ];
  return (
    <>
      <section aria-label="Household summary" className="summary-grid">
        {summary.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="summary-card" key={label}>
            <div className={`summary-icon ${tone}`}>
              <Icon size={20} />
            </div>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel spend-panel">
          <PanelHeading
            title="Monthly spending"
            subtitle="Expenses by category"
            action="View report"
            onAction={() => props.onGo('Reports')}
          />
          <div className="spending-total">
            <strong>{sar(props.spentTotal)}</strong>
            <span>{props.expenses.length} transactions</span>
          </div>
          <CategoryBars
            rows={props.spendingByCategory}
            emptyText="Add your first expense to see a breakdown."
          />
        </section>
        <aside className="panel">
          <PanelHeading
            title="Expiry alerts"
            subtitle="Use these items soon"
            icon={<CalendarClock size={21} />}
          />
          {expiringSoon.length ? (
            <div className="alert-list">
              {expiringSoon.slice(0, 3).map((item) => (
                <ExpiryRow item={item} key={item.id} />
              ))}
            </div>
          ) : (
            <MiniEmpty text="Nothing expires in the next 7 days." />
          )}
          <button
            className="full-button"
            onClick={() => props.onGo('Expiry')}
            type="button"
          >
            View expiry tracker
          </button>
        </aside>
        <section className="panel inventory-panel">
          <PanelHeading
            title="Recent inventory"
            subtitle="Latest items in your household"
            action="View inventory"
            onAction={() => props.onGo('Inventory')}
          />
          <InventoryTable
            compact
            items={props.inventory.slice(0, 5)}
            onDelete={props.onDelete}
            onEdit={props.onEditItem}
          />
        </section>
        <aside className="panel">
          <PanelHeading
            title="Shopping list"
            subtitle={`${props.shopping.filter((item) => !item.completed).length} items to buy`}
            icon={<ShoppingBasket size={21} />}
          />
          <ShoppingRows
            compact
            items={props.shopping.slice(0, 5)}
            onDelete={props.onDelete}
            onToggle={props.onToggleShopping}
          />
          <button
            className="full-button"
            onClick={() => props.onGo('Shopping list')}
            type="button"
          >
            Open shopping list
          </button>
        </aside>
      </div>
    </>
  );
}

function InventoryView(props: SectionProps) {
  return (
    <section className="panel page-panel">
      <div className="toolbar">
        <div>
          <strong>{props.inventory.length} items</strong>
          <span>Keep quantities and expiry details current.</span>
        </div>
        <label>
          Category
          <select
            onChange={(event) => props.onFilterCategory(event.target.value)}
            value={props.categoryFilter}
          >
            {props.categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
      </div>
      <InventoryTable
        items={props.inventory}
        onDelete={props.onDelete}
        onEdit={props.onEditItem}
      />
      <EmptyState
        action="Add first item"
        icon={<Box size={24} />}
        onAction={props.onAddItem}
        show={props.inventory.length === 0}
        text="Your inventory is empty. Add an item to start tracking stock."
        title="No items yet"
      />
    </section>
  );
}

function ShoppingView(props: SectionProps) {
  const completed = props.shopping.filter((item) => item.completed).length;
  return (
    <div className="two-column-view">
      <section className="panel page-panel">
        <PanelHeading
          title="Items to buy"
          subtitle={`${props.shopping.length - completed} remaining`}
        />
        <form className="inline-add" onSubmit={props.onAddShopping}>
          <label className="sr-only" htmlFor="shopping-name">
            Shopping item
          </label>
          <input
            id="shopping-name"
            name="name"
            placeholder="Add an item to the list..."
          />
          <button className="primary-button" type="submit">
            Add item
          </button>
        </form>
        <ShoppingRows
          items={props.shopping}
          onDelete={props.onDelete}
          onToggle={props.onToggleShopping}
        />
        <EmptyState
          icon={<ShoppingBasket size={24} />}
          show={props.shopping.length === 0}
          text="Add the things your household needs next."
          title="Your list is clear"
        />
      </section>
      <aside className="panel side-summary">
        <h2>List progress</h2>
        <div
          className="progress-ring"
          style={
            {
              '--progress': `${props.shopping.length ? (completed / props.shopping.length) * 100 : 0}%`,
            } as React.CSSProperties
          }
        >
          <strong>
            {props.shopping.length
              ? Math.round((completed / props.shopping.length) * 100)
              : 0}
            %
          </strong>
          <span>complete</span>
        </div>
        <dl>
          <div>
            <dt>To buy</dt>
            <dd>{props.shopping.length - completed}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{completed}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{props.shopping.length}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function ExpensesView(props: SectionProps) {
  return (
    <>
      <section className="summary-grid expense-summary">
        <SummaryCard
          label="Total spent"
          value={sar(props.spentTotal)}
          note="This month"
          icon={<WalletCards size={20} />}
        />
        <SummaryCard
          label="Budget left"
          value={sar(props.remainingBudget)}
          note={`of ${sar(props.monthlyBudget)}`}
          icon={<CircleDollarSign size={20} />}
        />
        <SummaryCard
          label="Transactions"
          value={String(props.expenses.length)}
          note="Recorded payments"
          icon={<ClipboardList size={20} />}
        />
      </section>
      <section className="panel page-panel">
        <PanelHeading
          title="Expense history"
          subtitle="All household payments"
        />
        <ExpenseTable expenses={props.expenses} onDelete={props.onDelete} />
        <EmptyState
          action="Add first expense"
          icon={<WalletCards size={24} />}
          onAction={props.onAddExpense}
          show={props.expenses.length === 0}
          text="Record a payment to begin tracking your monthly budget."
          title="No expenses yet"
        />
      </section>
    </>
  );
}

function ExpiryView(props: SectionProps) {
  const groups = [
    {
      title: 'Expired or today',
      tone: 'danger',
      items: props.expiryItems.filter(
        (item) => daysUntil(item.expiryDate) <= 0,
      ),
    },
    {
      title: 'Within 7 days',
      tone: 'warning',
      items: props.expiryItems.filter(
        (item) =>
          daysUntil(item.expiryDate) > 0 && daysUntil(item.expiryDate) <= 7,
      ),
    },
    {
      title: 'Later',
      tone: 'safe',
      items: props.expiryItems.filter((item) => daysUntil(item.expiryDate) > 7),
    },
  ];
  return (
    <div className="expiry-columns">
      {groups.map((group) => (
        <section
          className={`panel expiry-group ${group.tone}`}
          key={group.title}
        >
          <div className="group-title">
            <h2>{group.title}</h2>
            <span>{group.items.length}</span>
          </div>
          {group.items.length ? (
            <div className="expiry-card-list">
              {group.items.map((item) => (
                <ExpiryCard
                  item={item}
                  key={item.id}
                  onEdit={props.onEditItem}
                />
              ))}
            </div>
          ) : (
            <MiniEmpty text="No items in this group." />
          )}
        </section>
      ))}
    </div>
  );
}

function ReportsView(props: SectionProps) {
  const maxInventory = Math.max(
    ...props.inventoryByCategory.map((row) => row[1]),
    1,
  );
  return (
    <div className="reports-grid">
      <section className="panel report-card wide">
        <PanelHeading
          title="Spending by category"
          subtitle="Where your SAR is going"
        />
        <CategoryBars
          rows={props.spendingByCategory}
          emptyText="No expenses to report yet."
        />
      </section>
      <section className="panel report-card">
        <h2>Budget health</h2>
        <div className="budget-number">
          <strong>
            {Math.min(
              (props.spentTotal / props.monthlyBudget) * 100,
              100,
            ).toFixed(0)}
            %
          </strong>
          <span>used</span>
        </div>
        <div className="progress-track">
          <span
            style={{
              width: `${Math.min((props.spentTotal / props.monthlyBudget) * 100, 100)}%`,
            }}
          />
        </div>
        <dl>
          <div>
            <dt>Budget</dt>
            <dd>{sar(props.monthlyBudget)}</dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd>{sar(props.spentTotal)}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{sar(props.remainingBudget)}</dd>
          </div>
        </dl>
      </section>
      <section className="panel report-card">
        <h2>Inventory mix</h2>
        {props.inventoryByCategory.length ? (
          <div className="inventory-mix">
            {props.inventoryByCategory.map(([name, count]) => (
              <div key={name}>
                <span>
                  <i>{categoryIcons[name] ?? '📦'}</i>
                  {name}
                  <b>{count}</b>
                </span>
                <div>
                  <em style={{ width: `${(count / maxInventory) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MiniEmpty text="Add inventory items to see category insights." />
        )}
      </section>
    </div>
  );
}

function SettingsView(props: SectionProps) {
  return (
    <div className="settings-grid">
      <form className="panel settings-form" onSubmit={props.onSaveSettings}>
        <PanelHeading
          title="Household details"
          subtitle="Used across your dashboard and reports"
        />
        <label htmlFor="household-name">
          Household name
          <input
            defaultValue={props.settings.householdName}
            id="household-name"
            name="householdName"
            required
          />
        </label>
        <label htmlFor="monthly-budget">
          Monthly budget (SAR)
          <input
            defaultValue={props.settings.monthlyBudget}
            id="monthly-budget"
            min="1"
            name="monthlyBudget"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label htmlFor="currency">
          Currency
          <input disabled id="currency" value="SAR — Saudi Riyal" />
        </label>
        <button className="primary-button" type="submit">
          Save settings
        </button>
      </form>
      <section className="panel settings-form">
        <PanelHeading
          title="Appearance"
          subtitle="Theme is saved on this device"
        />
        <div className="theme-note">
          <Sun size={20} />
          <div>
            <strong>Light & dark mode</strong>
            <p>
              Use the moon or sun button in the top bar to switch themes
              instantly.
            </p>
          </div>
        </div>
        <div className="theme-preview-row">
          <div className="theme-preview light">
            <span />
            <b>Light</b>
          </div>
          <div className="theme-preview dark-preview">
            <span />
            <b>Dark</b>
          </div>
        </div>
      </section>
    </div>
  );
}

function PanelHeading({
  title,
  subtitle,
  action,
  onAction,
  icon,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action ? (
        <button className="text-button" onClick={onAction} type="button">
          {action}
          <ChevronRight size={16} />
        </button>
      ) : (
        icon
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="summary-card">
      <div className="summary-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function InventoryTable({
  items,
  onEdit,
  onDelete,
  compact = false,
}: {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (target: DeleteTarget) => void;
  compact?: boolean;
}) {
  if (!items.length)
    return compact ? <MiniEmpty text="No inventory items yet." /> : null;
  return (
    <div className="table-wrap">
      <table aria-label="Inventory items">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Location</th>
            <th>Expiry</th>
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = itemStatus(item);
            return (
              <tr key={item.id}>
                <td aria-label={`${item.name}, ${item.category}`}>
                  <span className="table-item">
                    <span aria-hidden="true" className="food-icon">
                      {categoryIcons[item.category] ?? '📦'}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.category}</small>
                    </span>
                  </span>
                </td>
                <td>
                  {item.quantity} {item.unit}
                </td>
                <td>{item.location}</td>
                <td>
                  {item.expiryDate ? dateLabel(item.expiryDate) : 'No expiry'}
                </td>
                <td>
                  <span className={`status ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      aria-label={`Edit ${item.name}`}
                      onClick={() => onEdit(item)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`Delete ${item.name}`}
                      onClick={() =>
                        onDelete({
                          kind: 'inventory',
                          id: item.id,
                          name: item.name,
                        })
                      }
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseTable({
  expenses,
  onDelete,
}: {
  expenses: Expense[];
  onDelete: (target: DeleteTarget) => void;
}) {
  if (!expenses.length) return null;
  return (
    <div className="table-wrap">
      <table aria-label="Expense history">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Note</th>
            <th>Amount</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td>{dateLabel(expense.spentAt)}</td>
              <td>
                <span className="category-pill">{expense.category}</span>
              </td>
              <td>{expense.note || '—'}</td>
              <td>
                <strong>{sar(expense.amount)}</strong>
              </td>
              <td>
                <div className="row-actions">
                  <button
                    aria-label={`Delete ${expense.category} expense`}
                    onClick={() =>
                      onDelete({
                        kind: 'expense',
                        id: expense.id,
                        name: `${expense.category} expense`,
                      })
                    }
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShoppingRows({
  items,
  onToggle,
  onDelete,
  compact = false,
}: {
  items: ShoppingItem[];
  onToggle: (item: ShoppingItem) => void;
  onDelete: (target: DeleteTarget) => void;
  compact?: boolean;
}) {
  if (!items.length)
    return compact ? <MiniEmpty text="Your shopping list is clear." /> : null;
  return (
    <div className={`shopping-rows ${compact ? 'compact' : ''}`}>
      {items.map((item) => (
        <div className={item.completed ? 'done' : ''} key={item.id}>
          <label htmlFor={`shopping-${item.id}`}>
            <input
              checked={item.completed}
              id={`shopping-${item.id}`}
              onChange={() => onToggle(item)}
              type="checkbox"
            />
            <span>{item.name}</span>
          </label>
          <button
            aria-label={`Delete ${item.name}`}
            onClick={() =>
              onDelete({ kind: 'shopping', id: item.id, name: item.name })
            }
            type="button"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ExpiryRow({ item }: { item: InventoryItem }) {
  const days = daysUntil(item.expiryDate);
  return (
    <div className="alert-item">
      <span className="food-icon">{categoryIcons[item.category] ?? '📦'}</span>
      <span>
        <strong>{item.name}</strong>
        <small>Expires {dateLabel(String(item.expiryDate))}</small>
      </span>
      <em>{daysText(days)}</em>
    </div>
  );
}

function ExpiryCard({
  item,
  onEdit,
}: {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
}) {
  const days = daysUntil(item.expiryDate);
  return (
    <article className="expiry-card">
      <span className="food-icon">{categoryIcons[item.category] ?? '📦'}</span>
      <div>
        <strong>{item.name}</strong>
        <small>
          {item.quantity} {item.unit} · {item.location}
        </small>
        <p>{dateLabel(String(item.expiryDate))}</p>
      </div>
      <div>
        <em>{daysText(days)}</em>
        <button onClick={() => onEdit(item)} type="button">
          Edit
        </button>
      </div>
    </article>
  );
}

function CategoryBars({
  rows,
  emptyText,
}: {
  rows: [string, number][];
  emptyText: string;
}) {
  const max = Math.max(...rows.map((row) => row[1]), 1);
  if (!rows.length) return <MiniEmpty text={emptyText} />;
  return (
    <div className="category-bars">
      {rows.map(([name, amount]) => (
        <div key={name}>
          <span>
            <b>{name}</b>
            <strong>{sar(amount)}</strong>
          </span>
          <div>
            <i style={{ width: `${(amount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  show,
  icon,
  title,
  text,
  action,
  onAction,
}: {
  show: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="primary-button" onClick={onAction} type="button">
          {action}
        </button>
      )}
    </div>
  );
}

function MiniEmpty({ text }: { text: string }) {
  return <div className="mini-empty">{text}</div>;
}
function LoadingState() {
  return (
    <div className="loading-grid">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function ItemDialog({
  editingItem,
  onClose,
  onSubmit,
}: {
  editingItem: InventoryItem | null;
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="dialog-overlay">
      <dialog
        aria-labelledby="item-dialog-title"
        className="inventory-dialog"
        open
      >
        <button
          aria-label="Close item dialog"
          className="dialog-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
        <header className="dialog-header">
          <h2 id="item-dialog-title">
            {editingItem ? 'Edit inventory item' : 'Add inventory item'}
          </h2>
          <p>Record the quantity, location and expiry date.</p>
        </header>
        <form className="dialog-form" onSubmit={onSubmit}>
          <label htmlFor="item-name">
            Item name
            <input
              defaultValue={editingItem?.name}
              id="item-name"
              name="name"
              placeholder="e.g. Basmati rice"
              required
            />
          </label>
          <div className="form-grid">
            <label htmlFor="item-quantity">
              Quantity
              <input
                defaultValue={editingItem?.quantity}
                id="item-quantity"
                min="0.01"
                name="quantity"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label htmlFor="item-unit">
              Unit
              <select
                defaultValue={editingItem?.unit ?? 'kg'}
                id="item-unit"
                name="unit"
                required
              >
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="pcs">pcs</option>
                <option value="pack">pack</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label htmlFor="item-category">
              Category
              <select
                defaultValue={editingItem?.category ?? 'Pantry'}
                id="item-category"
                name="category"
                required
              >
                <option>Pantry</option>
                <option>Dairy & eggs</option>
                <option>Vegetables</option>
                <option>Frozen</option>
                <option>Household</option>
                <option>Other</option>
              </select>
            </label>
            <label htmlFor="item-location">
              Location
              <select
                defaultValue={editingItem?.location ?? 'Kitchen'}
                id="item-location"
                name="location"
                required
              >
                <option>Kitchen</option>
                <option>Fridge</option>
                <option>Freezer</option>
                <option>Storage</option>
                <option>Bathroom</option>
              </select>
            </label>
          </div>
          <label htmlFor="item-expiry">
            Expiry date <span>(optional)</span>
            <input
              defaultValue={editingItem?.expiryDate ?? ''}
              id="item-expiry"
              name="expiryDate"
              type="date"
            />
          </label>
          <button className="primary-button dialog-submit" type="submit">
            {editingItem ? 'Save changes' : 'Save item'}
          </button>
        </form>
      </dialog>
    </div>
  );
}

function ExpenseDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="dialog-overlay">
      <dialog
        aria-labelledby="expense-dialog-title"
        className="inventory-dialog"
        open
      >
        <button
          aria-label="Close expense dialog"
          className="dialog-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
        <header className="dialog-header">
          <h2 id="expense-dialog-title">Add expense</h2>
          <p>Record a household payment in SAR.</p>
        </header>
        <form className="dialog-form" onSubmit={onSubmit}>
          <label htmlFor="expense-amount">
            Amount (SAR)
            <input
              id="expense-amount"
              min="0.01"
              name="amount"
              placeholder="0.00"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label htmlFor="expense-category">
            Category
            <select id="expense-category" name="category" required>
              <option>Groceries</option>
              <option>Utilities</option>
              <option>Transport</option>
              <option>Healthcare</option>
              <option>Household</option>
              <option>Other</option>
            </select>
          </label>
          <label htmlFor="expense-date">
            Date
            <input
              defaultValue={today}
              id="expense-date"
              name="spentAt"
              required
              type="date"
            />
          </label>
          <label htmlFor="expense-note">
            Note <span>(optional)</span>
            <input
              id="expense-note"
              name="note"
              placeholder="What was this for?"
            />
          </label>
          <button className="primary-button dialog-submit" type="submit">
            Save expense
          </button>
        </form>
      </dialog>
    </div>
  );
}

function ConfirmDialog({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-overlay">
      <dialog aria-labelledby="confirm-title" className="confirm-dialog" open>
        <div className="danger-icon">
          <Trash2 size={20} />
        </div>
        <h2 id="confirm-title">Delete {name}?</h2>
        <p>This action cannot be undone.</p>
        <div>
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="danger-button" onClick={onConfirm} type="button">
            Delete
          </button>
        </div>
      </dialog>
    </div>
  );
}

function itemStatus(item: InventoryItem) {
  const days = daysUntil(item.expiryDate);
  if (item.expiryDate && days < 0)
    return { label: 'Expired', className: 'expired' };
  if (item.expiryDate && days <= 7)
    return { label: 'Expiring', className: 'expiring' };
  if (item.quantity <= 1) return { label: 'Low stock', className: 'low-stock' };
  return { label: 'In stock', className: 'in-stock' };
}

function daysUntil(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = new Date(`${value}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

function daysText(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function sar(value: number) {
  return `SAR ${value.toLocaleString('en-US', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
