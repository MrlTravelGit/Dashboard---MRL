import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

/**
 * Dashboard web “estilo Lovable” (clean + cards + filtros + botão +)
 * - Persistência simples via localStorage
 * - KPIs mensais
 * - Gráficos: por categoria (barra) e evolução mensal (linha)
 * - Tabela com busca + filtros
 *
 * Como usar no Next.js (App Router):
 * - Coloque este componente em app/page.tsx e garanta 'use client' no topo.
 * - shadcn/ui + recharts + lucide-react instalados.
 */

type Category =
  | "Sistemas"
  | "IA/Assinaturas"
  | "Treinamento"
  | "Mentorias"
  | "Viagens"
  | "Salários"
  | "Comissões"
  | "Impostos"
  | "Marketing"
  | "Outros";

type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: Category;
  amountCents: number;
  paid: boolean;
  paymentMethod: "PIX" | "Cartão" | "Boleto" | "Transferência" | "Dinheiro";
  vendor?: string;
  notes?: string;
  recurring?: boolean;
};

const CATEGORIES: Category[] = [
  "Sistemas",
  "IA/Assinaturas",
  "Treinamento",
  "Mentorias",
  "Viagens",
  "Salários",
  "Comissões",
  "Impostos",
  "Marketing",
  "Outros",
];

const PAYMENT_METHODS: Expense["paymentMethod"][] = [
  "PIX",
  "Cartão",
  "Boleto",
  "Transferência",
  "Dinheiro",
];

function formatBRL(cents: number) {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function ymFromDate(date: string) {
  // date: YYYY-MM-DD
  const [y, m] = date.split("-");
  return `${y}-${m}`;
}

function nowYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

const STORAGE_KEY = "mrl_travel_expenses_v1";

function seedData(): Expense[] {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return [
    {
      id: uid(),
      date: `${yyyy}-${mm}-${dd}`,
      description: "Assinatura ferramenta de reservas",
      category: "Sistemas",
      amountCents: 29900,
      paid: true,
      paymentMethod: "Cartão",
      vendor: "Plataforma X",
      notes: "Plano mensal",
      recurring: true,
    },
    {
      id: uid(),
      date: `${yyyy}-${mm}-${dd}`,
      description: "Chat/IA (workspace)",
      category: "IA/Assinaturas",
      amountCents: 9900,
      paid: true,
      paymentMethod: "Cartão",
      vendor: "IA",
      recurring: true,
    },
    {
      id: uid(),
      date: `${yyyy}-${mm}-${dd}`,
      description: "Campanha tráfego pago",
      category: "Marketing",
      amountCents: 45000,
      paid: false,
      paymentMethod: "PIX",
      vendor: "Meta Ads",
      notes: "Pendente",
    },
  ];
}

function loadExpenses(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedData();
    return parsed;
  } catch {
    return seedData();
  }
}

