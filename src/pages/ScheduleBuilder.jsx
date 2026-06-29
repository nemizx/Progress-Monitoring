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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Calendar, GitBranch, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import ScheduleWizard from '@/components/schedule/ScheduleWizard';
import ScheduleReview from '@/components/schedule/ScheduleReview';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';
import { filterActivitiesBySubProject, filterWbsBySubProject } from '@/lib/subProjectScope';
import { getProjectTypeLabel } from '@/lib/projectTypes';

const phaseColors = {
  foundation: 'bg-amber-100 text-amber-700',
  structure: 'bg-blue-100 text-blue-700',
  mep: 'bg-purple-100 text-purple-700',
  finishing: 'bg-emerald-100 text-emerald-700',
  handover: 'bg-slate-100 text-slate-600',
  other: 'bg-gray-100 text-gray-600',
};

const defaultForm = {
  project_id: '', wbs_item_id: '', activity_id: '', name: '', description: '',
  phase: 'other', planned_start: '', planned_end: '', duration_days: '',
  float_days: 0, progress: 0, status: 'not_started', predecessors: [],
  dependency_type: 'FS', is_critical_path: false, is_milestone: false,
  assigned_crew: '', resources_needed: '', labor_count: '', order_index: 0,
};

export default function ScheduleBuilder() {
  const {
    projects, subProjects, wbsItems: allWbsItems, projectId, subProjectId,
    setProjectId, setSubProjectId, isReady, selectedProject, selectedSubProject,
  } = useProjectSubProject({ fetchWbs: true });

  const [phaseFilter, setPhaseFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [generatedScheduleData, setGeneratedScheduleData] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const queryClient = useQueryClient();

  const { data: allActivities = [], isLoading } = useQuery({
    queryKey: ['activities', projectId],
    queryFn: () => projectId
      ? base44.entities.ScheduleActivity.filter({ project_id: projectId }, 'order_index', 500)
      : Promise.resolve([]),
    enabled: !!projectId,
  });

  const activities = isReady
    ? filterActivitiesBySubProject(allActivities, allWbsItems, subProjectId)
    : [];
  const wbsItems = isReady ? filterWbsBySubProject(allWbsItems, subProjectId) : [];

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduleActivity.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activities'] }); setShowAdd(false); setForm(defaultForm); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduleActivity.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activities'] }); setShowAdd(false); setEditItem(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleActivity.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities'] }),
  });

  const openAddActivity = () => {
    setEditItem(null);
    setForm({ ...defaultForm, project_id: projectId });
    setShowAdd(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...defaultForm, ...item });
    setShowAdd(true);
  };

  const handleSubmit = () => {
    const payload = { ...form, duration_days: parseFloat(form.duration_days) || 0, labor_count: parseFloat(form.labor_count) || 0 };
    if (editItem) updateMutation.mutate({ id: editItem.id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = activities.filter(a =>
    (phaseFilter === 'all' || a.phase === phaseFilter)
  );

  const criticalCount = activities.filter(a => a.is_critical_path).length;
  const completedCount = activities.filter(a => a.status === 'completed').length;
  const delayedCount = activities.filter(a => a.status === 'delayed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Schedule Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Build and manage project activity schedules with predecessor logic</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" disabled={!isReady || !selectedProject?.project_type} onClick={() => setShowWizard(true)}>
            <Sparkles className="w-4 h-4 text-accent" /> ML Auto-Build
          </Button>
          <Button className="gap-2" disabled={!isReady} onClick={openAddActivity}>
            <Plus className="w-4 h-4" /> Add Activity
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <ProjectSubProjectSelector
          projects={projects}
          subProjects={subProjects}
          projectId={projectId}
          subProjectId={subProjectId}
          onProjectChange={setProjectId}
          onSubProjectChange={setSubProjectId}
        />
        <Select value={phaseFilter} onValueChange={setPhaseFilter} disabled={!isReady}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Phases" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            {['foundation', 'structure', 'mep', 'finishing', 'handover', 'other'].map(p => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isReady && selectedProject && selectedSubProject && (
        <p className="text-sm text-muted-foreground">
          Schedule for <span className="font-medium text-foreground">{selectedProject.name}</span>
          {' → '}
          <span className="font-medium text-foreground">{selectedSubProject.name}</span>
          {selectedProject.project_type && (
            <> · <span className="font-medium text-foreground">{getProjectTypeLabel(selectedProject.project_type)}</span></>
          )}
        </p>
      )}

      {isReady && selectedProject && !selectedProject.project_type && (
        <p className="text-xs text-amber-600">
          Set a project type under Projects → Admin to enable ML Auto-Build.
        </p>
      )}

      <SubProjectGate projectId={projectId} subProjectId={subProjectId} subProjects={subProjects}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Activities', value: activities.length, icon: Calendar },
          { label: 'Critical Path', value: criticalCount, icon: GitBranch, color: 'text-red-600' },
          { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Delayed', value: delayedCount, icon: AlertTriangle, color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color || 'text-primary'}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading activities...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Calendar} title="No activities yet" description="Add schedule activities linked to this sub-project WBS." actionLabel="Add Activity" onAction={openAddActivity} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold">ID</th>
                  <th className="text-left p-3 font-semibold">Activity</th>
                  <th className="text-left p-3 font-semibold">Phase</th>
                  <th className="text-left p-3 font-semibold">Start</th>
                  <th className="text-left p-3 font-semibold">End</th>
                  <th className="text-right p-3 font-semibold">Dur (d)</th>
                  <th className="text-right p-3 font-semibold">Float</th>
                  <th className="text-right p-3 font-semibold">Progress</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className={`border-b hover:bg-muted/10 ${a.is_critical_path ? 'bg-red-50/30' : ''}`}>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{a.activity_id || '—'}</td>
                    <td className="p-3">
                      <div className="font-medium">{a.name}</div>
                      {a.is_critical_path && <span className="text-[10px] text-red-600 font-semibold">CRITICAL</span>}
                      {a.is_milestone && <span className="text-[10px] text-purple-600 font-semibold ml-1">MILESTONE</span>}
                    </td>
                    <td className="p-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${phaseColors[a.phase] || phaseColors.other}`}>{a.phase}</span>
                    </td>
                    <td className="p-3 text-xs">{a.planned_start || '—'}</td>
                    <td className="p-3 text-xs">{a.planned_end || '—'}</td>
                    <td className="p-3 text-right">{a.duration_days ?? '—'}</td>
                    <td className="p-3 text-right">{a.float_days ?? 0}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${a.progress || 0}%` }} />
                        </div>
                        <span className="text-xs">{a.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="p-3"><StatusBadge status={a.status} /></td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(a)}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </SubProjectGate>

      {/* AI Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-lg">
          <ScheduleWizard
            projectId={projectId}
            subProjectId={subProjectId}
            projectName={selectedProject?.name}
            subProjectName={selectedSubProject?.name}
            projectType={selectedProject?.project_type}
            projectStartDate={selectedProject?.start_date}
            onGenerated={(data) => {
              setGeneratedScheduleData(data);
              setShowWizard(false);
              setShowReview(true);
            }}
            onComplete={() => { setShowWizard(false); queryClient.invalidateQueries({ queryKey: ['activities'] }); }}
            onCancel={() => setShowWizard(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Schedule Review Dialog */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Generated Schedule</DialogTitle>
          </DialogHeader>
          {generatedScheduleData && (
            <ScheduleReview
              schedule={generatedScheduleData.schedule}
              generationFeatures={generatedScheduleData.features}
              projectId={generatedScheduleData.projectId}
              subProjectId={generatedScheduleData.subProjectId}
              projectName={generatedScheduleData.projectName}
              subProjectName={generatedScheduleData.subProjectName}
              wbsItems={allWbsItems}
              onFinalize={() => {
                setShowReview(false);
                setGeneratedScheduleData(null);
                queryClient.invalidateQueries({ queryKey: ['activities'] });
              }}
              onCancel={() => {
                setShowReview(false);
                setGeneratedScheduleData(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) { setEditItem(null); setForm(defaultForm); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Activity' : 'Add Activity'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Project *</Label>
                <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Activity ID</Label><Input value={form.activity_id} onChange={e => setForm({ ...form, activity_id: e.target.value })} placeholder="e.g. A1010" /></div>
            </div>
            <div><Label>Activity Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phase</Label>
                <Select value={form.phase} onValueChange={v => setForm({ ...form, phase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['foundation', 'structure', 'mep', 'finishing', 'handover', 'other'].map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['not_started', 'in_progress', 'completed', 'delayed', 'on_hold'].map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Planned Start</Label><Input type="date" value={form.planned_start} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></div>
              <div><Label>Planned End</Label><Input type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></div>
              <div><Label>Duration (days)</Label><Input type="number" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} /></div>
              <div><Label>Float (days)</Label><Input type="number" value={form.float_days} onChange={e => setForm({ ...form, float_days: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Progress (%)</Label><Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Labor Count</Label><Input type="number" value={form.labor_count} onChange={e => setForm({ ...form, labor_count: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Assigned Crew</Label><Input value={form.assigned_crew} onChange={e => setForm({ ...form, assigned_crew: e.target.value })} /></div>
              <div><Label>Dependency Type</Label>
                <Select value={form.dependency_type} onValueChange={v => setForm({ ...form, dependency_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['FS', 'SS', 'FF', 'SF'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_critical_path} onChange={e => setForm({ ...form, is_critical_path: e.target.checked })} />
                Critical Path
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_milestone} onChange={e => setForm({ ...form, is_milestone: e.target.checked })} />
                Milestone
              </label>
            </div>
            <Button className="w-full" disabled={!form.project_id || !form.name} onClick={handleSubmit}>
              {editItem ? 'Update Activity' : 'Add Activity'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}