import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Pencil, Save, X, GitBranch, AlertTriangle, CheckCircle2 } from 'lucide-react';

const phaseColors = {
  foundation: 'bg-amber-100 text-amber-700',
  structure: 'bg-blue-100 text-blue-700',
  mep: 'bg-purple-100 text-purple-700',
  finishing: 'bg-emerald-100 text-emerald-700',
  handover: 'bg-slate-100 text-slate-600',
  other: 'bg-gray-100 text-gray-600',
};

export default function ScheduleReview({ schedule, generationFeatures, onFinalize, onCancel, projectId }) {
  const [editedSchedule, setEditedSchedule] = useState(schedule.map(a => ({ ...a })));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showDependencyEditor, setShowDependencyEditor] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);

  const queryClient = useQueryClient();

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const created = await base44.entities.ScheduleActivity.bulkCreate(
        editedSchedule.map((a, index) => ({
          ...a,
          project_id: projectId,
          order_index: index,
          updated_date: new Date().toISOString()
        }))
      );

      await base44.integrations.Schedule.finalize({
        projectId,
        features: generationFeatures,
        schedule: created
      });

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      onFinalize(created);
    }
  });

  const openEdit = (activity) => {
    setEditingId(activity.id || activity.activity_id);
    setEditForm({ ...activity });
  };

  const saveEdit = () => {
    const updated = editedSchedule.map(a =>
      (a.id || a.activity_id) === editingId ? editForm : a
    );
    setEditedSchedule(updated);
    setEditingId(null);
    setEditForm({});
  };

  const deleteActivity = (id) => {
    setEditedSchedule(editedSchedule.filter(a => (a.id || a.activity_id) !== id));
  };

  const addPredecessor = (fromActivityId, toActivityId) => {
    const updated = editedSchedule.map(a => {
      if ((a.id || a.activity_id) === toActivityId) {
        const preds = a.predecessors || [];
        if (!preds.includes(fromActivityId)) {
          return { ...a, predecessors: [...preds, fromActivityId] };
        }
      }
      return a;
    });
    setEditedSchedule(updated);
  };

  const removePredecessor = (activityId, predActivityId) => {
    const updated = editedSchedule.map(a => {
      if ((a.id || a.activity_id) === activityId) {
        return { ...a, predecessors: (a.predecessors || []).filter(p => p !== predActivityId) };
      }
      return a;
    });
    setEditedSchedule(updated);
  };

  const selectedActivity = editedSchedule.find(a => (a.id || a.activity_id) === selectedActivityId);
  const availablePredecessors = editedSchedule.filter(
    a => (a.id || a.activity_id) !== selectedActivityId && !(selectedActivity?.predecessors || []).includes(a.id || a.activity_id)
  );

  const criticalCount = editedSchedule.filter(a => a.is_critical_path).length;
  const milestoneCount = editedSchedule.filter(a => a.is_milestone).length;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-heading font-bold tracking-tight">Review Generated Schedule</h2>
        <p className="text-sm text-muted-foreground mt-1">Edit activities, change dependencies, and adjust dates before finalizing.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Activities', value: editedSchedule.length, icon: CheckCircle2 },
          { label: 'Critical Path', value: criticalCount, icon: GitBranch, color: 'text-red-600' },
          { label: 'Milestones', value: milestoneCount, icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Phases', value: new Set(editedSchedule.map(a => a.phase)).size, icon: GitBranch, color: 'text-blue-600' },
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

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="table">Activities Table</TabsTrigger>
          <TabsTrigger value="dependencies">Edit Dependencies</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
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
                    <th className="text-right p-3 font-semibold">Duration</th>
                    <th className="text-left p-3 font-semibold">Predecessors</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {editedSchedule.map(a => (
                    <tr key={a.id || a.activity_id} className={`border-b hover:bg-muted/10 ${a.is_critical_path ? 'bg-red-50/30' : ''}`}>
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
                      <td className="p-3 text-right text-xs">{a.duration_days} days</td>
                      <td className="p-3 text-xs">
                        {(a.predecessors || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {a.predecessors.map(p => (
                              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(a)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {editedSchedule.map(a => (
                    <button
                      key={a.id || a.activity_id}
                      onClick={() => setSelectedActivityId(a.id || a.activity_id)}
                      className={`w-full text-left p-3 rounded-md text-sm font-medium transition-all border ${
                        selectedActivityId === (a.id || a.activity_id)
                          ? 'bg-primary text-white border-primary'
                          : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-semibold">{a.activity_id}</div>
                      <div className="text-xs opacity-80 truncate">{a.name}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedActivity && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dependencies for {selectedActivity.activity_id}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Current Predecessors</Label>
                    {(selectedActivity.predecessors || []).length > 0 ? (
                      <div className="space-y-2">
                        {selectedActivity.predecessors.map(p => (
                          <div key={p} className="flex items-center justify-between bg-muted p-2 rounded">
                            <span className="text-sm font-mono">{p}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => removePredecessor(selectedActivity.id || selectedActivity.activity_id, p)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No predecessors (starting activity)</p>
                    )}
                  </div>

                  {availablePredecessors.length > 0 && (
                    <div>
                      <Label htmlFor="pred-select" className="text-sm font-semibold mb-2 block">Add Predecessor</Label>
                      <Select
                        onValueChange={(actId) => {
                          addPredecessor(actId, selectedActivity.id || selectedActivity.activity_id);
                        }}
                      >
                        <SelectTrigger id="pred-select" className="text-sm">
                          <SelectValue placeholder="Select activity..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePredecessors.map(a => (
                            <SelectItem key={a.id || a.activity_id} value={a.id || a.activity_id}>
                              {a.activity_id} — {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={v => !v && setEditingId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          {editingId && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Activity ID</Label>
                  <Input value={editForm.activity_id || ''} disabled className="text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Phase</Label>
                  <Input value={editForm.phase || ''} disabled className="text-xs mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-sm">Name</Label>
                <Input
                  value={editForm.name || ''}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Start Date</Label>
                  <Input
                    type="date"
                    value={editForm.planned_start || ''}
                    onChange={e => setEditForm({ ...editForm, planned_start: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">End Date</Label>
                  <Input
                    type="date"
                    value={editForm.planned_end || ''}
                    onChange={e => setEditForm({ ...editForm, planned_end: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Duration (days)</Label>
                  <Input
                    type="number"
                    value={editForm.duration_days || 0}
                    onChange={e => setEditForm({ ...editForm, duration_days: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Float Days</Label>
                  <Input
                    type="number"
                    value={editForm.float_days || 0}
                    onChange={e => setEditForm({ ...editForm, float_days: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Assigned Crew</Label>
                  <Input
                    value={editForm.assigned_crew || ''}
                    onChange={e => setEditForm({ ...editForm, assigned_crew: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.is_critical_path || false}
                    onChange={e => setEditForm({ ...editForm, is_critical_path: e.target.checked })}
                    className="mr-2"
                  />
                  Critical Path Activity
                </Label>
              </div>

              <div>
                <Label className="text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.is_milestone || false}
                    onChange={e => setEditForm({ ...editForm, is_milestone: e.target.checked })}
                    className="mr-2"
                  />
                  Mark as Milestone
                </Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
                <Button onClick={saveEdit} className="gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteActivity(editingId);
                    setEditingId(null);
                  }}
                  className="ml-auto"
                >
                  Delete Activity
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending} className="gap-2">
          {finalizeMutation.isPending ? (
            <>
              <div className="animate-spin">⏳</div>
              Finalizing...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" /> Finalize & Save Schedule
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
