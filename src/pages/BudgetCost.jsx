import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, TrendingUp, TrendingDown, IndianRupee, AlertTriangle, Upload, FileSpreadsheet } from 'lucide-react';
import { formatCurrencyINR, formatCompactCurrencyINR } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import BudgetUploadPanel from '@/components/budget/BudgetUploadPanel';

export default function BudgetCost() {
  const [projectFilter, setProjectFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({ project_id: '', wbs_item_id: '', code: '', title: '', level: 1, parent_id: '', quantity: '', cost_per_unit: '', unit: '', original_budget: '', revised_budget: '', committed_cost: '', actual_cost: '', forecast_cost: '', revision_notes: '' });

  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date', 100) });
  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budget', projectFilter],
    queryFn: () => projectFilter ? base44.entities.BudgetItem.filter({ project_id: projectFilter }, 'code', 500) : base44.entities.BudgetItem.list('code', 500),
  });
  const { data: wbsItems = [] } = useQuery({
    queryKey: ['wbs', projectFilter],
    queryFn: () => projectFilter ? base44.entities.WBSItem.filter({ project_id: projectFilter }) : base44.entities.WBSItem.list('order_index', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BudgetItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budget'] }); setShowAdd(false); resetForm(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BudgetItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budget'] }); setEditItem(null); setShowAdd(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BudgetItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget'] }),
  });

  const resetForm = () => setForm({ project_id: projectFilter || '', wbs_item_id: '', code: '', title: '', level: 1, parent_id: '', quantity: '', cost_per_unit: '', unit: '', original_budget: '', revised_budget: '', committed_cost: '', actual_cost: '', forecast_cost: '', revision_notes: '' });

  const num = (v) => parseFloat(v) || 0;
  const fmt = (v) => formatCurrencyINR(v);

  const totalOriginal = budgetItems.reduce((s, b) => b.level === 1 ? s + num(b.original_budget) : s, 0);
  const totalRevised = budgetItems.reduce((s, b) => b.level === 1 ? s + num(b.revised_budget || b.original_budget) : s, 0);
  const totalActual = budgetItems.reduce((s, b) => b.level === 1 ? s + num(b.actual_cost) : s, 0);
  const totalForecast = budgetItems.reduce((s, b) => b.level === 1 ? s + num(b.forecast_cost || b.revised_budget || b.original_budget) : s, 0);

  const variance = totalRevised - totalActual;
  const variancePct = totalRevised > 0 ? ((totalActual / totalRevised) * 100).toFixed(1) : 0;

  const isBudgetDisabled = (editItem && budgetItems.some(b => b.parent_id === editItem.id)) || form.level > 1;

  React.useEffect(() => {
    if (form.level > 1 && (form.quantity !== undefined || form.cost_per_unit !== undefined)) {
      const q = parseFloat(form.quantity) || 0;
      const c = parseFloat(form.cost_per_unit) || 0;
      const total = q * c;
      if (form.original_budget !== total || form.revised_budget !== total) {
        setForm(prev => ({
          ...prev,
          original_budget: total,
          revised_budget: total
        }));
      }
    }
  }, [form.quantity, form.cost_per_unit, form.level]);

  const l1Items = budgetItems.filter(b => b.level === 1 || !b.parent_id);
  const getChildren = (id) => budgetItems.filter(b => b.parent_id === id);

  const chartData = l1Items.slice(0, 8).map(b => ({
    name: b.title.slice(0, 12),
    Budget: num(b.revised_budget || b.original_budget),
    Actual: num(b.actual_cost),
    Forecast: num(b.forecast_cost || b.revised_budget || b.original_budget),
  }));

  const getVarianceColor = (original, actual) => {
    const pct = original > 0 ? (actual / original) * 100 : 0;
    if (pct > 110) return 'text-red-600';
    if (pct > 100) return 'text-amber-600';
    return 'text-emerald-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Budget & Cost</h1>
          <p className="text-sm text-muted-foreground mt-1">L1 → L2 → L3 budget hierarchy with earned value tracking</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditItem(null); resetForm(); setShowAdd(true); }}>
          <Plus className="w-4 h-4" /> Add Budget Item
        </Button>
      </div>

      <Select value={projectFilter} onValueChange={setProjectFilter}>
        <SelectTrigger className="w-52"><SelectValue placeholder="Select project" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>All Projects</SelectItem>
          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Original Budget" value={formatCompactCurrencyINR(totalOriginal)} icon={IndianRupee} />
        <StatCard title="Revised Budget" value={formatCompactCurrencyINR(totalRevised)} subtitle={totalRevised !== totalOriginal ? `${totalRevised > totalOriginal ? '+' : ''}${formatCompactCurrencyINR(totalRevised - totalOriginal)}` : 'No revisions'} icon={IndianRupee} />
        <StatCard title="Actual Cost" value={formatCompactCurrencyINR(totalActual)} subtitle={`${variancePct}% utilised`} icon={TrendingUp} />
        <StatCard title="Cost Variance" value={formatCompactCurrencyINR(Math.abs(variance))} subtitle={variance >= 0 ? 'Under budget' : 'Over budget'} icon={variance >= 0 ? TrendingDown : TrendingUp} />
      </div>

      <Tabs defaultValue="hierarchy">
        <TabsList>
          <TabsTrigger value="hierarchy">Budget Hierarchy</TabsTrigger>
          <TabsTrigger value="chart">Cost Dashboard</TabsTrigger>
          <TabsTrigger value="ev">Earned Value</TabsTrigger>
          <TabsTrigger value="upload">Upload Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="mt-4">
          {budgetItems.length > 0 ? (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-semibold">Code / Description</th>
                      <th className="text-right p-3 font-semibold">Original</th>
                      <th className="text-right p-3 font-semibold">Revised</th>
                      <th className="text-right p-3 font-semibold">Committed</th>
                      <th className="text-right p-3 font-semibold">Actual</th>
                      <th className="text-right p-3 font-semibold">Forecast</th>
                      <th className="text-right p-3 font-semibold">Var %</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {l1Items.map(l1 => {
                      const isExp = expanded[l1.id];
                      const children = getChildren(l1.id);
                      const revised = num(l1.revised_budget || l1.original_budget);
                      const actual = num(l1.actual_cost);
                      const varPct = revised > 0 ? ((actual / revised) * 100).toFixed(0) : '-';
                      return (
                        <>
                          <tr key={l1.id} className="border-b bg-muted/10 hover:bg-muted/20 cursor-pointer" onClick={() => setExpanded(e => ({ ...e, [l1.id]: !e[l1.id] }))}>
                            <td className="p-3 font-semibold flex items-center gap-2">
                              {children.length > 0 ? (isExp ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />) : <div className="w-4" />}
                              <span className="text-xs text-muted-foreground mr-1">{l1.code}</span> {l1.title}
                            </td>
                            <td className="p-3 text-right">{fmt(num(l1.original_budget))}</td>
                            <td className="p-3 text-right">{fmt(revised)}</td>
                            <td className="p-3 text-right">{fmt(num(l1.committed_cost))}</td>
                            <td className="p-3 text-right font-medium">{fmt(actual)}</td>
                            <td className="p-3 text-right">{fmt(num(l1.forecast_cost || revised))}</td>
                            <td className={`p-3 text-right font-semibold ${getVarianceColor(revised, actual)}`}>{varPct}%</td>
                            <td className="p-3">
                              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditItem(l1); setForm({...l1}); setShowAdd(true); }}><Pencil className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(l1.id)}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </td>
                          </tr>
                          {isExp && children.map(child => {
                            const cRevised = num(child.revised_budget || child.original_budget);
                            const cActual = num(child.actual_cost);
                            const cVarPct = cRevised > 0 ? ((cActual / cRevised) * 100).toFixed(0) : '-';
                            return (
                              <tr key={child.id} className="border-b hover:bg-muted/10">
                                <td className="p-3 pl-10 text-muted-foreground flex flex-col justify-center">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs mr-1 font-mono">{child.code}</span>
                                    <span className="text-foreground font-medium">{child.title}</span>
                                    <Badge variant="outline" className="text-[9px]">L{child.level}</Badge>
                                  </div>
                                  {child.quantity > 0 && (
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                        Qty: {child.quantity} {child.unit || ''} @ {formatCurrencyINR(child.cost_per_unit || 0)}/unit
                                      </span>
                                  )}
                                </td>
                                <td className="p-3 text-right text-sm">{fmt(num(child.original_budget))}</td>
                                <td className="p-3 text-right text-sm">{fmt(cRevised)}</td>
                                <td className="p-3 text-right text-sm">{fmt(num(child.committed_cost))}</td>
                                <td className="p-3 text-right text-sm font-medium">{fmt(cActual)}</td>
                                <td className="p-3 text-right text-sm">{fmt(num(child.forecast_cost || cRevised))}</td>
                                <td className={`p-3 text-right text-sm font-semibold ${getVarianceColor(cRevised, cActual)}`}>{cVarPct}%</td>
                                <td className="p-3">
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditItem(child); setForm({...child}); setShowAdd(true); }}><Pencil className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(child.id)}><Trash2 className="w-3 h-3" /></Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <EmptyState icon={IndianRupee} title="No budget items" description="Build your budget hierarchy with L1, L2, and L3 line items." actionLabel="Add Budget Item" onAction={() => setShowAdd(true)} />
          )}
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Budget vs Actual vs Forecast</CardTitle></CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} barGap={2}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="Budget" fill="hsl(222, 47%, 30%)" radius={[3,3,0,0]} />
                    <Bar dataKey="Actual" fill="hsl(38, 92%, 50%)" radius={[3,3,0,0]} />
                    <Bar dataKey="Forecast" fill="hsl(160, 60%, 45%)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Add budget items to see chart</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <BudgetUploadPanel projects={projects} projectFilter={projectFilter} budgetItems={budgetItems} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['budget'] })} />
        </TabsContent>

        <TabsContent value="ev" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Planned Value (PV)', value: fmt(totalRevised * 0.6), desc: 'Budgeted cost of scheduled work', color: 'border-l-blue-500' },
              { label: 'Earned Value (EV)', value: fmt(totalRevised * 0.52), desc: 'Budgeted cost of work performed', color: 'border-l-emerald-500' },
              { label: 'Actual Cost (AC)', value: fmt(totalActual), desc: 'Actual cost incurred to date', color: 'border-l-amber-500' },
              { label: 'Cost Variance (CV)', value: fmt(Math.abs(totalRevised * 0.52 - totalActual)), desc: 'EV - AC (positive = under)', color: totalActual < totalRevised * 0.52 ? 'border-l-emerald-500' : 'border-l-red-500' },
              { label: 'Schedule Variance (SV)', value: fmt(Math.abs(totalRevised * 0.52 - totalRevised * 0.6)), desc: 'EV - PV (positive = ahead)', color: 'border-l-purple-500' },
              { label: 'CPI', value: totalActual > 0 ? ((totalRevised * 0.52) / totalActual).toFixed(2) : 'N/A', desc: 'Cost Performance Index (>1 = good)', color: 'border-l-indigo-500' },
            ].map(metric => (
              <Card key={metric.label} className={`border-l-4 ${metric.color}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-2xl font-bold mt-1">{metric.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metric.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) { setEditItem(null); resetForm(); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Budget Item' : 'Add Budget Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Project *</Label>
              <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. B1.2" /></div>
              <div><Label>Level</Label>
                <Select value={String(form.level)} onValueChange={v => setForm({...form, level: parseInt(v)})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">L1 — Major Head</SelectItem>
                    <SelectItem value="2">L2 — Sub Head</SelectItem>
                    <SelectItem value="3">L3 — Line Item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            {form.level > 1 && (
              <div className="grid grid-cols-3 gap-4 border p-3 rounded-lg bg-muted/20">
                <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} /></div>
                <div><Label>Cost per Unit ($)</Label><Input type="number" value={form.cost_per_unit} onChange={e => setForm({...form, cost_per_unit: e.target.value})} /></div>
                <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="e.g. m3, sqm, ton" /></div>
              </div>
            )}
            {form.level > 1 && (
              <div><Label>Parent Item</Label>
                <Select value={form.parent_id} onValueChange={v => setForm({...form, parent_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select parent" /></SelectTrigger>
                  <SelectContent>{budgetItems.filter(b => b.level < form.level && b.project_id === form.project_id).map(b => <SelectItem key={b.id} value={b.id}>{b.code} {b.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Original Budget ($)</Label><Input type="number" value={form.original_budget} disabled={isBudgetDisabled} onChange={e => setForm({...form, original_budget: parseFloat(e.target.value) || ''})} /></div>
              <div><Label>Revised Budget ($)</Label><Input type="number" value={form.revised_budget} disabled={isBudgetDisabled} onChange={e => setForm({...form, revised_budget: parseFloat(e.target.value) || ''})} /></div>
              <div><Label>Committed Cost ($)</Label><Input type="number" value={form.committed_cost} disabled={isBudgetDisabled} onChange={e => setForm({...form, committed_cost: parseFloat(e.target.value) || ''})} /></div>
              <div><Label>Actual Cost ($)</Label><Input type="number" value={form.actual_cost} disabled={isBudgetDisabled} onChange={e => setForm({...form, actual_cost: parseFloat(e.target.value) || ''})} /></div>
              <div className="col-span-2"><Label>Forecast Cost ($)</Label><Input type="number" value={form.forecast_cost} disabled={isBudgetDisabled} onChange={e => setForm({...form, forecast_cost: parseFloat(e.target.value) || ''})} /></div>
              {isBudgetDisabled && (
                <div className="col-span-2 flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {form.level > 1
                      ? "Budget values are calculated automatically as Quantity × Cost per Unit."
                      : `Budget values are dynamically rolled up from child items (L${form.level + 1}) and cannot be edited directly.`
                    }
                  </span>
                </div>
              )}
            </div>
            <div><Label>Revision Notes</Label><Textarea value={form.revision_notes} onChange={e => setForm({...form, revision_notes: e.target.value})} rows={2} /></div>
            <Button className="w-full" disabled={!form.project_id || !form.title} onClick={() => editItem ? updateMutation.mutate({ id: editItem.id, data: form }) : createMutation.mutate(form)}>
              {editItem ? 'Update' : 'Add Budget Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}