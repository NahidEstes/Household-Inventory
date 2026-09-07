'use client';

import {
  Bell, Box, CalendarClock, ChartNoAxesCombined, ChevronRight,
  CircleDollarSign, ClipboardList, Home, Moon, PackagePlus, Search,
  Settings, ShoppingBasket, Sun, WalletCards,
} from 'lucide-react';
import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

const navItems = [
  { label: 'Dashboard', icon: Home },
  { label: 'Inventory', icon: Box },
  { label: 'Shopping list', icon: ClipboardList },
  { label: 'Expenses', icon: WalletCards },
  { label: 'Expiry', icon: CalendarClock },
  { label: 'Reports', icon: ChartNoAxesCombined },
];

const summary = [
  { label: 'Spent this month', value: 'SAR 18,450', note: '61.5% of budget', icon: WalletCards, tone: 'green' },
  { label: 'Budget remaining', value: 'SAR 11,550', note: '19 days left', icon: CircleDollarSign, tone: 'mint' },
  { label: 'Items in stock', value: '48', note: 'Across 6 categories', icon: Box, tone: 'blue' },
  { label: 'Expiring soon', value: '3', note: 'Needs attention', icon: CalendarClock, tone: 'coral' },
];

const inventory = [
  { icon: '🌾', name: 'Basmati rice', category: 'Pantry', quantity: '5 kg', location: 'Kitchen', expiry: '28 Sep 2026', status: 'In stock' },
  { icon: '🥚', name: 'Eggs', category: 'Dairy & eggs', quantity: '8 pcs', location: 'Fridge', expiry: '12 Sep 2026', status: 'Low stock' },
  { icon: '🥛', name: 'Fresh milk', category: 'Dairy & eggs', quantity: '2 L', location: 'Fridge', expiry: '10 Sep 2026', status: 'Expiring' },
  { icon: '🥔', name: 'Potatoes', category: 'Vegetables', quantity: '3 kg', location: 'Pantry', expiry: '18 Sep 2026', status: 'In stock' },
];

type InventoryRow = (typeof inventory)[number];
type ShoppingRow = { id: number; name: string; completed: boolean };
type InventoryRecord = { name: string; category: string; quantity: number; unit: string; location: string; expiryDate?: string | null };
type ExpenseRecord = { amount: number };

const initialShopping: ShoppingRow[] = [
  { id: -1, name: 'Red onions', completed: false },
  { id: -2, name: 'Cooking oil', completed: false },
  { id: -3, name: 'Sea salt', completed: false },
];

const spendBars = [48, 66, 92, 70, 56];

