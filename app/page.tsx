'use client';

import {
  AlertTriangle,
  Bell,
  Box,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  Check,
  Clock3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Home,
  Lightbulb,
  MapPin,
  Moon,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingBasket,
  Sun,
  Trash2,
  UtensilsCrossed,
  WalletCards,
  Warehouse,
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
  | 'Schedule'
  | 'Meal planner'
  | 'Purchases'
  | 'Inventory'
  | 'Storage'
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
  specificSpot: string | null;
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
type Purchase = {
  id: number;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  totalPrice: number;
  purchasedAt: string;
  expiryDate: string | null;
  store: string | null;
  location: string;
  inventoryItemId: number;
  expenseId: number;
  createdAt: string;
};
type ShoppingItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number | null;
  scheduledDate: string | null;
  completed: boolean;
  createdAt: string;
};
type MealIngredient = {
  id: number;
  mealId: number;
  name: string;
  quantity: number;
  unit: string;
  inventoryItemId: number | null;
  estimatedPrice: number | null;
  inventoryName: string | null;
  inStock: boolean;
};
type MealPlan = {
  id: number;
  name: string;
  plannedDate: string;
  plannedTime: string | null;
  notes: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  ingredients: MealIngredient[];
};
type MealPayload = Omit<MealPlan, 'id' | 'createdAt' | 'ingredients'> & {
  ingredients: Array<
    Pick<
      MealIngredient,
      'name' | 'quantity' | 'unit' | 'inventoryItemId' | 'estimatedPrice'
    >
  >;
};
type HouseholdSettings = {
  id: number;
  householdName: string;
  monthlyBudget: number;
};
type HouseholdTask = {
  id: number;
  title: string;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
};
type DeleteTarget = {
  kind: 'inventory' | 'expense' | 'shopping' | 'purchase' | 'meal' | 'task';
  id: number;
  name: string;
} | null;

