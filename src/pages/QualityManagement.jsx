import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, ShieldCheck, AlertTriangle, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';

const INSPECTION_TYPES = ['structural','electrical','plumbing','fire_safety','finishing','environmental','general'];
const STATUSES = ['scheduled','in_progress','passed','failed','requires_rework'];
const SEVERITIES = ['minor','moderate','major','critical'];

export default function QualityManagement() {
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    project_id: '', title: '', inspection_type: 'general', status: 'scheduled',
    inspector_name: '', inspection_date: '', findings: '', severity: 'minor',
    corrective_action: '', compliance_score: 80
  });

  const queryClient = useQueryClient();

  const { data: inspections = [] } = useQuery({
    queryKey: ['inspections'],
    queryFn: () => base44.entities.QualityInspection.list('-created_date', 200),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QualityInspection.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inspections'] }); setShowAdd(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QualityInspection.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspections'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QualityInspection.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspections'] }),
  });

  const filtered = statusFilter === 'all' ? inspections : inspections.filter(i => i.status === statusFilter);

  const passedCount = inspections.filter(i => i.status === 'passed').length;
  const failedCount = inspections.filter(i => i.status === 'failed').length;
  const avgScore = inspections.length > 0 ? Math.round(inspections.reduce((s, i) => s + (i.compliance_score || 0), 0) / inspections.length) : 0;
  const criticalIssues = inspections.filter(i => i.severity === 'critical' && i.status !== 'passed').length;

  const statusData = STATUSES.map(s => ({ name: s.replace(/_/g, ' '), value: inspections.filter(i => i.status === s).length })).filter(d => d.value > 0);
  const statusColors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#f97316'];

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Quality Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track inspections, compliance, and quality control</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Inspection</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Inspection</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Project *</Label>
                <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Inspection title" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Type</Label>
                  <Select value={form.inspection_type} onValueChange={v => setForm({...form, inspection_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INSPECTION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Severity</Label>
                  <Select value={form.severity} onValueChange={v => setForm({...form, severity: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Inspector</Label><Input value={form.inspector_name} onChange={e => setForm({...form, inspector_name: e.target.value})} /></div>
                <div><Label>Date</Label><Input type="date" value={form.inspection_date} onChange={e => setForm({...form, inspection_date: e.target.value})} /></div>
              </div>
              <div><Label>Compliance Score: {form.compliance_score}</Label>
                <Input type="range" min="0" max="100" value={form.compliance_score} onChange={e => setForm({...form, compliance_score: parseInt(e.target.value)})} className="mt-1" />
              </div>
              <div><Label>Findings</Label><Textarea value={form.findings} onChange={e => setForm({...form, findings: e.target.value})} rows={3} /></div>
              <div><Label>Corrective Action</Label><Textarea value={form.corrective_action} onChange={e => setForm({...form, corrective_action: e.target.value})} rows={2} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.project_id || !form.title}>Create Inspection</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Inspections" value={inspections.length} icon={ShieldCheck} />
        <StatCard title="Passed" value={passedCount} icon={CheckCircle} />
        <StatCard title="Failed" value={failedCount} icon={XCircle} />
        <StatCard title="Avg Score" value={`${avgScore}%`} subtitle={`${criticalIssues} critical`} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Inspection Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={statusColors[i % statusColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No data</div>}
          </CardContent>
        </Card>

        {/* Inspection List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Inspections</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.map(insp => (
              <div key={insp.id} className="p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{insp.title}</p>
                    <p className="text-xs text-muted-foreground">{getProjectName(insp.project_id)} · {insp.inspection_type?.replace(/_/g,' ')} · {insp.inspection_date}</p>
                    {insp.findings && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{insp.findings}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Select value={insp.status} onValueChange={v => updateMutation.mutate({ id: insp.id, data: { status: v } })}>
                      <SelectTrigger className="w-28 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(insp.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={insp.severity} />
                  <span className="text-xs font-semibold">{insp.compliance_score || 0}% compliance</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <EmptyState title="No inspections" description="Create your first quality inspection." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}