export default function HomeInventory() {
  const [dark, setDark] = useState(false);
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>(inventory);
  const [shoppingRows, setShoppingRows] = useState<ShoppingRow[]>(initialShopping);
  const [spentTotal, setSpentTotal] = useState(18450);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('home-inventory-theme');
    const nextDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const frame = window.requestAnimationFrame(() => setDark(nextDark));
    document.documentElement.classList.toggle('dark', nextDark);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/inventory').then(async (response) => response.ok ? await response.json() as InventoryRecord[] : []),
      fetch('/api/expenses').then(async (response) => response.ok ? await response.json() as ExpenseRecord[] : []),
      fetch('/api/shopping').then(async (response) => response.ok ? await response.json() as ShoppingRow[] : []),
    ]).then(([items, expenses, shopping]) => {
      if (items.length) setInventoryRows(items.map(toInventoryRow));
      if (expenses.length) setSpentTotal(expenses.reduce((total, expense) => total + expense.amount, 0));
      if (shopping.length) setShoppingRows(shopping);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const context = typeof document === 'undefined' ? undefined : document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'start_inventory_item_creation',
      title: 'Add inventory item',
      description: 'Open the same add-item form used in the visible Home Inventory interface.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        setActiveSection('Inventory');
        setItemDialogOpen(true);
        return { status: 'ready', form: 'inventory-item' };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const filteredInventory = useMemo(() => inventoryRows.filter((item) =>
    `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase()),
  ), [inventoryRows, query]);

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    localStorage.setItem('home-inventory-theme', nextDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextDark);
  }

  async function addInventoryItem(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) return setNotice('Could not save the item. Please check the details.');
    const item = toInventoryRow(await response.json() as InventoryRecord);
    setInventoryRows((rows) => [item, ...rows]);
    setNotice(`${item.name} was added to inventory.`);
    setItemDialogOpen(false);
    event.currentTarget.reset();
  }

  async function addExpense(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) return setNotice('Could not save the expense. Please check the details.');
    const expense = await response.json() as ExpenseRecord;
    setSpentTotal((total) => total + expense.amount);
    setNotice(`SAR ${Number(expense.amount).toLocaleString()} expense saved.`);
    setExpenseDialogOpen(false);
    event.currentTarget.reset();
  }

  async function toggleShopping(item: ShoppingRow) {
    const completed = !item.completed;
    setShoppingRows((rows) => rows.map((row) => row.id === item.id ? { ...row, completed } : row));
    if (item.id > 0) await fetch('/api/shopping', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, completed }) });
  }

  const summaryCards = summary.map((item, index) => index === 0 ? { ...item, value: `SAR ${spentTotal.toLocaleString()}` } : item);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Home size={20} strokeWidth={2.4} /></span><span>Homely</span></div>
        <nav aria-label="Primary navigation" className="nav-list">
          {navItems.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${activeSection === label ? 'active' : ''}`} key={label} onClick={() => setActiveSection(label)} type="button"><Icon size={19} /><span>{label}</span></button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" type="button"><Settings size={19} /><span>Settings</span></button>
          <div className="profile-mini"><span className="avatar">NH</span><span><strong>Nahid Hasan</strong><small>Household owner</small></span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <label className="search-box"><Search size={18} /><input aria-label="Search inventory" onChange={(event) => setQuery(event.target.value)} placeholder="Search items, expenses or lists..." value={query} /><kbd>⌘ K</kbd></label>
          <div className="top-actions">
            <button aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="icon-button" onClick={toggleTheme} type="button">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <button aria-label="Notifications" className="icon-button notification" type="button"><Bell size={19} /><span /></button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><p className="eyebrow">MONDAY, 7 SEPTEMBER</p><h1>{activeSection === 'Dashboard' ? 'Good morning, Nahid' : activeSection}</h1><p>{activeSection === 'Dashboard' ? 'Here is what is happening in your household today.' : `Manage your household ${activeSection.toLowerCase()} in one place.`}</p></div>
            <div className="heading-actions"><button className="secondary-button" onClick={() => setExpenseDialogOpen(true)} type="button"><CircleDollarSign size={18} /> Add expense</button><button className="primary-button" onClick={() => setItemDialogOpen(true)} type="button"><PackagePlus size={18} /> Add item</button></div>
          </div>

          {notice && <div aria-live="polite" className="notice"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')} type="button">×</button></div>}

          <section aria-label="Household summary" className="summary-grid">
            {summaryCards.map(({ label, value, note, icon: Icon, tone }) => (
              <article className="summary-card" key={label}><div className={`summary-icon ${tone}`}><Icon size={20} /></div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>
            ))}
          </section>

          <div className="dashboard-grid">
            <section className="panel spend-panel">
              <div className="panel-heading"><div><h2>Monthly spending</h2><p>Your household expenses for September</p></div><button className="text-button" type="button">View report <ChevronRight size={16} /></button></div>
              <div className="spending-total"><strong>SAR 18,450</strong><span>↓ 8.2% from last month</span></div>
              <div className="chart" aria-label="Weekly spending bar chart"><div className="chart-axis"><span>8k</span><span>6k</span><span>4k</span><span>2k</span><span>0</span></div><div className="bar-zone">
                {spendBars.map((height, index) => <div className="bar-column" key={height}><div className={`bar ${index === 2 ? 'peak' : ''}`} style={{ height: `${height}%` }} /><span>{['1–7', '8–14', '15–21', '22–28', '29–30'][index]}</span></div>)}
              </div></div>
            </section>

            <aside className="panel expiry-panel">
              <div className="panel-heading"><div><h2>Expiry alerts</h2><p>Use these items soon</p></div><CalendarClock size={21} /></div>
              <div className="alert-list">{[
                ['🥛', 'Fresh milk', '3 days', '10 Sep'], ['🥚', 'Eggs', '5 days', '12 Sep'], ['🥣', 'Greek yogurt', '6 days', '13 Sep'],
              ].map(([icon, name, days, date]) => <div className="alert-item" key={name}><span className="food-icon">{icon}</span><span><strong>{name}</strong><small>Expires {date}</small></span><em>{days}</em></div>)}</div>
              <button className="full-button" type="button">View all expiry dates</button>
            </aside>

            <section className="panel inventory-panel">
              <div className="panel-heading"><div><h2>Recent inventory</h2><p>Latest items in your household</p></div><button className="text-button" type="button">View inventory <ChevronRight size={16} /></button></div>
              <div className="table-wrap"><table aria-label="Recent inventory items"><thead><tr><th>Item</th><th>Quantity</th><th>Location</th><th>Expiry date</th><th>Status</th></tr></thead><tbody>
                {filteredInventory.map((item) => <tr key={`${item.name}-${item.expiry}`}><td aria-label={`${item.name}, ${item.category}`}><span className="table-item"><span aria-hidden="true" className="food-icon">{item.icon}</span><span><strong>{item.name}</strong><small>{item.category}</small></span></span></td><td>{item.quantity}</td><td>{item.location}</td><td>{item.expiry}</td><td><span className={`status ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span></td></tr>)}
              </tbody></table></div>
            </section>

            <aside className="panel shopping-panel">
              <div className="panel-heading"><div><h2>Shopping list</h2><p>3 items to buy</p></div><ShoppingBasket size={21} /></div>
              <div className="check-list">{shoppingRows.map((item) => <label htmlFor={`shopping-${item.id}`} key={item.id}><input checked={item.completed} id={`shopping-${item.id}`} onChange={() => toggleShopping(item)} type="checkbox" /> <span className={item.completed ? 'completed' : ''}>{item.name}</span></label>)}</div>
              <button className="full-button" type="button">Open shopping list</button>
            </aside>
          </div>
        </div>
      </section>

      <Dialog onOpenChange={setItemDialogOpen} open={itemDialogOpen}>
        <DialogContent className="inventory-dialog">
          <DialogHeader><DialogTitle>Add inventory item</DialogTitle><DialogDescription>Record the quantity, location and expiry date.</DialogDescription></DialogHeader>
          <form className="dialog-form" onSubmit={addInventoryItem}>
            <label htmlFor="item-name">Item name<Input id="item-name" name="name" placeholder="e.g. Basmati rice" required /></label>
            <div className="form-grid"><label htmlFor="item-quantity">Quantity<Input id="item-quantity" min="0.01" name="quantity" placeholder="1" required step="0.01" type="number" /></label><label htmlFor="item-unit">Unit<NativeSelect className="select-full" id="item-unit" name="unit" required><NativeSelectOption value="kg">kg</NativeSelectOption><NativeSelectOption value="L">L</NativeSelectOption><NativeSelectOption value="pcs">pcs</NativeSelectOption><NativeSelectOption value="pack">pack</NativeSelectOption></NativeSelect></label></div>
            <div className="form-grid"><label htmlFor="item-category">Category<NativeSelect className="select-full" id="item-category" name="category" required><NativeSelectOption>Pantry</NativeSelectOption><NativeSelectOption>Dairy & eggs</NativeSelectOption><NativeSelectOption>Vegetables</NativeSelectOption><NativeSelectOption>Household</NativeSelectOption></NativeSelect></label><label htmlFor="item-location">Location<NativeSelect className="select-full" id="item-location" name="location" required><NativeSelectOption>Kitchen</NativeSelectOption><NativeSelectOption>Fridge</NativeSelectOption><NativeSelectOption>Freezer</NativeSelectOption><NativeSelectOption>Storage</NativeSelectOption></NativeSelect></label></div>
            <label htmlFor="item-expiry">Expiry date <span>(optional)</span><Input id="item-expiry" name="expiryDate" type="date" /></label>
            <button className="primary-button dialog-submit" type="submit">Save item</button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setExpenseDialogOpen} open={expenseDialogOpen}>
        <DialogContent className="inventory-dialog">
          <DialogHeader><DialogTitle>Add expense</DialogTitle><DialogDescription>Record a household payment in SAR.</DialogDescription></DialogHeader>
          <form className="dialog-form" onSubmit={addExpense}>
            <label htmlFor="expense-amount">Amount (SAR)<Input id="expense-amount" min="0.01" name="amount" placeholder="0.00" required step="0.01" type="number" /></label>
            <label htmlFor="expense-category">Category<NativeSelect className="select-full" id="expense-category" name="category" required><NativeSelectOption>Groceries</NativeSelectOption><NativeSelectOption>Utilities</NativeSelectOption><NativeSelectOption>Transport</NativeSelectOption><NativeSelectOption>Healthcare</NativeSelectOption><NativeSelectOption>Household</NativeSelectOption></NativeSelect></label>
            <label htmlFor="expense-date">Date<Input defaultValue="2026-09-07" id="expense-date" name="spentAt" required type="date" /></label>
            <label htmlFor="expense-note">Note <span>(optional)</span><Input id="expense-note" name="note" placeholder="What was this for?" /></label>
            <button className="primary-button dialog-submit" type="submit">Save expense</button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function toInventoryRow(item: InventoryRecord): InventoryRow {
  const expiry = item.expiryDate ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${item.expiryDate}T12:00:00`)) : 'No expiry';
  const icons: Record<string, string> = { 'Dairy & eggs': '🥛', Vegetables: '🥬', Pantry: '🌾', Household: '🧴' };
  return { icon: icons[item.category] ?? '📦', name: item.name, category: item.category, quantity: `${item.quantity} ${item.unit}`, location: item.location, expiry, status: 'In stock' };
}