const navItems = [
  { label: 'Dashboard' as Section, icon: Home },
  { label: 'Schedule' as Section, icon: CalendarRange },
  { label: 'Meal planner' as Section, icon: UtensilsCrossed },
  { label: 'Purchases' as Section, icon: PackagePlus },
  { label: 'Inventory' as Section, icon: Box },
  { label: 'Storage' as Section, icon: Warehouse },
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
  Schedule: {
    eyebrow: 'HOUSEHOLD CALENDAR',
    title: 'Schedule',
    subtitle: 'Meals, shopping, reminders and expiry dates in one view.',
  },
  'Meal planner': {
    eyebrow: 'MEAL PLANNER',
    title: 'Weekly meal schedule',
    subtitle: 'Plan meals and make the most of what you already have.',
  },
  Purchases: {
    eyebrow: 'PURCHASE INTAKE',
    title: 'Purchases',
    subtitle: 'Add stock, spending and expiry details in one step.',
  },
  Inventory: {
    eyebrow: 'STOCK CONTROL',
    title: 'Inventory',
    subtitle: 'Track quantities, locations and expiry dates.',
  },
  Storage: {
    eyebrow: 'STORAGE',
    title: 'Storage overview',
    subtitle: 'See where every household item is kept.',
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
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [tasks, setTasks] = useState<HouseholdTask[]>([]);
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
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [shoppingDialogOpen, setShoppingDialogOpen] = useState(false);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealPlan | null>(null);
  const [selectedMealDate, setSelectedMealDate] = useState(todayIso());
  const [mealWeekStart, setMealWeekStart] = useState(
    startOfWeekIso(todayIso()),
  );
  const [editingShopping, setEditingShopping] = useState<ShoppingItem | null>(
    null,
  );
  const [selectedShoppingDate, setSelectedShoppingDate] = useState(todayIso());
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
          '/api/purchases',
          '/api/shopping',
          '/api/meals',
          '/api/tasks',
          '/api/settings',
        ].map((url) => fetch(url)),
      );
      if (responses.some((response) => !response.ok))
        throw new Error('Data request failed');
      const [
        inventoryData,
        expenseData,
        purchaseData,
        shoppingData,
        mealData,
        taskData,
        settingsData,
      ] = await Promise.all(responses.map((response) => response.json()));
      setInventory(inventoryData as InventoryItem[]);
      setExpenses(expenseData as Expense[]);
      setPurchases(purchaseData as Purchase[]);
      setShopping(shoppingData as ShoppingItem[]);
      setMeals(mealData as MealPlan[]);
      setTasks(taskData as HouseholdTask[]);
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
            purchases: purchases.length,
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
      context.registerTool(
        {
          name: 'start_purchase_creation',
          title: 'Add purchase',
          description:
            'Open the purchase form that updates inventory, expenses and price history together.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => {
            setActiveSection('Purchases');
            setPurchaseDialogOpen(true);
            return { status: 'ready', form: 'purchase' };
          },
        },
        { signal: lifecycle.signal },
      ),
      context.registerTool(
        {
          name: 'start_shopping_schedule',
          title: 'Schedule shopping item',
          description:
            'Open the shopping schedule and its item form for a planned purchase.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => {
            setActiveSection('Shopping list');
            setSelectedShoppingDate(todayIso());
            setEditingShopping(null);
            setShoppingDialogOpen(true);
            return { status: 'ready', form: 'shopping-schedule' };
          },
        },
        { signal: lifecycle.signal },
      ),
    ];
    void Promise.all(tools.map((tool) => Promise.resolve(tool))).catch(
      () => undefined,
    );
    return () => lifecycle.abort();
  }, [expenses, inventory, meals, purchases, shopping]);

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
        const matchesQuery =
          `${item.name} ${item.category} ${item.location} ${item.specificSpot ?? ''}`
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
  const filteredPurchases = useMemo(
    () =>
      purchases.filter((item) =>
        `${item.itemName} ${item.category} ${item.store ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [purchases, query],
  );
  const filteredShopping = useMemo(
    () =>
      shopping.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, shopping],
  );
  const filteredMeals = useMemo(
    () =>
      meals.filter((meal) =>
        `${meal.name} ${meal.notes ?? ''} ${meal.ingredients.map((item) => item.name).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [meals, query],
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

  async function savePurchase(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      return showNotice(
        'Could not save the purchase. Please check the details.',
      );
    const result = (await response.json()) as {
      purchase: Purchase;
      inventoryItem: InventoryItem;
      expense: Expense;
    };
    setPurchases((rows) => [result.purchase, ...rows]);
    setInventory((rows) => [result.inventoryItem, ...rows]);
    setExpenses((rows) => [result.expense, ...rows]);
    setPurchaseDialogOpen(false);
    showNotice(
      `${result.purchase.itemName} saved to purchases, inventory and expenses.`,
    );
  }

  function openNewShoppingItem(date = selectedShoppingDate) {
    setSelectedShoppingDate(date);
    setEditingShopping(null);
    setShoppingDialogOpen(true);
  }

  function openEditShoppingItem(item: ShoppingItem) {
    setEditingShopping(item);
    setShoppingDialogOpen(true);
  }

  function openNewMeal(date = selectedMealDate) {
    setSelectedMealDate(date);
    setEditingMeal(null);
    setMealDialogOpen(true);
  }

  function openEditMeal(meal: MealPlan) {
    setSelectedMealDate(meal.plannedDate);
    setEditingMeal(meal);
    setMealDialogOpen(true);
  }

  async function saveMeal(payload: MealPayload) {
    const response = await fetch('/api/meals', {
      method: editingMeal ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        editingMeal ? { ...payload, id: editingMeal.id } : payload,
      ),
    });
    if (!response.ok) return showNotice('Could not save the meal.');
    await loadData();
    setMealDialogOpen(false);
    setEditingMeal(null);
    showNotice(editingMeal ? 'Meal updated.' : 'Meal added to your week.');
  }

  async function generateMealShoppingList() {
    const response = await fetch('/api/meals/shopping-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStart: mealWeekStart,
        weekEnd: addDaysIso(mealWeekStart, 6),
      }),
    });
    if (!response.ok)
      return showNotice('Could not generate the shopping list.');
    const result = (await response.json()) as { createdCount: number };
    await loadData();
    setActiveSection('Shopping list');
    showNotice(
      result.createdCount
        ? `${result.createdCount} missing ingredients added to Shopping list.`
        : 'Your shopping list is already up to date.',
    );
  }

  async function saveTask(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return showNotice('Could not save the reminder.');
    const task = (await response.json()) as HouseholdTask;
    setTasks((rows) => [...rows, task].sort(compareTasks));
    setTaskDialogOpen(false);
    showNotice('Reminder added.');
  }

  async function toggleTask(task: HouseholdTask) {
    const completed = !task.completed;
    setTasks((rows) =>
      rows.map((row) => (row.id === task.id ? { ...row, completed } : row)),
    );
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, completed }),
    });
    if (!response.ok) {
      setTasks((rows) => rows.map((row) => (row.id === task.id ? task : row)));
      showNotice('Could not update the reminder.');
    }
  }

  async function saveShoppingItem(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    if (editingShopping) payload.id = String(editingShopping.id);
    const response = await fetch('/api/shopping', {
      method: editingShopping ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return showNotice('Could not save the scheduled item.');
    const item = (await response.json()) as ShoppingItem;
    setShopping((rows) =>
      (editingShopping
        ? rows.map((row) => (row.id === item.id ? item : row))
        : [...rows, item]
      ).sort(compareShopping),
    );
    setShoppingDialogOpen(false);
    setEditingShopping(null);
    showNotice(
      editingShopping
        ? `${item.name} was rescheduled.`
        : `${item.name} was added to the shopping schedule.`,
    );
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
        : deleteTarget.kind === 'purchase'
          ? 'purchases'
          : deleteTarget.kind === 'expense'
            ? 'expenses'
            : deleteTarget.kind === 'meal'
              ? 'meals'
              : deleteTarget.kind === 'task'
                ? 'tasks'
                : 'shopping';
    const response = await fetch(`/api/${endpoint}?id=${deleteTarget.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) return showNotice('Could not delete this record.');
    const deleted = (await response.json()) as {
      inventoryItemId?: number;
      expenseId?: number;
    };
    if (deleteTarget.kind === 'inventory')
      setInventory((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    if (deleteTarget.kind === 'expense')
      setExpenses((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    if (deleteTarget.kind === 'shopping')
      setShopping((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    if (deleteTarget.kind === 'meal')
      setMeals((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    if (deleteTarget.kind === 'task')
      setTasks((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    if (deleteTarget.kind === 'purchase') {
      setPurchases((rows) => rows.filter((row) => row.id !== deleteTarget.id));
      setInventory((rows) =>
        rows.filter((row) => row.id !== deleted.inventoryItemId),
      );
      setExpenses((rows) => rows.filter((row) => row.id !== deleted.expenseId));
    }
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
              onAddPurchase={() => setPurchaseDialogOpen(true)}
              onScheduleShopping={() => openNewShoppingItem()}
              onAddMeal={() => openNewMeal()}
              onGenerateShopping={generateMealShoppingList}
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
              purchases={filteredPurchases}
              expiryItems={expiryItems}
              inventory={filteredInventory}
              meals={filteredMeals}
              tasks={tasks}
              inventoryByCategory={inventoryByCategory}
              monthlyBudget={settings.monthlyBudget}
              onAddExpense={() => setExpenseDialogOpen(true)}
              onAddItem={openNewItem}
              onAddPurchase={() => setPurchaseDialogOpen(true)}
              onEditShopping={openEditShoppingItem}
              onEditMeal={openEditMeal}
              onDelete={setDeleteTarget}
              onEditItem={openEditItem}
              onFilterCategory={setCategoryFilter}
              onGo={switchSection}
              onSaveSettings={saveSettings}
              onScheduleShopping={openNewShoppingItem}
              onAddMeal={openNewMeal}
              onAddTask={() => setTaskDialogOpen(true)}
              onGenerateShopping={generateMealShoppingList}
              onToggleShopping={toggleShopping}
              onToggleTask={toggleTask}
              remainingBudget={remainingBudget}
              settings={settings}
              shopping={filteredShopping}
              selectedShoppingDate={selectedShoppingDate}
              onSelectShoppingDate={setSelectedShoppingDate}
              spendingByCategory={spendingByCategory}
              spentTotal={spentTotal}
              mealWeekStart={mealWeekStart}
              onMealWeekChange={setMealWeekStart}
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
      {purchaseDialogOpen && (
        <PurchaseDialog
          onClose={() => setPurchaseDialogOpen(false)}
          onSubmit={savePurchase}
        />
      )}
      {shoppingDialogOpen && (
        <ShoppingScheduleDialog
          defaultDate={selectedShoppingDate}
          editingItem={editingShopping}
          onClose={() => {
            setShoppingDialogOpen(false);
            setEditingShopping(null);
          }}
          onSubmit={saveShoppingItem}
        />
      )}
      {mealDialogOpen && (
        <MealDialog
          defaultDate={selectedMealDate}
          editingMeal={editingMeal}
          inventory={inventory}
          onClose={() => {
            setMealDialogOpen(false);
            setEditingMeal(null);
          }}
          onSubmit={saveMeal}
        />
      )}
      {taskDialogOpen && (
        <TaskDialog
          onClose={() => setTaskDialogOpen(false)}
          onSubmit={saveTask}
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
  onAddMeal,
  onAddExpense,
  onAddItem,
  onAddPurchase,
  onScheduleShopping,
  onGenerateShopping,
}: {
  section: Section;
  onAddMeal: () => void;
  onAddExpense: () => void;
  onAddItem: () => void;
  onAddPurchase: () => void;
  onScheduleShopping: () => void;
  onGenerateShopping: () => void;
}) {
  if (section === 'Meal planner')
    return (
      <div className="heading-actions">
        <button className="secondary-button" onClick={onAddMeal} type="button">
          <UtensilsCrossed size={18} /> Add meal
        </button>
        <button
          className="primary-button"
          onClick={onGenerateShopping}
          type="button"
        >
          <ShoppingBasket size={18} /> Generate shopping list
        </button>
      </div>
    );
  if (section === 'Shopping list')
    return (
      <button
        className="primary-button"
        onClick={onScheduleShopping}
        type="button"
      >
        <CalendarDays size={18} /> Schedule item
      </button>
    );
  if (section === 'Purchases')
    return (
      <button className="primary-button" onClick={onAddPurchase} type="button">
        <PackagePlus size={18} /> Add purchase
      </button>
    );
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
      <button
        className="secondary-button"
        onClick={onAddPurchase}
        type="button"
      >
        <PackagePlus size={18} /> Add purchase
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
  purchases: Purchase[];
  expiryItems: InventoryItem[];
  inventory: InventoryItem[];
  meals: MealPlan[];
  tasks: HouseholdTask[];
  inventoryByCategory: [string, number][];
  monthlyBudget: number;
  onAddExpense: () => void;
  onAddItem: () => void;
  onAddPurchase: () => void;
  onAddMeal: (date?: string) => void;
  onAddTask: () => void;
  onDelete: (target: DeleteTarget) => void;
  onEditShopping: (item: ShoppingItem) => void;
  onEditMeal: (meal: MealPlan) => void;
  onEditItem: (item: InventoryItem) => void;
  onFilterCategory: (value: string) => void;
  onGo: (section: Section) => void;
  onSaveSettings: (event: SyntheticEvent<HTMLFormElement>) => void;
  onScheduleShopping: (date?: string) => void;
  onGenerateShopping: () => void;
  onSelectShoppingDate: (date: string) => void;
  onToggleShopping: (item: ShoppingItem) => void;
  onToggleTask: (task: HouseholdTask) => void;
  remainingBudget: number;
  settings: HouseholdSettings;
  shopping: ShoppingItem[];
  selectedShoppingDate: string;
  spendingByCategory: [string, number][];
  spentTotal: number;
  mealWeekStart: string;
  onMealWeekChange: (date: string) => void;
};

function SectionContent(props: SectionProps) {
  if (props.activeSection === 'Schedule') return <ScheduleView {...props} />;
  if (props.activeSection === 'Meal planner')
    return <MealPlannerView {...props} />;
  if (props.activeSection === 'Purchases') return <PurchasesView {...props} />;
  if (props.activeSection === 'Inventory') return <InventoryView {...props} />;
  if (props.activeSection === 'Storage') return <StorageView {...props} />;
  if (props.activeSection === 'Shopping list')
    return <ShoppingView {...props} />;
  if (props.activeSection === 'Expenses') return <ExpensesView {...props} />;
  if (props.activeSection === 'Expiry') return <ExpiryView {...props} />;
  if (props.activeSection === 'Reports') return <ReportsView {...props} />;
  if (props.activeSection === 'Settings') return <SettingsView {...props} />;
  return <DashboardView {...props} />;
}

type ScheduleKind = 'Meal' | 'Shopping' | 'Task' | 'Expiry';
type ScheduleEvent = {
  id: string;
  date: string;
  kind: ScheduleKind;
  title: string;
  detail: string;
  time: string | null;
  destination: Section;
};

function ScheduleView(props: SectionProps) {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [filter, setFilter] = useState<'All' | ScheduleKind>('All');
  const events = useMemo<ScheduleEvent[]>(
    () => [
      ...props.meals.map((meal) => ({
        id: `meal-${meal.id}`,
        date: meal.plannedDate,
        kind: 'Meal' as const,
        title: meal.name,
        detail: `${meal.ingredients.length} ingredients${meal.notes ? ` · ${meal.notes}` : ''}`,
        time: meal.plannedTime,
        destination: 'Meal planner' as const,
      })),
      ...props.shopping
        .filter((item) => item.scheduledDate && !item.completed)
        .map((item) => ({
          id: `shopping-${item.id}`,
          date: String(item.scheduledDate),
          kind: 'Shopping' as const,
          title: item.name,
          detail: `${item.quantity} ${item.unit}${item.estimatedPrice === null ? '' : ` · ${sar(item.estimatedPrice)}`}`,
          time: null,
          destination: 'Shopping list' as const,
        })),
      ...props.tasks
        .filter((task) => task.dueDate && !task.completed)
        .map((task) => ({
          id: `task-${task.id}`,
          date: String(task.dueDate),
          kind: 'Task' as const,
          title: task.title,
          detail: 'Household reminder',
          time: null,
          destination: 'Dashboard' as const,
        })),
      ...props.inventory
        .filter((item) => item.expiryDate)
        .map((item) => ({
          id: `expiry-${item.id}`,
          date: String(item.expiryDate),
          kind: 'Expiry' as const,
          title: item.name,
          detail: `${item.quantity} ${item.unit} · ${item.location}`,
          time: null,
          destination: 'Expiry' as const,
        })),
    ],
    [props.inventory, props.meals, props.shopping, props.tasks],
  );
  const visibleEvents = events.filter(
    (event) => filter === 'All' || event.kind === filter,
  );
  const active = new Date(selectedDate + 'T12:00:00');
  const year = active.getFullYear();
  const month = active.getMonth();
  const firstWeekday = new Date(year, month, 1, 12).getDay();
  const totalDays = new Date(year, month + 1, 0, 12).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
  const selectedEvents = visibleEvents
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  const upcoming = visibleEvents
    .filter((event) => event.date >= todayIso())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  function moveMonth(change: number) {
    setSelectedDate(localIso(new Date(year, month + change, 1, 12)));
  }

  return (
    <div className="unified-schedule-view">
      <section className="panel schedule-calendar-panel">
        <header className="schedule-calendar-header">
          <div>
            <CalendarRange size={21} />
            <span>
              <strong>
                {new Intl.DateTimeFormat('en-US', {
                  month: 'long',
                  year: 'numeric',
                }).format(active)}
              </strong>
              <small>{visibleEvents.length} scheduled events</small>
            </span>
          </div>
          <div>
            <button onClick={() => setSelectedDate(todayIso())} type="button">
              Today
            </button>
            <button
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>
        <div className="schedule-filters" aria-label="Schedule filters">
          {(['All', 'Meal', 'Shopping', 'Task', 'Expiry'] as const).map(
            (kind) => (
              <button
                className={filter === kind ? 'active' : ''}
                key={kind}
                onClick={() => setFilter(kind)}
                type="button"
              >
                {kind !== 'All' && (
                  <i className={`schedule-dot ${kind.toLowerCase()}`} />
                )}
                {kind}
              </button>
            ),
          )}
        </div>
        <div className="schedule-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="schedule-calendar-grid">
          {cells.map((day, index) => {
            if (!day)
              return (
                <span className="schedule-empty-cell" key={`empty-${index}`} />
              );
            const date = localIso(new Date(year, month, day, 12));
            const dayEvents = visibleEvents.filter(
              (event) => event.date === date,
            );
            const kinds = Array.from(
              new Set(dayEvents.map((event) => event.kind)),
            );
            return (
              <button
                className={`${selectedDate === date ? 'selected' : ''} ${date === todayIso() ? 'today' : ''}`}
                key={date}
                onClick={() => setSelectedDate(date)}
                type="button"
              >
                <span>{day}</span>
                <div>
                  {kinds.map((kind) => (
                    <i
                      className={`schedule-dot ${kind.toLowerCase()}`}
                      key={kind}
                    />
                  ))}
                </div>
                {dayEvents.length > 0 && <small>{dayEvents.length}</small>}
              </button>
            );
          })}
        </div>
      </section>
      <aside className="schedule-side-column">
        <section className="panel selected-day-panel">
          <PanelHeading
            title={
              selectedDate === todayIso()
                ? "Today's schedule"
                : dateLabel(selectedDate)
            }
            subtitle={`${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'}`}
          />
          <ScheduleEventList events={selectedEvents} onOpen={props.onGo} />
        </section>
        <section className="panel upcoming-schedule-panel">
          <PanelHeading title="Upcoming" subtitle="Next scheduled items" />
          <ScheduleEventList events={upcoming} onOpen={props.onGo} showDate />
        </section>
      </aside>
    </div>
  );
}

function ScheduleEventList({
  events,
  onOpen,
  showDate = false,
}: {
  events: ScheduleEvent[];
  onOpen: (section: Section) => void;
  showDate?: boolean;
}) {
  if (!events.length)
    return <MiniEmpty text="Nothing scheduled for this date." />;
  return (
    <div className="schedule-event-list">
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => onOpen(event.destination)}
          type="button"
        >
          <i className={`schedule-event-icon ${event.kind.toLowerCase()}`}>
            <ScheduleKindIcon kind={event.kind} />
          </i>
          <span>
            <strong>{event.title}</strong>
            <small>
              {showDate ? `${dayMonthShort(event.date)} · ` : ''}
              {event.time ? `${timeLabel(event.time)} · ` : ''}
              {event.detail}
            </small>
          </span>
          <em>{event.kind}</em>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}

function ScheduleKindIcon({ kind }: { kind: ScheduleKind }) {
  if (kind === 'Meal') return <UtensilsCrossed size={16} />;
  if (kind === 'Shopping') return <ShoppingBasket size={16} />;
  if (kind === 'Task') return <ClipboardList size={16} />;
  return <CalendarClock size={16} />;
}

function DashboardView(props: SectionProps) {
  const expiringSoon = props.expiryItems.filter(
    (item) =>
      daysUntil(item.expiryDate) >= 0 && daysUntil(item.expiryDate) <= 7,
  );
  const lowStock = props.inventory.filter((item) => item.quantity <= 1);
  const currentMonth = todayIso().slice(0, 7);
  const monthExpenses = props.expenses.filter((item) =>
    item.spentAt.startsWith(currentMonth),
  );
  const monthSpend = monthExpenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(props.monthlyBudget - monthSpend, 0);
  const monthCategories = Object.entries(
    monthExpenses.reduce<Record<string, number>>((totals, item) => {
      totals[item.category] = (totals[item.category] ?? 0) + item.amount;
      return totals;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const monthlyTrend = lastSixMonths().map(({ key, label }) => ({
    key,
    label,
    value: props.expenses
      .filter((item) => item.spentAt.startsWith(key))
      .reduce((sum, item) => sum + item.amount, 0),
  }));
  const todayMeals = props.meals
    .filter((meal) => meal.plannedDate === todayIso())
    .sort(compareMeals);
  const openShopping = props.shopping.filter((item) => !item.completed);
  const summary = [
    {
      label: 'Spent this month',
      value: sar(monthSpend),
      note: `${Math.min((monthSpend / props.monthlyBudget) * 100, 100).toFixed(0)}% of budget`,
      icon: WalletCards,
      tone: 'green',
    },
    {
      label: 'Budget remaining',
      value: sar(remaining),
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
    {
      label: 'Low stock items',
      value: String(lowStock.length),
      note: lowStock.length ? 'Need restocking' : 'Stock levels look good',
      icon: AlertTriangle,
      tone: 'amber',
    },
  ];
  return (
    <div className="dashboard-overview">
      <section
        aria-label="Household summary"
        className="summary-grid dashboard-summary-grid"
      >
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
      <div className="dashboard-analytics-grid">
        <section className="panel dashboard-chart-card">
          <PanelHeading
            title="Monthly spending"
            subtitle="Your household expense trend"
            action="View report"
            onAction={() => props.onGo('Reports')}
          />
          <MonthlySpendingChart rows={monthlyTrend} />
        </section>
        <section className="panel dashboard-donut-card">
          <PanelHeading
            title="Spending by category"
            subtitle="This month's expenses"
          />
          <SpendingDonut rows={monthCategories} total={monthSpend} />
        </section>
        <section className="panel dashboard-today-card">
          <PanelHeading
            title="Today's meal plan"
            subtitle={dateLabel(todayIso())}
            action="View plan"
            onAction={() => props.onGo('Meal planner')}
          />
          <div className="dashboard-meal-list">
            {todayMeals.length ? (
              todayMeals.map((meal) => <MealRow key={meal.id} meal={meal} />)
            ) : (
              <MiniEmpty text="No meals planned for today." />
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-middle-grid">
        <section className="panel dashboard-quick-actions">
          <PanelHeading title="Quick actions" subtitle="Common tasks" />
          <div>
            <button onClick={props.onAddItem} type="button">
              <PackagePlus size={18} /> Add item
            </button>
            <button onClick={props.onAddPurchase} type="button">
              <ReceiptText size={18} /> Purchase
            </button>
            <button onClick={props.onAddExpense} type="button">
              <WalletCards size={18} /> Expense
            </button>
            <button onClick={() => props.onAddMeal()} type="button">
              <UtensilsCrossed size={18} /> Meal
            </button>
          </div>
        </section>
        <section className="panel dashboard-alerts-card">
          <PanelHeading
            title="Expiry alerts"
            subtitle="Use these items soon"
            action="View all"
            onAction={() => props.onGo('Expiry')}
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
        </section>
        <section className="panel dashboard-tasks-card">
          <PanelHeading
            title="Tasks & reminders"
            subtitle="Keep your household on track"
          />
          <div className="dashboard-task-list">
            {props.tasks.length ? (
              props.tasks.slice(0, 5).map((task) => (
                <article
                  className={task.completed ? 'completed' : ''}
                  key={task.id}
                >
                  <label>
                    <input
                      checked={task.completed}
                      onChange={() => props.onToggleTask(task)}
                      type="checkbox"
                    />
                    <span>{task.title}</span>
                  </label>
                  <small>
                    {task.dueDate ? dayMonthShort(task.dueDate) : 'No date'}
                  </small>
                  <button
                    aria-label={`Delete ${task.title}`}
                    onClick={() =>
                      props.onDelete({
                        kind: 'task',
                        id: task.id,
                        name: task.title,
                      })
                    }
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))
            ) : (
              <MiniEmpty text="No tasks or reminders yet." />
            )}
          </div>
          <button
            className="full-button"
            onClick={props.onAddTask}
            type="button"
          >
            <Plus size={16} /> Add reminder
          </button>
        </section>
        <section className="panel dashboard-insights-card">
          <PanelHeading
            title="Household insights"
            subtitle="Live signals from your data"
            icon={<Lightbulb size={20} />}
          />
          <DashboardInsights
            expiring={expiringSoon.length}
            lowStock={lowStock.length}
            monthSpend={monthSpend}
            openShopping={openShopping.length}
            budget={props.monthlyBudget}
          />
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="panel inventory-panel dashboard-recent-inventory">
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
        <section className="panel dashboard-shopping-card">
          <PanelHeading
            title="Shopping list"
            subtitle={`${openShopping.length} items to buy`}
            action="Open list"
            onAction={() => props.onGo('Shopping list')}
          />
          <ShoppingRows
            compact
            items={openShopping.slice(0, 4)}
            onDelete={props.onDelete}
            onToggle={props.onToggleShopping}
          />
        </section>
        <section className="panel dashboard-purchases-card">
          <PanelHeading
            title="Recent purchases"
            subtitle="Latest household purchases"
            action="View all"
            onAction={() => props.onGo('Purchases')}
          />
          <RecentPurchases purchases={props.purchases.slice(0, 5)} />
        </section>
      </div>
    </div>
  );
}

function MonthlySpendingChart({
  rows,
}: {
  rows: Array<{ key: string; label: string; value: number }>;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="monthly-chart" aria-label="Monthly spending chart">
      {rows.map((row) => (
        <div className="monthly-bar-column" key={row.key}>
          <span>{row.value ? sar(row.value) : '—'}</span>
          <i
            style={{
              height: `${Math.max((row.value / max) * 100, row.value ? 8 : 2)}%`,
            }}
          />
          <small>{row.label}</small>
        </div>
      ))}
    </div>
  );
}

const donutColors = [
  '#34c18a',
  '#4f91dc',
  '#f0b94c',
  '#ef6f7c',
  '#8c78df',
  '#39b8bb',
];

function SpendingDonut({
  rows,
  total,
}: {
  rows: [string, number][];
  total: number;
}) {
  if (!rows.length)
    return <MiniEmpty text="Add an expense to see category spending." />;
  const stops = rows.reduce(
    (result, row, index) => {
      const next = result.cursor + (row[1] / total) * 100;
      return {
        cursor: next,
        values: [
          ...result.values,
          `${donutColors[index % donutColors.length]} ${result.cursor}% ${next}%`,
        ],
      };
    },
    { cursor: 0, values: [] as string[] },
  ).values;
  return (
    <div className="donut-layout">
      <div
        className="donut-chart"
        style={{ background: `conic-gradient(${stops.join(',')})` }}
      >
        <span>
          <strong>{sar(total)}</strong>
          <small>Total spent</small>
        </span>
      </div>
      <div className="donut-legend">
        {rows.slice(0, 6).map(([name, value], index) => (
          <div key={name}>
            <i
              style={{ background: donutColors[index % donutColors.length] }}
            />
            <span>{name}</span>
            <strong>{Math.round((value / total) * 100)}%</strong>
            <small>{sar(value)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardInsights({
  lowStock,
  expiring,
  monthSpend,
  budget,
  openShopping,
}: {
  lowStock: number;
  expiring: number;
  monthSpend: number;
  budget: number;
  openShopping: number;
}) {
  const budgetUsed = budget ? Math.round((monthSpend / budget) * 100) : 0;
  const insights = [
    {
      tone: 'warning',
      badge: lowStock ? 'LOW STOCK' : 'STOCK',
      title: lowStock
        ? `${lowStock} items are running low`
        : 'Stock levels look healthy',
      text: lowStock
        ? 'Consider restocking soon.'
        : 'No low-stock items need action.',
    },
    {
      tone: 'info',
      badge: 'EXPIRY',
      title: expiring
        ? `${expiring} items expire soon`
        : 'No urgent expiry alerts',
      text: expiring
        ? 'Plan to use these items this week.'
        : 'Nothing expires in the next 7 days.',
    },
    {
      tone: 'good',
      badge: 'BUDGET',
      title:
        budgetUsed <= 100
          ? `${budgetUsed}% of monthly budget used`
          : 'Monthly budget exceeded',
      text: `${openShopping} shopping items are still open.`,
    },
  ];
  return (
    <div className="insight-list">
      {insights.map((item) => (
        <article key={item.badge}>
          <em className={item.tone}>{item.badge}</em>
          <span>
            <strong>{item.title}</strong>
            <small>{item.text}</small>
          </span>
        </article>
      ))}
    </div>
  );
}

function RecentPurchases({ purchases }: { purchases: Purchase[] }) {
  if (!purchases.length) return <MiniEmpty text="No purchases recorded yet." />;
  return (
    <div className="recent-purchases-list">
      {purchases.map((purchase) => (
        <article key={purchase.id}>
          <span>
            <ReceiptText size={15} />
            <strong>{purchase.itemName}</strong>
          </span>
          <b>{sar(purchase.totalPrice)}</b>
          <small>{dayMonthShort(purchase.purchasedAt)}</small>
          <em>{purchase.store || 'Store not set'}</em>
        </article>
      ))}
    </div>
  );
}

function PurchasesView(props: SectionProps) {
  const purchaseTotal = props.purchases.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  const averagePurchase = props.purchases.length
    ? purchaseTotal / props.purchases.length
    : 0;
  const pricedItems = new Set(
    props.purchases.map((item) => item.itemName.toLowerCase()),
  ).size;
  return (
    <>
      <section className="summary-grid purchase-summary">
        <SummaryCard
          label="Purchase total"
          value={sar(purchaseTotal)}
          note={`${props.purchases.length} purchase records`}
          icon={<CircleDollarSign size={20} />}
        />
        <SummaryCard
          label="Average purchase"
          value={sar(averagePurchase)}
          note="Average transaction value"
          icon={<ShoppingBasket size={20} />}
        />
        <SummaryCard
          label="Tracked products"
          value={String(pricedItems)}
          note="With price history"
          icon={<ChartNoAxesCombined size={20} />}
        />
      </section>
      <section className="panel page-panel purchase-panel">
        <PanelHeading
          title="Purchase history"
          subtitle="Every purchase also creates inventory and expense records"
        />
        <PurchaseTable purchases={props.purchases} onDelete={props.onDelete} />
        <EmptyState
          action="Add first purchase"
          icon={<PackagePlus size={24} />}
          onAction={props.onAddPurchase}
          show={props.purchases.length === 0}
          text="Record a purchase to update stock, expenses and price history together."
          title="No purchases yet"
        />
      </section>
    </>
  );
}

function InventoryView(props: SectionProps) {
  return (
    <section className="panel page-panel">
      <div className="toolbar">
        <div>
          <strong>{props.inventory.length} items</strong>
          <span>
            Different expiry dates stay as separate batches; use the earliest
            first.
          </span>
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

const storageLocations = [
  'Fridge',
  'Freezer',
  'Pantry',
  'Drawer',
  'Cabinet',
  'Storage Box',
] as const;

function StorageView(props: SectionProps) {
  const [storageSearch, setStorageSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('All locations');
  const [storageCategory, setStorageCategory] = useState('All categories');
  const [statusFilter, setStatusFilter] = useState('All status');
  const availableLocations = [
    'All locations',
    ...Array.from(
      new Set([
        ...storageLocations,
        ...props.inventory.map((item) => item.location),
      ]),
    ),
  ];
  const availableCategories = [
    'All categories',
    ...Array.from(new Set(props.inventory.map((item) => item.category))),
  ];
  const filtered = props.inventory.filter((item) => {
    const status = itemStatus(item).label;
    const searchTarget =
      `${item.name} ${item.location} ${item.specificSpot ?? ''}`.toLowerCase();
    return (
      searchTarget.includes(storageSearch.toLowerCase()) &&
      (locationFilter === 'All locations' ||
        item.location === locationFilter) &&
      (storageCategory === 'All categories' ||
        item.category === storageCategory) &&
      (statusFilter === 'All status' || status === statusFilter)
    );
  });
  const breakdown = storageLocations.map((location) => ({
    location,
    count: props.inventory.filter((item) => item.location === location).length,
  }));
  const mostUsed = [...breakdown].sort((a, b) => b.count - a.count);
  const maxLocation = Math.max(...mostUsed.map((row) => row.count), 1);

  function clearFilters() {
    setStorageSearch('');
    setLocationFilter('All locations');
    setStorageCategory('All categories');
    setStatusFilter('All status');
  }

  return (
    <div className="storage-view">
      <div className="storage-toolbar">
        <label className="storage-search" htmlFor="storage-search">
          <Search size={17} />
          <input
            id="storage-search"
            onChange={(event) => setStorageSearch(event.target.value)}
            placeholder="Search items or locations..."
            value={storageSearch}
          />
        </label>
        <select
          aria-label="Filter by location"
          onChange={(event) => setLocationFilter(event.target.value)}
          value={locationFilter}
        >
          {availableLocations.map((location) => (
            <option key={location}>{location}</option>
          ))}
        </select>
        <select
          aria-label="Filter by category"
          onChange={(event) => setStorageCategory(event.target.value)}
          value={storageCategory}
        >
          {availableCategories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          onChange={(event) => setStatusFilter(event.target.value)}
          value={statusFilter}
        >
          {['All status', 'In stock', 'Low stock', 'Expiring', 'Expired'].map(
            (status) => (
              <option key={status}>{status}</option>
            ),
          )}
        </select>
        <button
          className="secondary-button"
          onClick={clearFilters}
          type="button"
        >
          Clear filters
        </button>
      </div>
      <section
        aria-label="Storage locations summary"
        className="storage-summary-grid"
      >
        {storageLocations.map((location, index) => {
          const items = props.inventory.filter(
            (item) => item.location === location,
          );
          const attention = items.filter((item) => {
            const status = itemStatus(item).label;
            return (
              status === 'Expiring' ||
              status === 'Expired' ||
              status === 'Low stock'
            );
          }).length;
          return (
            <button
              className="storage-summary-card"
              key={location}
              onClick={() => setLocationFilter(location)}
              type="button"
            >
              <span className={`storage-location-icon tone-${index}`}>
                <MapPin size={20} />
              </span>
              <span>
                <small>{location}</small>
                <strong>
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </strong>
                <em>
                  {attention
                    ? `${attention} need attention`
                    : 'All items look good'}
                </em>
              </span>
            </button>
          );
        })}
      </section>
      <div className="storage-content-grid">
        <section className="panel storage-table-panel">
          <PanelHeading
            title="Items by location"
            subtitle={`${filtered.length} of ${props.inventory.length} inventory items`}
          />
          <StorageTable
            items={filtered}
            onDelete={props.onDelete}
            onEdit={props.onEditItem}
          />
        </section>
        <aside className="storage-side-column">
          <section className="panel locations-breakdown">
            <PanelHeading
              title="Locations breakdown"
              subtitle="Items count by storage location"
              icon={<Warehouse size={19} />}
            />
            <div>
              {breakdown.map((row, index) => (
                <button
                  key={row.location}
                  onClick={() => setLocationFilter(row.location)}
                  type="button"
                >
                  <span className={`storage-location-icon tone-${index}`}>
                    <MapPin size={16} />
                  </span>
                  <strong>{row.location}</strong>
                  <small>{row.count}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="panel most-used-locations">
            <PanelHeading
              title="Most used locations"
              subtitle="Locations with the most items"
            />
            <div>
              {mostUsed.map((row, index) => (
                <article key={row.location}>
                  <b>{index + 1}</b>
                  <span>
                    <strong>{row.location}</strong>
                    <i>
                      <em
                        style={{ width: `${(row.count / maxLocation) * 100}%` }}
                      />
                    </i>
                  </span>
                  <small>{row.count}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StorageTable({
  items,
  onEdit,
  onDelete,
}: {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (target: DeleteTarget) => void;
}) {
  if (!items.length)
    return <MiniEmpty text="No inventory items match these filters." />;
  return (
    <div className="table-wrap storage-table-wrap">
      <table aria-label="Storage items">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Location</th>
            <th>Specific spot</th>
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
                <td>{item.specificSpot || '—'}</td>
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

function MealPlannerView(props: SectionProps) {
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    addDaysIso(props.mealWeekStart, index),
  );
  const weekEnd = weekDates[6];
  const weekMeals = props.meals
    .filter(
      (meal) =>
        meal.plannedDate >= props.mealWeekStart && meal.plannedDate <= weekEnd,
    )
    .sort(compareMeals);
  const ingredients = weekMeals.flatMap((meal) => meal.ingredients);
  const missing = ingredients.filter((ingredient) => !ingredient.inStock);
  const stockCount = ingredients.length - missing.length;
  const stockPercent = ingredients.length
    ? Math.round((stockCount / ingredients.length) * 100)
    : 0;
  const todayMeals = props.meals.filter(
    (meal) => meal.plannedDate === todayIso(),
  );
  const upcoming = props.meals
    .filter((meal) => meal.plannedDate > todayIso())
    .sort(compareMeals)
    .slice(0, 4);
  const summary = [
    {
      label: 'Planned meals',
      value: String(weekMeals.length),
      note: 'Across this week',
      icon: UtensilsCrossed,
      tone: 'green',
    },
    {
      label: 'Ingredients needed',
      value: String(missing.length),
      note: 'Items to buy',
      icon: Box,
      tone: 'coral',
    },
    {
      label: 'Estimated cost',
      value: sar(
        missing.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0),
      ),
      note: 'Missing ingredients only',
      icon: WalletCards,
      tone: 'blue',
    },
    {
      label: 'Using from inventory',
      value: stockPercent + '%',
      note: `${stockCount} of ${ingredients.length} ingredients`,
      icon: Check,
      tone: 'mint',
    },
  ];

  return (
    <div className="meal-planner-view">
      <div className="meal-week-toolbar">
        <div className="week-navigator" aria-label="Meal plan week">
          <CalendarDays size={18} />
          <strong>{weekRangeLabel(props.mealWeekStart)}</strong>
          <button
            aria-label="Previous week"
            onClick={() =>
              props.onMealWeekChange(addDaysIso(props.mealWeekStart, -7))
            }
            type="button"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            aria-label="Next week"
            onClick={() =>
              props.onMealWeekChange(addDaysIso(props.mealWeekStart, 7))
            }
            type="button"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <section
        aria-label="Meal plan summary"
        className="summary-grid meal-summary-grid"
      >
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
      <section className="meal-week-grid" aria-label="Weekly meals">
        {weekDates.map((date) => {
          const dayMeals = weekMeals.filter(
            (meal) => meal.plannedDate === date,
          );
          return (
            <article
              className={`meal-day-card ${date === todayIso() ? 'today' : ''}`}
              key={date}
            >
              <header>
                <div>
                  <strong>{weekdayShort(date)}</strong>
                  <span>{dayMonthShort(date)}</span>
                </div>
                <button
                  aria-label={`Add meal on ${dateLabel(date)}`}
                  onClick={() => props.onAddMeal(date)}
                  type="button"
                >
                  +
                </button>
              </header>
              <div className="meal-day-list">
                {dayMeals.map((meal) => (
                  <MealTile
                    key={meal.id}
                    meal={meal}
                    onDelete={props.onDelete}
                    onEdit={props.onEditMeal}
                  />
                ))}
                {!dayMeals.length && (
                  <button
                    className="empty-meal-day"
                    onClick={() => props.onAddMeal(date)}
                    type="button"
                  >
                    <UtensilsCrossed size={20} />
                    <span>Add a meal</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
      <div className="meal-details-grid">
        <section className="panel meal-today-card">
          <PanelHeading
            title="Today's meals"
            subtitle={dateLabel(todayIso())}
          />
          <div className="compact-meal-list">
            {todayMeals.length ? (
              todayMeals.map((meal) => <MealRow key={meal.id} meal={meal} />)
            ) : (
              <MiniEmpty text="No meals planned for today." />
            )}
          </div>
        </section>
        <section className="panel upcoming-meals-card">
          <PanelHeading title="Upcoming meals" subtitle="Next on your plan" />
          <div className="compact-meal-list">
            {upcoming.length ? (
              upcoming.map((meal) => (
                <MealRow key={meal.id} meal={meal} showDate />
              ))
            ) : (
              <MiniEmpty text="No upcoming meals yet." />
            )}
          </div>
        </section>
        <section className="panel meal-quick-actions">
          <PanelHeading
            title="Quick actions"
            subtitle="Keep your plan moving"
          />
          <button onClick={props.onGenerateShopping} type="button">
            <ShoppingBasket size={20} />
            <span>
              <strong>Generate shopping list</strong>
              <small>From missing ingredients</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button onClick={() => props.onAddMeal()} type="button">
            <UtensilsCrossed size={20} />
            <span>
              <strong>Add another meal</strong>
              <small>Plan any day this week</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button onClick={() => props.onGo('Inventory')} type="button">
            <Box size={20} />
            <span>
              <strong>Review inventory</strong>
              <small>Check available ingredients</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </section>
      </div>
    </div>
  );
}

function MealTile({
  meal,
  onEdit,
  onDelete,
}: {
  meal: MealPlan;
  onEdit: (meal: MealPlan) => void;
  onDelete: (target: DeleteTarget) => void;
}) {
  const ready =
    meal.ingredients.length > 0 &&
    meal.ingredients.every((item) => item.inStock);
  return (
    <div className="meal-tile">
      <MealThumb meal={meal} />
      <strong>{meal.name}</strong>
      {meal.plannedTime && (
        <small>
          <Clock3 size={13} /> {timeLabel(meal.plannedTime)}
        </small>
      )}
      <span className={`meal-stock ${ready ? 'ready' : 'missing'}`}>
        <Check size={13} />
        {ready ? 'In stock' : 'Need to buy'}
      </span>
      <div className="meal-tile-actions">
        <button
          aria-label={`Edit ${meal.name}`}
          onClick={() => onEdit(meal)}
          type="button"
        >
          <Pencil size={14} />
        </button>
        <button
          aria-label={`Delete ${meal.name}`}
          onClick={() =>
            onDelete({ kind: 'meal', id: meal.id, name: meal.name })
          }
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function MealRow({
  meal,
  showDate = false,
}: {
  meal: MealPlan;
  showDate?: boolean;
}) {
  const ready =
    meal.ingredients.length > 0 &&
    meal.ingredients.every((item) => item.inStock);
  return (
    <article className="meal-row">
      <MealThumb meal={meal} />
      <span>
        <strong>{meal.name}</strong>
        <small>
          {showDate
            ? dayMonthShort(meal.plannedDate) + (meal.plannedTime ? ' · ' : '')
            : ''}
          {meal.plannedTime ? timeLabel(meal.plannedTime) : ''}
        </small>
      </span>
      <em className={ready ? 'ready' : 'missing'}>
        {ready ? 'In stock' : 'Need to buy'}
      </em>
    </article>
  );
}

function MealThumb({ meal }: { meal: MealPlan }) {
  return meal.thumbnailUrl ? (
    // oxlint-disable-next-line next/no-img-element -- user-provided external thumbnails are not known at build time
    <img alt="" className="meal-thumb" src={meal.thumbnailUrl} />
  ) : (
    <span className="meal-thumb meal-thumb-placeholder">
      <UtensilsCrossed size={20} />
    </span>
  );
}

function ShoppingView(props: SectionProps) {
  const completed = props.shopping.filter((item) => item.completed).length;
  const today = todayIso();
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    addDaysIso(today, index),
  );
  const openItems = props.shopping
    .filter((item) => !item.completed)
    .sort(compareShopping);
  const groupedItems = openItems.reduce<Record<string, ShoppingItem[]>>(
    (groups, item) => {
      const key = item.scheduledDate || 'Unscheduled';
      (groups[key] ??= []).push(item);
      return groups;
    },
    {},
  );
  const weekEnd = addDaysIso(today, 6);
  const thisWeek = openItems.filter(
    (item) =>
      item.scheduledDate &&
      item.scheduledDate >= today &&
      item.scheduledDate <= weekEnd,
  );
  const estimatedTotal = thisWeek.reduce(
    (sum, item) => sum + (item.estimatedPrice ?? 0),
    0,
  );
  const typicalWeek = props.monthlyBudget / 4.33;
  const progress = Math.min((estimatedTotal / typicalWeek) * 100, 100);

  return (
    <div className="shopping-schedule-view">
      <section className="shopping-schedule-main">
        <div className="week-strip panel" aria-label="Upcoming seven days">
          {weekDates.map((date) => (
            <button
              className={props.selectedShoppingDate === date ? 'active' : ''}
              key={date}
              onClick={() => props.onSelectShoppingDate(date)}
              type="button"
            >
              <span>{weekdayShort(date)}</span>
              <strong>{dayMonthShort(date)}</strong>
              {openItems.some((item) => item.scheduledDate === date) && <i />}
            </button>
          ))}
        </div>
        <div className="schedule-groups">
          {Object.entries(groupedItems).map(([date, items], index) => (
            <section
              className={
                'panel schedule-group tone-' +
                (index % 3) +
                (props.selectedShoppingDate === date ? ' selected' : '')
              }
              key={date}
            >
              <header>
                <span>
                  <CalendarDays size={20} />
                  <strong>{shoppingGroupLabel(date)}</strong>
                </span>
                <small>
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </small>
              </header>
              <div>
                {items.map((item) => (
                  <article className="scheduled-item" key={item.id}>
                    <label
                      aria-label={'Mark ' + item.name + ' as purchased'}
                      htmlFor={'scheduled-' + item.id}
                    >
                      <input
                        checked={item.completed}
                        id={'scheduled-' + item.id}
                        onChange={() => props.onToggleShopping(item)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.quantity} {item.unit}
                        </small>
                      </span>
                    </label>
                    <strong className="scheduled-price">
                      {item.estimatedPrice === null
                        ? 'Price not set'
                        : sar(item.estimatedPrice)}
                    </strong>
                    <div className="scheduled-actions">
                      <button
                        onClick={() => props.onEditShopping(item)}
                        type="button"
                      >
                        <CalendarClock size={15} /> Reschedule
                      </button>
                      <button
                        aria-label={'Delete ' + item.name}
                        onClick={() =>
                          props.onDelete({
                            kind: 'shopping',
                            id: item.id,
                            name: item.name,
                          })
                        }
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
        <EmptyState
          action="Schedule first item"
          icon={<ShoppingBasket size={24} />}
          onAction={() => props.onScheduleShopping(props.selectedShoppingDate)}
          show={props.shopping.length === 0}
          text="Choose a day and plan what your household needs."
          title="Nothing scheduled yet"
        />
      </section>
      <aside className="shopping-schedule-aside">
        <section className="panel week-summary-card">
          <PanelHeading
            title="This week"
            subtitle={thisWeek.length + ' items planned'}
            icon={<ChartNoAxesCombined size={20} />}
          />
          <span>Estimated total</span>
          <strong>{sar(estimatedTotal)}</strong>
          <div className="progress-track">
            <i style={{ width: progress + '%' }} />
          </div>
          <small>
            {progress.toFixed(0)}% of your typical weekly budget ·{' '}
            {sar(typicalWeek)}
          </small>
          <dl>
            <div>
              <dt>To buy</dt>
              <dd>{openItems.length}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{completed}</dd>
            </div>
          </dl>
        </section>
        <ShoppingCalendar
          items={openItems}
          onSelect={props.onSelectShoppingDate}
          selectedDate={props.selectedShoppingDate}
        />
      </aside>
    </div>
  );
}

function ShoppingCalendar({
  items,
  selectedDate,
  onSelect,
}: {
  items: ShoppingItem[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const active = new Date(selectedDate + 'T12:00:00');
  const year = active.getFullYear();
  const month = active.getMonth();
  const firstWeekday = new Date(year, month, 1, 12).getDay();
  const totalDays = new Date(year, month + 1, 0, 12).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  function moveMonth(change: number) {
    onSelect(localIso(new Date(year, month + change, 1, 12)));
  }

  return (
    <section className="panel shopping-calendar">
      <header>
        <span>
          <CalendarDays size={19} />
          <strong>
            {new Intl.DateTimeFormat('en-US', {
              month: 'long',
              year: 'numeric',
            }).format(active)}
          </strong>
        </span>
        <span>
          <button
            aria-label="Previous month"
            onClick={() => moveMonth(-1)}
            type="button"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            aria-label="Next month"
            onClick={() => moveMonth(1)}
            type="button"
          >
            <ChevronRight size={17} />
          </button>
        </span>
      </header>
      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {cells.map((day, index) => {
          if (!day) return <span key={'empty-' + index} />;
          const date = localIso(new Date(year, month, day, 12));
          return (
            <button
              aria-label={dateLabel(date)}
              className={[
                selectedDate === date ? 'selected' : '',
                items.some((item) => item.scheduledDate === date)
                  ? 'scheduled'
                  : '',
              ].join(' ')}
              key={date}
              onClick={() => onSelect(date)}
              type="button"
            >
              {day}
            </button>
          );
        })}
      </div>
      <footer>
        <span>
          <i /> Selected date
        </span>
        <span>
          <i /> Scheduled shopping
        </span>
      </footer>
    </section>
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
  const latestPrices = props.purchases
    .filter(
      (purchase, index, rows) =>
        rows.findIndex(
          (item) =>
            item.itemName.toLowerCase() === purchase.itemName.toLowerCase() &&
            item.unit === purchase.unit,
        ) === index,
    )
    .slice(0, 6);
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
      <section className="panel report-card wide">
        <PanelHeading
          title="Latest product prices"
          subtitle="Current unit prices and movement from the previous purchase"
        />
        {latestPrices.length ? (
          <div className="price-insights">
            {latestPrices.map((purchase) => {
              const currentIndex = props.purchases.findIndex(
                (item) => item.id === purchase.id,
              );
              const previous = props.purchases
                .slice(currentIndex + 1)
                .find(
                  (item) =>
                    item.itemName.toLowerCase() ===
                      purchase.itemName.toLowerCase() &&
                    item.unit === purchase.unit,
                );
              const unitPrice = purchase.totalPrice / purchase.quantity;
              const previousPrice = previous
                ? previous.totalPrice / previous.quantity
                : null;
              const difference = previousPrice
                ? ((unitPrice - previousPrice) / previousPrice) * 100
                : null;
              return (
                <article key={purchase.id}>
                  <span className="food-icon">
                    {categoryIcons[purchase.category] ?? '📦'}
                  </span>
                  <div>
                    <strong>{purchase.itemName}</strong>
                    <small>
                      per {purchase.unit} · {purchase.store || 'Store not set'}
                    </small>
                  </div>
                  <div>
                    <strong>{sar(unitPrice)}</strong>
                    <small
                      className={`price-change ${difference && difference > 0 ? 'up' : difference && difference < 0 ? 'down' : ''}`}
                    >
                      {difference === null
                        ? 'First recorded price'
                        : `${difference > 0 ? '+' : ''}${difference.toFixed(1)}% vs last`}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <MiniEmpty text="Add purchases to build product price history." />
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
  const batches = items.reduce<Record<string, InventoryItem[]>>(
    (groups, item) => {
      const key = `${item.name.toLowerCase()}|${item.unit}`;
      (groups[key] ??= []).push(item);
      groups[key].sort((a, b) =>
        (a.expiryDate ?? '9999-12-31').localeCompare(
          b.expiryDate ?? '9999-12-31',
        ),
      );
      return groups;
    },
    {},
  );
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
            const batchGroup =
              batches[`${item.name.toLowerCase()}|${item.unit}`];
            const batchNumber =
              batchGroup.findIndex((batch) => batch.id === item.id) + 1;
            return (
              <tr key={item.id}>
                <td aria-label={`${item.name}, ${item.category}`}>
                  <span className="table-item">
                    <span aria-hidden="true" className="food-icon">
                      {categoryIcons[item.category] ?? '📦'}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.category}
                        {batchGroup.length > 1 && (
                          <em className="batch-label">
                            Batch {batchNumber} of {batchGroup.length}
                          </em>
                        )}
                      </small>
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

function PurchaseTable({
  purchases,
  onDelete,
}: {
  purchases: Purchase[];
  onDelete: (target: DeleteTarget) => void;
}) {
  if (!purchases.length) return null;
  return (
    <div className="table-wrap">
      <table aria-label="Purchase history">
        <thead>
          <tr>
            <th>Item</th>
            <th>Purchased</th>
            <th>Quantity</th>
            <th>Store</th>
            <th>Expiry</th>
            <th>Unit price</th>
            <th>Total</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase, index) => {
            const unitPrice = purchase.totalPrice / purchase.quantity;
            const previous = purchases
              .slice(index + 1)
              .find(
                (item) =>
                  item.itemName.toLowerCase() ===
                    purchase.itemName.toLowerCase() &&
                  item.unit === purchase.unit,
              );
            const previousUnitPrice = previous
              ? previous.totalPrice / previous.quantity
              : null;
            const priceDifference = previousUnitPrice
              ? ((unitPrice - previousUnitPrice) / previousUnitPrice) * 100
              : null;
            return (
              <tr key={purchase.id}>
                <td aria-label={`${purchase.itemName}, ${purchase.category}`}>
                  <span className="table-item">
                    <span aria-hidden="true" className="food-icon">
                      {categoryIcons[purchase.category] ?? '📦'}
                    </span>
                    <span>
                      <strong>{purchase.itemName}</strong>
                      <small>{purchase.category}</small>
                    </span>
                  </span>
                </td>
                <td>{dateLabel(purchase.purchasedAt)}</td>
                <td>
                  {purchase.quantity} {purchase.unit}
                </td>
                <td>{purchase.store || '—'}</td>
                <td>
                  {purchase.expiryDate
                    ? dateLabel(purchase.expiryDate)
                    : 'No expiry'}
                </td>
                <td>
                  <strong>{sar(unitPrice)}</strong>
                  {priceDifference !== null && (
                    <small
                      className={`price-change ${priceDifference > 0 ? 'up' : priceDifference < 0 ? 'down' : ''}`}
                    >
                      {priceDifference > 0 ? '+' : ''}
                      {priceDifference.toFixed(1)}% vs last
                    </small>
                  )}
                </td>
                <td>
                  <strong>{sar(purchase.totalPrice)}</strong>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      aria-label={`Delete ${purchase.itemName} purchase`}
                      onClick={() =>
                        onDelete({
                          kind: 'purchase',
                          id: purchase.id,
                          name: `${purchase.itemName} purchase`,
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
          <label
            aria-label={`Mark ${item.name} as purchased`}
            htmlFor={`shopping-${item.id}`}
          >
            <input
              checked={item.completed}
              id={`shopping-${item.id}`}
              onChange={() => onToggle(item)}
              type="checkbox"
            />
            <span className="shopping-row-copy">
              <strong>{item.name}</strong>
              <small>
                {item.quantity} {item.unit}
                {item.scheduledDate
                  ? ' · ' + dayMonthShort(item.scheduledDate)
                  : ' · Unscheduled'}
              </small>
            </span>
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

type IngredientDraft = {
  key: number;
  name: string;
  quantity: string;
  unit: string;
  inventoryItemId: string;
  estimatedPrice: string;
};

function TaskDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="dialog-overlay">
      <dialog
        aria-labelledby="task-dialog-title"
        className="inventory-dialog"
        open
      >
        <button
          aria-label="Close reminder dialog"
          className="dialog-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
        <header className="dialog-header">
          <h2 id="task-dialog-title">Add reminder</h2>
          <p>Keep a household task visible on your dashboard.</p>
        </header>
        <form className="dialog-form" onSubmit={onSubmit}>
          <label htmlFor="task-title">
            Task
            <input
              id="task-title"
              name="title"
              placeholder="e.g. Clean the fridge"
              required
            />
          </label>
          <label htmlFor="task-due-date">
            Due date <span>(optional)</span>
            <input id="task-due-date" name="dueDate" type="date" />
          </label>
          <button className="primary-button dialog-submit" type="submit">
            Add reminder
          </button>
        </form>
      </dialog>
    </div>
  );
}

function MealDialog({
  editingMeal,
  defaultDate,
  inventory,
  onClose,
  onSubmit,
}: {
  editingMeal: MealPlan | null;
  defaultDate: string;
  inventory: InventoryItem[];
  onClose: () => void;
  onSubmit: (payload: MealPayload) => void;
}) {
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    editingMeal?.ingredients.length
      ? editingMeal.ingredients.map((item) => ({
          key: item.id,
          name: item.name,
          quantity: String(item.quantity),
          unit: item.unit,
          inventoryItemId: item.inventoryItemId
            ? String(item.inventoryItemId)
            : '',
          estimatedPrice:
            item.estimatedPrice === null ? '' : String(item.estimatedPrice),
        }))
      : [blankIngredient()],
  );

  function updateIngredient(key: number, patch: Partial<IngredientDraft>) {
    setIngredients((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function linkInventory(row: IngredientDraft, value: string) {
    const item = inventory.find((stock) => String(stock.id) === value);
    updateIngredient(
      row.key,
      item
        ? { inventoryItemId: value, name: item.name, unit: item.unit }
        : { inventoryItemId: value },
    );
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    onSubmit({
      name: formText(fields.name),
      plannedDate: formText(fields.plannedDate),
      plannedTime: formText(fields.plannedTime) || null,
      notes: formText(fields.notes) || null,
      thumbnailUrl: formText(fields.thumbnailUrl) || null,
      ingredients: ingredients
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name,
          quantity: Number(item.quantity),
          unit: item.unit,
          inventoryItemId: item.inventoryItemId
            ? Number(item.inventoryItemId)
            : null,
          estimatedPrice: item.estimatedPrice
            ? Number(item.estimatedPrice)
            : null,
        })),
    });
  }

  return (
    <div className="dialog-overlay">
      <dialog
        aria-labelledby="meal-dialog-title"
        className="inventory-dialog meal-dialog"
        open
      >
        <button
          aria-label="Close meal dialog"
          className="dialog-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
        <header className="dialog-header">
          <h2 id="meal-dialog-title">
            {editingMeal ? 'Edit meal' : 'Add meal'}
          </h2>
          <p>Plan a meal and link its ingredients to your inventory.</p>
        </header>
        <form className="dialog-form" onSubmit={submit}>
          <label htmlFor="meal-name">
            Meal name
            <input
              defaultValue={editingMeal?.name}
              id="meal-name"
              name="name"
              placeholder="e.g. Chicken curry"
              required
            />
          </label>
          <div className="form-grid">
            <label htmlFor="meal-date">
              Date
              <input
                defaultValue={editingMeal?.plannedDate ?? defaultDate}
                id="meal-date"
                name="plannedDate"
                required
                type="date"
              />
            </label>
            <label htmlFor="meal-time">
              Time <span>(optional)</span>
              <input
                defaultValue={editingMeal?.plannedTime ?? ''}
                id="meal-time"
                name="plannedTime"
                type="time"
              />
            </label>
          </div>
          <label htmlFor="meal-thumbnail">
            Thumbnail URL <span>(optional)</span>
            <input
              defaultValue={editingMeal?.thumbnailUrl ?? ''}
              id="meal-thumbnail"
              name="thumbnailUrl"
              placeholder="https://..."
              type="url"
            />
          </label>
          <label htmlFor="meal-notes">
            Notes <span>(optional)</span>
            <textarea
              defaultValue={editingMeal?.notes ?? ''}
              id="meal-notes"
              name="notes"
              placeholder="Prep notes or serving ideas"
              rows={2}
            />
          </label>
          <div className="ingredient-builder">
            <div className="ingredient-builder-heading">
              <span>
                <strong>Ingredients</strong>
                <small>Link stock or mark what needs buying.</small>
              </span>
              <button
                className="secondary-button"
                onClick={() =>
                  setIngredients((rows) => [...rows, blankIngredient()])
                }
                type="button"
              >
                + Add ingredient
              </button>
            </div>
            {ingredients.map((row, index) => (
              <div className="ingredient-row" key={row.key}>
                <label>
                  Ingredient
                  <input
                    aria-label={`Ingredient ${index + 1} name`}
                    onChange={(event) =>
                      updateIngredient(row.key, { name: event.target.value })
                    }
                    placeholder="Ingredient name"
                    value={row.name}
                  />
                </label>
                <label>
                  Qty
                  <input
                    aria-label={`Ingredient ${index + 1} quantity`}
                    min="0.01"
                    onChange={(event) =>
                      updateIngredient(row.key, {
                        quantity: event.target.value,
                      })
                    }
                    required={Boolean(row.name)}
                    step="0.01"
                    type="number"
                    value={row.quantity}
                  />
                </label>
                <label>
                  Unit
                  <select
                    aria-label={`Ingredient ${index + 1} unit`}
                    onChange={(event) =>
                      updateIngredient(row.key, { unit: event.target.value })
                    }
                    value={row.unit}
                  >
                    {['pcs', 'pack', 'kg', 'g', 'L', 'ml'].map((unit) => (
                      <option key={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Inventory link
                  <select
                    aria-label={`Ingredient ${index + 1} inventory link`}
                    onChange={(event) => linkInventory(row, event.target.value)}
                    value={row.inventoryItemId}
                  >
                    <option value="">Not linked</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.quantity} {item.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Missing cost
                  <input
                    aria-label={`Ingredient ${index + 1} estimated cost`}
                    min="0"
                    onChange={(event) =>
                      updateIngredient(row.key, {
                        estimatedPrice: event.target.value,
                      })
                    }
                    placeholder="SAR"
                    step="0.01"
                    type="number"
                    value={row.estimatedPrice}
                  />
                </label>
                <button
                  aria-label={`Remove ingredient ${index + 1}`}
                  className="remove-ingredient"
                  disabled={ingredients.length === 1}
                  onClick={() =>
                    setIngredients((rows) =>
                      rows.filter((item) => item.key !== row.key),
                    )
                  }
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button className="primary-button dialog-submit" type="submit">
            {editingMeal ? 'Save changes' : 'Add meal'}
          </button>
        </form>
      </dialog>
    </div>
  );
}

function blankIngredient(): IngredientDraft {
  return {
    key: Date.now() + Math.floor(Math.random() * 100000),
    name: '',
    quantity: '1',
    unit: 'pcs',
    inventoryItemId: '',
    estimatedPrice: '',
  };
}

function formText(value: FormDataEntryValue | undefined) {
  return typeof value === 'string' ? value : '';
}

function ShoppingScheduleDialog({
  editingItem,
  defaultDate,
  onClose,
  onSubmit,
}: {
  editingItem: ShoppingItem | null;
  defaultDate: string;
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="dialog-overlay">
      <dialog
        aria-labelledby="shopping-dialog-title"
        className="inventory-dialog"
        open
      >
        <button
          aria-label="Close schedule dialog"
          className="dialog-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
        <header className="dialog-header">
          <h2 id="shopping-dialog-title">
            {editingItem ? 'Reschedule item' : 'Schedule item'}
          </h2>
          <p>Plan the date, quantity and estimated SAR price.</p>
        </header>
        <form className="dialog-form" onSubmit={onSubmit}>
          <label htmlFor="scheduled-item-name">
            Item name
            <input
              defaultValue={editingItem?.name}
              id="scheduled-item-name"
              name="name"
              placeholder="e.g. Basmati rice"
              required
            />
          </label>
          <div className="form-grid">
            <label htmlFor="scheduled-quantity">
              Quantity
              <input
                defaultValue={editingItem?.quantity ?? 1}
                id="scheduled-quantity"
                min="0.01"
                name="quantity"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label htmlFor="scheduled-unit">
              Unit
              <select
                defaultValue={editingItem?.unit ?? 'pcs'}
                id="scheduled-unit"
                name="unit"
                required
              >
                <option value="pcs">pcs</option>
                <option value="pack">pack</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label htmlFor="scheduled-date">
              Purchase date
              <input
                defaultValue={editingItem?.scheduledDate ?? defaultDate}
                id="scheduled-date"
                name="scheduledDate"
                required
                type="date"
              />
            </label>
            <label htmlFor="scheduled-price">
              Estimated price (SAR) <span>(optional)</span>
              <input
                defaultValue={editingItem?.estimatedPrice ?? ''}
                id="scheduled-price"
                min="0"
                name="estimatedPrice"
                placeholder="0.00"
                step="0.01"
                type="number"
              />
            </label>
          </div>
          <div className="purchase-save-note">
            <CalendarDays size={17} />
            <span>
              The item will appear under its scheduled day and in the monthly
              calendar.
            </span>
          </div>
          <button className="primary-button dialog-submit" type="submit">
            {editingItem ? 'Save schedule' : 'Schedule item'}
          </button>
        </form>
      </dialog>
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
                defaultValue={editingItem?.location ?? 'Fridge'}
                id="item-location"
                name="location"
                required
              >
                {storageLocations.map((location) => (
                  <option key={location}>{location}</option>
                ))}
                <option>Kitchen</option>
                <option>Storage</option>
                <option>Bathroom</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label htmlFor="item-specific-spot">
              Specific spot <span>(optional)</span>
              <input
                defaultValue={editingItem?.specificSpot ?? ''}
                id="item-specific-spot"
                name="specificSpot"
                placeholder="e.g. Top shelf"
              />
            </label>
            <label htmlFor="item-expiry">
              Expiry date <span>(optional)</span>
              <input
                defaultValue={editingItem?.expiryDate ?? ''}
                id="item-expiry"
                name="expiryDate"
                type="date"
              />
            </label>
          </div>
          <button className="primary-button dialog-submit" type="submit">
            {editingItem ? 'Save changes' : 'Save item'}
          </button>
        </form>
      </dialog>
    </div>
  );
}

function PurchaseDialog({
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
        aria-labelledby="purchase-dialog-title"
        className="inventory-dialog purchase-dialog"
        open
      >
        <button
          aria-label="Close purchase dialog"
          className="dialog-close"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
        <header className="dialog-header">
          <h2 id="purchase-dialog-title">Add purchase</h2>
          <p>One entry updates inventory, expenses and price history.</p>
        </header>
        <form className="dialog-form" onSubmit={onSubmit}>
          <label htmlFor="purchase-item-name">
            Item name
            <input
              id="purchase-item-name"
              name="itemName"
              placeholder="e.g. Basmati rice"
              required
            />
          </label>
          <div className="form-grid">
            <label htmlFor="purchase-quantity">
              Quantity
              <input
                id="purchase-quantity"
                min="0.01"
                name="quantity"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label htmlFor="purchase-unit">
              Unit
              <select id="purchase-unit" name="unit" required>
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="pcs">pcs</option>
                <option value="pack">pack</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label htmlFor="purchase-price">
              Total price (SAR)
              <input
                id="purchase-price"
                min="0.01"
                name="totalPrice"
                placeholder="0.00"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label htmlFor="purchase-date">
              Purchase date
              <input
                defaultValue={today}
                id="purchase-date"
                name="purchasedAt"
                required
                type="date"
              />
            </label>
          </div>
          <div className="form-grid">
            <label htmlFor="purchase-category">
              Category
              <select id="purchase-category" name="category" required>
                <option>Pantry</option>
                <option>Dairy & eggs</option>
                <option>Vegetables</option>
                <option>Frozen</option>
                <option>Household</option>
                <option>Other</option>
              </select>
            </label>
            <label htmlFor="purchase-location">
              Store in
              <select id="purchase-location" name="location" required>
                {storageLocations.map((location) => (
                  <option key={location}>{location}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label htmlFor="purchase-expiry">
              Expiry date <span>(optional)</span>
              <input id="purchase-expiry" name="expiryDate" type="date" />
            </label>
            <label htmlFor="purchase-specific-spot">
              Specific spot <span>(optional)</span>
              <input
                id="purchase-specific-spot"
                name="specificSpot"
                placeholder="e.g. Top shelf"
              />
            </label>
          </div>
          <label htmlFor="purchase-store">
            Shop or store <span>(optional)</span>
            <input
              id="purchase-store"
              name="store"
              placeholder="e.g. Lulu Hypermarket"
            />
          </label>
          <div className="purchase-save-note">
            <Check size={17} />
            <span>
              This will create an inventory batch and a matching grocery
              expense.
            </span>
          </div>
          <button className="primary-button dialog-submit" type="submit">
            Save purchase
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

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function todayIso() {
  return localIso(new Date());
}

function addDaysIso(value: string, days: number) {
  const date = new Date(value + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return localIso(date);
}

function lastSixMonths() {
  const current = new Date(todayIso() + 'T12:00:00');
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      current.getFullYear(),
      current.getMonth() - (5 - index),
      1,
      12,
    );
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date),
    };
  });
}

function compareTasks(a: HouseholdTask, b: HouseholdTask) {
  if (a.completed !== b.completed)
    return Number(a.completed) - Number(b.completed);
  if (!a.dueDate && !b.dueDate) return a.createdAt.localeCompare(b.createdAt);
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

function startOfWeekIso(value: string) {
  const date = new Date(value + 'T12:00:00');
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  return addDaysIso(value, offset);
}

function compareMeals(a: MealPlan, b: MealPlan) {
  return (
    a.plannedDate.localeCompare(b.plannedDate) ||
    (a.plannedTime ?? '99:99').localeCompare(b.plannedTime ?? '99:99') ||
    a.name.localeCompare(b.name)
  );
}

function weekRangeLabel(start: string) {
  const end = addDaysIso(start, 6);
  const startDate = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');
  const startLabel = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: startDate.getMonth() === endDate.getMonth() ? undefined : 'short',
  }).format(startDate);
  return `${startLabel} – ${new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(endDate)}`;
}

function timeLabel(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2026, 0, 1, hours, minutes));
}

function compareShopping(a: ShoppingItem, b: ShoppingItem) {
  if (!a.scheduledDate && !b.scheduledDate)
    return b.createdAt.localeCompare(a.createdAt);
  if (!a.scheduledDate) return 1;
  if (!b.scheduledDate) return -1;
  return (
    a.scheduledDate.localeCompare(b.scheduledDate) ||
    b.createdAt.localeCompare(a.createdAt)
  );
}

function weekdayShort(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
    new Date(value + 'T12:00:00'),
  );
}

function dayMonthShort(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value + 'T12:00:00'));
}

function shoppingGroupLabel(value: string) {
  if (value === 'Unscheduled') return 'Unscheduled';
  if (value === todayIso())
    return 'Today · ' + weekdayShort(value) + ' ' + dayMonthShort(value);
  if (value === addDaysIso(todayIso(), 1))
    return 'Tomorrow · ' + weekdayShort(value) + ' ' + dayMonthShort(value);
  return weekdayShort(value) + ' · ' + dayMonthShort(value);
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