function saveExpenses(expenses: Expense[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function sum(expenses: Expense[]) {
  return expenses.reduce((acc, e) => acc + e.amountCents, 0);
}

function avgCents(values: number[]) {
  if (!values.length) return 0;
  const total = values.reduce((a, b) => a + b, 0);
  return Math.round(total / values.length);
}

function monthsBack(ym: string, count: number) {
  // ym: YYYY-MM
  const [yStr, mStr] = ym.split("-");
  let y = Number(yStr);
  let m = Number(mStr);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const mm = String(m).padStart(2, "0");
    out.push(`${y}-${mm}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border bg-background px-3 py-2 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{formatBRL(v)}</div>
    </div>
  );
};

export default function DashboardLovable() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [month, setMonth] = useState<string>(nowYM());

  // filtros
  const [q, setQ] = useState<string>("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [paid, setPaid] = useState<"all" | "paid" | "pending">("all");
  const [method, setMethod] = useState<Expense["paymentMethod"] | "all">(
    "all"
  );

  // modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    category: "Sistemas" as Category,
    amount: "",
    paid: true,
    paymentMethod: "PIX" as Expense["paymentMethod"],
    vendor: "",
    notes: "",
    recurring: false,
  });

  useEffect(() => {
    const loaded = loadExpenses();
    setExpenses(loaded);
  }, []);

  useEffect(() => {
    if (!expenses.length) return;
    saveExpenses(expenses);
  }, [expenses]);

  const months = useMemo(() => {
    // lista de meses presentes + últimos 12
    const fromData = Array.from(new Set(expenses.map((e) => ymFromDate(e.date))))
      .sort()
      .reverse();
    const base = monthsBack(nowYM(), 12);
    const merged = Array.from(new Set([...fromData, ...base])).sort().reverse();
    return merged;
  }, [expenses]);

  const monthExpenses = useMemo(() => {
    return expenses
      .filter((e) => ymFromDate(e.date) === month)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenses, month]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return monthExpenses.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (method !== "all" && e.paymentMethod !== method) return false;
      if (paid === "paid" && !e.paid) return false;
      if (paid === "pending" && e.paid) return false;
      if (!qq) return true;
      const hay = `${e.description} ${e.vendor ?? ""} ${e.notes ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [monthExpenses, q, category, method, paid]);

  const kpis = useMemo(() => {
    const total = sum(monthExpenses);
    const recurringTotal = sum(monthExpenses.filter((e) => e.recurring));
    const pendingTotal = sum(monthExpenses.filter((e) => !e.paid));

    const last6 = monthsBack(month, 6);
    const totals6 = last6
      .map((m) => sum(expenses.filter((e) => ymFromDate(e.date) === m)))
      .filter((v) => v > 0);
    const avg6 = avgCents(totals6);

    return { total, recurringTotal, pendingTotal, avg6 };
  }, [expenses, month, monthExpenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amountCents);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses]);

  const trend = useMemo(() => {
    const last12 = monthsBack(month, 12).reverse();
    return last12.map((m) => ({
      month: m,
      value: sum(expenses.filter((e) => ymFromDate(e.date) === m)),
    }));
  }, [expenses, month]);

  function addExpense() {
    const amount = Number(String(form.amount).replace(/\./g, "").replace(",", "."));
    if (!form.date || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const next: Expense = {
      id: uid(),
      date: form.date,
      description: form.description.trim(),
      category: form.category,
      amountCents: Math.round(amount * 100),
      paid: form.paid,
      paymentMethod: form.paymentMethod,
      vendor: form.vendor.trim() || undefined,
      notes: form.notes.trim() || undefined,
      recurring: form.recurring,
    };
    setExpenses((prev) => [next, ...prev]);
    // se lançar em mês diferente, já navega pro mês do lançamento
    setMonth(ymFromDate(next.date));
    setOpen(false);
    setForm((f) => ({
      ...f,
      description: "",
      amount: "",
      vendor: "",
      notes: "",
      recurring: false,
      paid: true,
      paymentMethod: "PIX",
      category: "Sistemas",
    }));
  }

  function togglePaid(id: string) {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e))
    );
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard de Custos</h1>
            <p className="text-sm text-muted-foreground">
              Controle financeiro da agência — despesas, tendências e pendências.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-44">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl">
                  <Plus className="mr-2 h-4 w-4" /> Nova despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Adicionar despesa</DialogTitle>
                  <DialogDescription>
                    Preencha o essencial — você pode detalhar depois.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      className="rounded-2xl"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label>Descrição</Label>
                    <Input
                      className="rounded-2xl"
                      placeholder="Ex.: Assinatura de sistema / comissão / anúncio"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      className="rounded-2xl"
                      placeholder="Ex.: 299,00"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Forma de pagamento</Label>
                    <Select
                      value={form.paymentMethod}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, paymentMethod: v as Expense["paymentMethod"] }))
                      }
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fornecedor (opcional)</Label>
                    <Input
                      className="rounded-2xl"
                      placeholder="Ex.: Meta / Plataforma / Consultor"
                      value={form.vendor}
                      onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notas (opcional)</Label>
                    <Input
                      className="rounded-2xl"
                      placeholder="Ex.: referente ao mês / observações"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={form.paid}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, paid: Boolean(v) }))}
                    />
                    <span className="text-sm">Pago</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={form.recurring}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, recurring: Boolean(v) }))
                      }
                    />
                    <span className="text-sm">Recorrente</span>
                  </div>
                </div>

                <DialogFooter className="mt-2">
                  <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="rounded-2xl" onClick={addExpense}>
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total do mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatBRL(kpis.total)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Mês: {month}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recorrentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatBRL(kpis.recurringTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Assinaturas / fixas</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatBRL(kpis.pendingTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Em aberto no mês</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Média (últ. 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatBRL(kpis.avg6)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Baseada nos meses com dados</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Despesas por categoria</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} height={52} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v ? `${Math.round(v / 1000)}k` : "0")} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {!byCategory.length && (
                <div className="mt-3 text-sm text-muted-foreground">Sem dados para este mês.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Evolução mensal (últimos 12)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v ? `${Math.round(v / 1000)}k` : "0")} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Line type="monotone" dataKey="value" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Table */}
        <Card className="mt-4 rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Lançamentos do mês</CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">
                  {filtered.length} item(ns) após filtros
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="rounded-2xl pl-9"
                    placeholder="Buscar por descrição / fornecedor / notas"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>

                <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                  <SelectTrigger className="rounded-2xl w-full sm:w-48">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={paid} onValueChange={(v) => setPaid(v as any)}>
                  <SelectTrigger className="rounded-2xl w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                  <SelectTrigger className="rounded-2xl w-full sm:w-44">
                    <SelectValue placeholder="Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Descrição</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Pagamento</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Valor</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, idx) => (
                    <tr
                      key={e.id}
                      className={
                        "border-t " +
                        (idx % 2 === 0 ? "bg-background" : "bg-muted/10")
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{e.description}</div>
                        {(e.vendor || e.notes) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {[e.vendor, e.notes].filter(Boolean).join(" • ")}
                          </div>
                        )}
                        {e.recurring && (
                          <div className="mt-2">
                            <Badge variant="secondary" className="rounded-xl">Recorrente</Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{e.category}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{e.paymentMethod}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => togglePaid(e.id)}
                          className="inline-flex items-center gap-2"
                          title="Clique para alternar"
                        >
                          <span
                            className={
                              "inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-medium " +
                              (e.paid
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300")
                            }
                          >
                            {e.paid ? "Pago" : "Pendente"}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-semibold">
                        {formatBRL(e.amountCents)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-2xl"
                          onClick={() => removeExpense(e.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {!filtered.length && (
                    <tr>
                      <td className="px-4 py-10 text-center text-muted-foreground" colSpan={7}>
                        Nenhum lançamento encontrado para este mês com os filtros atuais.
                        <div className="mt-3">
                          <Button className="rounded-2xl" onClick={() => setOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Adicionar despesa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                Dica: clique no status (Pago/Pendente) para alternar rapidamente.
              </div>
              <div className="text-sm font-semibold">
                Total (após filtros): {formatBRL(sum(filtered))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-xs text-muted-foreground">
          Persistência local (localStorage). Para multiusuário + relatórios avançados: integrar com banco (Supabase/Postgres) e autenticação.
        </div>
      </div>
    </div>
  );
}
