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
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Layers } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { formatCompactCurrencyINR } from '@/lib/formatters';

const levelColors = {
  1: 'bg-primary/10 text-primary font-bold',
  2: 'bg-blue-100 text-blue-700 font-semibold',
  3: 'bg-slate-100 text-slate-600',
};

const defaultForm = {
  project_id: '', code: '', title: '', description: '', level: 1,
  parent_id: '', planned_quantity: '', actual_quantity: 0, unit: '',
  progress: 0, budget_amount: '', order_index: 0,
  activity_id: '', budget_item_id: '',
};

export default function WBSManagement() {
  const [projectFilter, setProjectFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState(defaultForm);

  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const { data: wbsItems = [], isLoading } = useQuery({
    queryKey: ['wbs', projectFilter],
    queryFn: () => projectFilter
      ? base44.entities.WBSItem.filter({ project_id: projectFilter }, 'order_index', 500)
      : base44.entities.WBSItem.list('order_index', 500),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', projectFilter || form.project_id],
    queryFn: () => (projectFilter || form.project_id)
      ? base44.entities.ScheduleActivity.filter({ project_id: projectFilter || form.project_id })
      : base44.entities.ScheduleActivity.list('order_index', 500),
  });

  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budgetItems', projectFilter || form.project_id],
    queryFn: () => (projectFilter || form.project_id)
      ? base44.entities.BudgetItem.filter({ project_id: projectFilter || form.project_id })
      : base44.entities.BudgetItem.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WBSItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wbs'] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WBSItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wbs'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WBSItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wbs'] }),
  });

  const openEdit = (item) => {
    const linkedAct = activities.find(a => a.wbs_item_id === item.id);
    const linkedBud = budgetItems.find(b => b.wbs_item_id === item.id);

    setEditItem(item);
    setForm({
      ...defaultForm,
      ...item,
      activity_id: linkedAct ? linkedAct.id : '',
      budget_item_id: linkedBud ? linkedBud.id : '',
    });
    setShowAdd(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      planned_quantity: parseFloat(form.planned_quantity) || 0,
      actual_quantity: parseFloat(form.actual_quantity) || 0,
      budget_amount: parseFloat(form.budget_amount) || 0,
      progress: parseFloat(form.progress) || 0,
    };

    const { activity_id, budget_item_id, ...wbsData } = payload;

    const handleLinks = async (savedWBS) => {
      const wbsId = savedWBS.id;
      // Clear WBS ID from activities that previously pointed here but are no longer linked
      const actsToClear = activities.filter(a => a.wbs_item_id === wbsId && a.id !== activity_id);
      for (const act of actsToClear) {
        await base44.entities.ScheduleActivity.update(act.id, { wbs_item_id: '' });
      }
      if (activity_id) {
        await base44.entities.ScheduleActivity.update(activity_id, { wbs_item_id: wbsId });
      }

      // Clear WBS ID from budget items that previously pointed here but are no longer linked
      const budsToClear = budgetItems.filter(b => b.wbs_item_id === wbsId && b.id !== budget_item_id);
      for (const bud of budsToClear) {
        await base44.entities.BudgetItem.update(bud.id, { wbs_item_id: '' });
      }
      if (budget_item_id) {
        await base44.entities.BudgetItem.update(budget_item_id, { wbs_item_id: wbsId });
      }

      queryClient.invalidateQueries({ queryKey: ['wbs'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['budgetItems'] });
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: wbsData }, {
        onSuccess: (savedWBS) => {
          handleLinks(savedWBS);
          setShowAdd(false);
          setEditItem(null);
        }
      });
    } else {
      createMutation.mutate(wbsData, {
        onSuccess: (savedWBS) => {
          handleLinks(savedWBS);
          setShowAdd(false);
          setForm(defaultForm);
        }
      });
    }
  };

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const l1Items = wbsItems.filter(w => w.level === 1 || !w.parent_id);
  const getChildren = (parentId) => wbsItems.filter(w => w.parent_id === parentId);

  const totalBudget = l1Items.reduce((s, w) => s + (w.budget_amount || 0), 0);
  const avgProgress = wbsItems.length > 0 ? Math.round(wbsItems.reduce((s, w) => s + (w.progress || 0), 0) / wbsItems.length) : 0;

  const fmt = (v) => formatCompactCurrencyINR(v);

  const renderRow = (item, depth = 0) => {
    const children = getChildren(item.id);
    const isExp = expanded[item.id];
    const indent = depth * 20;

    const linkedAct = activities.find(a => a.wbs_item_id === item.id);
    const linkedBud = budgetItems.find(b => b.wbs_item_id === item.id);

    return (
      <React.Fragment key={item.id}>
        <tr className="border-b hover:bg-muted/10 cursor-pointer" onClick={() => children.length > 0 && toggleExpand(item.id)}>
          <td className="p-3 text-foreground" style={{ paddingLeft: `${12 + indent}px` }}>
            <div className="flex items-start gap-2">
              {children.length > 0
                ? (isExp ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />)
                : <div className="w-4" />}
              <span className={`text-xs px-1.5 py-0.5 mt-0.5 rounded shrink-0 ${levelColors[item.level] || levelColors[3]}`}>L{item.level}</span>
              <span className="text-xs text-muted-foreground mt-0.5 font-mono shrink-0">{item.code}</span>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{item.title}</span>
                {(linkedAct || linkedBud) && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {linkedAct && (
                      <Badge variant="outline" className="text-[10px] text-blue-600 bg-blue-50/50 border-blue-200 py-0 px-1.5 font-normal">
                        📅 {linkedAct.activity_id || 'Act'}: {linkedAct.name}
                      </Badge>
                    )}
                    {linkedBud && (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-50/50 border-emerald-200 py-0 px-1.5 font-normal">
                        💰 {linkedBud.code || 'Bud'}: {linkedBud.title}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </td>
          <td className="p-3 text-right text-sm">{item.planned_quantity ? `${item.planned_quantity.toLocaleString()} ${item.unit || ''}` : '—'}</td>
          <td className="p-3 text-right text-sm">{item.actual_quantity ? `${item.actual_quantity.toLocaleString()} ${item.unit || ''}` : '—'}</td>
          <td className="p-3 text-right text-sm font-semibold">{fmt(item.budget_amount)}</td>
          <td className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${item.progress || 0}%`,
                    backgroundColor: item.progress >= 80 ? '#10b981' : item.progress >= 40 ? '#f59e0b' : '#6366f1',
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{item.progress || 0}%</span>
            </div>
          </td>
          <td className="p-3" onClick={e => e.stopPropagation()}>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </td>
        </tr>
        {isExp && children.map(child => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">WBS Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-sans">Work Breakdown Structure — Activity and Budget Integration</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditItem(null); setForm(defaultForm); setShowAdd(true); }}>
          <Plus className="w-4 h-4" /> Add WBS Item
        </Button>
      </div>

      {/* Filter */}
      <Select value={projectFilter} onValueChange={setProjectFilter}>
        <SelectTrigger className="w-52"><SelectValue placeholder="All Projects" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>All Projects</SelectItem>
          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Items', value: wbsItems.length },
          { label: 'L1 Categories', value: l1Items.length },
          { label: 'Avg Progress', value: `${avgProgress}%` },
          { label: 'Total Budget', value: fmt(totalBudget) },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 font-sans">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WBS Tree Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm font-sans">Loading WBS...</div>
      ) : wbsItems.length === 0 ? (
        <EmptyState icon={Layers} title="No WBS items" description="Build your work breakdown structure with L1, L2, and L3 items." actionLabel="Add WBS Item" onAction={() => { setEditItem(null); setForm(defaultForm); setShowAdd(true); }} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold">WBS Item / Linked Activity & Budget</th>
                  <th className="text-right p-3 font-semibold">Planned Qty</th>
                  <th className="text-right p-3 font-semibold">Actual Qty</th>
                  <th className="text-right p-3 font-semibold">Budget</th>
                  <th className="text-left p-3 font-semibold">Progress</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {l1Items.map(item => renderRow(item, 0))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) { setEditItem(null); setForm(defaultForm); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg font-sans">
          <DialogHeader><DialogTitle>{editItem ? 'Edit WBS Item' : 'Add WBS Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Project *</Label>
                <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Level</Label>
                <Select value={String(form.level)} onValueChange={v => setForm({ ...form, level: parseInt(v), parent_id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">L1 — Major Category</SelectItem>
                    <SelectItem value="2">L2 — Sub Category</SelectItem>
                    <SelectItem value="3">L3 — Work Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.level > 1 && (
              <div><Label>Parent Item</Label>
                <Select value={form.parent_id} onValueChange={v => setForm({ ...form, parent_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select parent" /></SelectTrigger>
                  <SelectContent>
                    {wbsItems.filter(w => w.level < form.level && w.project_id === form.project_id).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.code} {w.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-muted/20">
              <div><Label>Link Schedule Activity</Label>
                <Select value={form.activity_id} onValueChange={v => setForm({ ...form, activity_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No linked activity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None / Unlink</SelectItem>
                    {activities.filter(a => !form.project_id || a.project_id === form.project_id).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.activity_id || 'ACT'} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Link Budget Item</Label>
                <Select value={form.budget_item_id} onValueChange={v => setForm({ ...form, budget_item_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No linked budget" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None / Unlink</SelectItem>
                    {budgetItems.filter(b => b.level > 1 && (!form.project_id || b.project_id === form.project_id)).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.code} — {b.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1.2.3" /></div>
              <div><Label>Order Index</Label><Input type="number" value={form.order_index} onChange={e => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Planned Qty</Label><Input type="number" value={form.planned_quantity} onChange={e => setForm({ ...form, planned_quantity: e.target.value })} /></div>
              <div><Label>Actual Qty</Label><Input type="number" value={form.actual_quantity} onChange={e => setForm({ ...form, actual_quantity: e.target.value })} /></div>
              <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="m², m³, pcs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Budget (₹)</Label><Input type="number" value={form.budget_amount} onChange={e => setForm({ ...form, budget_amount: e.target.value })} /></div>
              <div><Label>Progress (%)</Label><Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <Button className="w-full mt-2" disabled={!form.project_id || !form.title} onClick={handleSubmit}>
              {editItem ? 'Update Item' : 'Add WBS Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}