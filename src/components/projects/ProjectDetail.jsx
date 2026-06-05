import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Target, Clock, Trash2, Shield, Settings, Users, Layers, Save } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import ProgressRing from '@/components/shared/ProgressRing';
import { formatCurrencyINR, formatDateIndian } from '@/lib/formatters';

export default function ProjectDetail({ project, onBack }) {
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [projectForm, setProjectForm] = useState({ ...project });
  const [milestoneForm, setMilestoneForm] = useState({ 
    project_id: project.id, title: '', description: '', phase: 'other', status: 'not_started',
    planned_start: '', planned_end: '', assigned_to: '', priority: 'medium', progress: 0 
  });
  
  const [newWbsName, setNewWbsName] = useState('');
  const [selectedUserToAssign, setSelectedUserToAssign] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    setProjectForm({ ...project });
  }, [project]);

  // Queries
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', project.id],
    queryFn: () => base44.entities.Milestone.filter({ project_id: project.id }, '-created_date', 100),
  });

  const { data: wbsItems = [] } = useQuery({
    queryKey: ['wbs', project.id],
    queryFn: () => base44.entities.WBSItem.filter({ project_id: project.id }),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 100),
  });

  // Mutations
  const createMilestoneMutation = useMutation({
    mutationFn: (data) => base44.entities.Milestone.create(data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['milestones', project.id] }); 
      setShowAddMilestone(false); 
      setMilestoneForm({
        project_id: project.id, title: '', description: '', phase: 'other', status: 'not_started',
        planned_start: '', planned_end: '', assigned_to: '', priority: 'medium', progress: 0
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(project.id, data),
    onSuccess: (updated) => { 
      queryClient.invalidateQueries({ queryKey: ['projects'] }); 
      setProjectForm(updated);
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Milestone.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', project.id] }),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (id) => base44.entities.Milestone.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', project.id] }),
  });

  const createWbsMutation = useMutation({
    mutationFn: (name) => base44.entities.WBSItem.create({
      project_id: project.id,
      title: name,
      name: name,
      code: `SP_${Date.now().toString().slice(-4)}`,
      level: 1,
      order_index: wbsItems.length,
      status: 'not_started',
      progress: 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', project.id] });
      setNewWbsName('');
    }
  });

  const deleteWbsMutation = useMutation({
    mutationFn: (id) => base44.entities.WBSItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', project.id] });
    }
  });

  const phases = ['foundation', 'structure', 'mep', 'finishing', 'handover', 'other'];
  const assignedUsers = projectForm.assigned_users || [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Button>

      {/* Project Overview Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <ProgressRing value={project.progress || 0} size={64} strokeWidth={4} />
              <div>
                <h1 className="text-xl font-heading font-bold">{project.name}</h1>
                <p className="text-sm text-muted-foreground">{project.location || 'No Location Set'} · {project.client || 'No Client Set'}</p>
                <div className="flex gap-2 mt-2">
                  <StatusBadge status={project.status} />
                  <StatusBadge status={project.priority} />
                </div>
              </div>
            </div>
          </div>
          {project.description && <p className="text-sm text-muted-foreground mt-4">{project.description}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div><p className="text-xs text-muted-foreground">Start Date</p><p className="text-sm font-semibold">{formatDateIndian(project.start_date) || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">End Date</p><p className="text-sm font-semibold">{formatDateIndian(project.end_date) || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Budget</p><p className="text-sm font-semibold">{formatCurrencyINR(project.budget || 0)}</p></div>
            <div><p className="text-xs text-muted-foreground">Spent</p><p className="text-sm font-semibold">{formatCurrencyINR(project.spent || 0)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation tabs between Milestones and Administration Settings */}
      <Tabs defaultValue="milestones" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="milestones" className="gap-2">
            <Target className="w-4 h-4" /> Milestones & Phases
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-2">
            <Settings className="w-4 h-4" /> Project Admin & Settings
          </TabsTrigger>
        </TabsList>

        {/* 1. Milestones Tab */}
        <TabsContent value="milestones" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold">Milestones</h2>
            <Dialog open={showAddMilestone} onOpenChange={setShowAddMilestone}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Add Milestone</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Title *</Label><Input value={milestoneForm.title} onChange={e => setMilestoneForm({...milestoneForm, title: e.target.value})} /></div>
                  <div><Label>Description</Label><Textarea value={milestoneForm.description} onChange={e => setMilestoneForm({...milestoneForm, description: e.target.value})} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Phase</Label>
                      <Select value={milestoneForm.phase} onValueChange={v => setMilestoneForm({...milestoneForm, phase: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{phases.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Priority</Label>
                      <Select value={milestoneForm.priority} onValueChange={v => setMilestoneForm({...milestoneForm, priority: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{['low','medium','high','critical'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Planned Start</Label><Input type="date" value={milestoneForm.planned_start} onChange={e => setMilestoneForm({...milestoneForm, planned_start: e.target.value})} /></div>
                    <div><Label>Planned End</Label><Input type="date" value={milestoneForm.planned_end} onChange={e => setMilestoneForm({...milestoneForm, planned_end: e.target.value})} /></div>
                  </div>
                  <div><Label>Assigned To</Label><Input value={milestoneForm.assigned_to} onChange={e => setMilestoneForm({...milestoneForm, assigned_to: e.target.value})} /></div>
                  <Button className="w-full" onClick={() => createMilestoneMutation.mutate(milestoneForm)} disabled={!milestoneForm.title}>Add Milestone</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {phases.slice(0, 5).map(p => <TabsTrigger key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</TabsTrigger>)}
            </TabsList>
            {['all', ...phases.slice(0, 5)].map(tab => (
              <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
                {milestones.filter(m => tab === 'all' || m.phase === tab).map(m => (
                  <Card key={m.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <ProgressRing value={m.progress || 0} size={40} strokeWidth={3} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{m.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => {
                                  const newStatus = m.status === 'not_started' ? 'in_progress' : m.status === 'in_progress' ? 'completed' : m.status;
                                  const newProgress = newStatus === 'completed' ? 100 : m.progress;
                                  updateMilestoneMutation.mutate({ id: m.id, data: { status: newStatus, progress: newProgress } });
                                }}
                              >
                                <Target className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMilestoneMutation.mutate(m.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <StatusBadge status={m.status} />
                            <StatusBadge status={m.priority} />
                            {m.planned_start && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{m.planned_start} → {m.planned_end}</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {milestones.filter(m => tab === 'all' || m.phase === tab).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No milestones in this phase</p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* 2. Admin Settings & Edit Tab */}
        <TabsContent value="admin" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Side: General Project details (editable) */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" /> General Project Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Project Name *</Label>
                      <Input 
                        value={projectForm.name || ''} 
                        onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label>Client Name</Label>
                      <Input 
                        value={projectForm.client || ''} 
                        onChange={e => setProjectForm({ ...projectForm, client: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Location</Label>
                      <Input 
                        value={projectForm.location || ''} 
                        onChange={e => setProjectForm({ ...projectForm, location: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label>Project Manager</Label>
                      <Input 
                        value={projectForm.project_manager || ''} 
                        onChange={e => setProjectForm({ ...projectForm, project_manager: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input 
                        type="date" 
                        value={projectForm.start_date || ''} 
                        onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input 
                        type="date" 
                        value={projectForm.end_date || ''} 
                        onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Budget (INR)</Label>
                      <Input 
                        type="number" 
                        value={projectForm.budget || ''} 
                        onChange={e => setProjectForm({ ...projectForm, budget: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                    <div>
                      <Label>Spent (INR)</Label>
                      <Input 
                        type="number" 
                        value={projectForm.spent || ''} 
                        onChange={e => setProjectForm({ ...projectForm, spent: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <Select value={projectForm.status} onValueChange={v => setProjectForm({...projectForm, status: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['planning','in_progress','on_hold','completed','delayed'].map(s => (
                            <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={projectForm.priority} onValueChange={v => setProjectForm({...projectForm, priority: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['low','medium','high','critical'].map(p => (
                            <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Progress ({projectForm.progress || 0}%)</Label>
                    <Slider 
                      value={[projectForm.progress || 0]} 
                      onValueChange={([v]) => setProjectForm({...projectForm, progress: v})} 
                      max={100} 
                      step={5} 
                      className="mt-2" 
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea 
                      value={projectForm.description || ''} 
                      onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} 
                      rows={3} 
                    />
                  </div>

                  <Button 
                    className="w-full gap-2 bg-primary text-white" 
                    onClick={() => updateProjectMutation.mutate(projectForm)}
                    disabled={updateProjectMutation.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {updateProjectMutation.isPending ? 'Saving...' : 'Save Project Details'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Side: Sub-projects (Towers) and Assigned Users config */}
            <div className="space-y-6">
              
              {/* Sub-projects (Towers) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Sub-Projects & Towers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Create Subproject */}
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. Tower A" 
                      value={newWbsName} 
                      onChange={e => setNewWbsName(e.target.value)} 
                    />
                    <Button 
                      onClick={() => {
                        if (newWbsName.trim()) {
                          createWbsMutation.mutate(newWbsName.trim());
                        }
                      }}
                      disabled={createWbsMutation.isPending || !newWbsName.trim()}
                    >
                      Add
                    </Button>
                  </div>

                  {/* List of subprojects */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {wbsItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{item.title || item.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.code}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${item.title || item.name}?`)) {
                              deleteWbsMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {wbsItems.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">No sub-projects/towers configured.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Assigned Users */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Assigned Users & Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Select User to Assign */}
                  <div className="space-y-2">
                    <Select value={selectedUserToAssign} onValueChange={setSelectedUserToAssign}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select user to assign..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter(u => !assignedUsers.includes(u.id)).map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.email} ({u.role})
                          </SelectItem>
                        ))}
                        {users.filter(u => !assignedUsers.includes(u.id)).length === 0 && (
                          <div className="p-2 text-xs text-muted-foreground text-center">All users assigned</div>
                        )}
                      </SelectContent>
                    </Select>
                    <Button 
                      className="w-full"
                      onClick={() => {
                        if (selectedUserToAssign) {
                          const updated = [...assignedUsers, selectedUserToAssign];
                          updateProjectMutation.mutate({ ...projectForm, assigned_users: updated });
                          setSelectedUserToAssign('');
                        }
                      }}
                      disabled={!selectedUserToAssign || updateProjectMutation.isPending}
                    >
                      Assign User to Project
                    </Button>
                  </div>

                  {/* List of assigned users */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {users.filter(u => assignedUsers.includes(u.id)).map(u => (
                      <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{u.email}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-extrabold">{u.role}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Unassign ${u.email} from this project?`)) {
                              const updated = assignedUsers.filter(id => id !== u.id);
                              updateProjectMutation.mutate({ ...projectForm, assigned_users: updated });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {users.filter(u => assignedUsers.includes(u.id)).length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">No users assigned to this project.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}