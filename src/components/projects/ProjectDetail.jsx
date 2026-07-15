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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Target, Clock, Trash2, Settings, Users, Save, Building2, Pencil, ImagePlus, X } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import ProgressRing from '@/components/shared/ProgressRing';
import { formatCurrencyINR, formatDateIndian } from '@/lib/formatters';
import { useToast } from '@/components/ui/use-toast';
import { PROJECT_TYPES, getProjectTypeLabel } from '@/lib/projectTypes';

export default function ProjectDetail({ project, onBack }) {
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showSubProjectModal, setShowSubProjectModal] = useState(false);
  const [editSubProject, setEditSubProject] = useState(null);
  const [projectForm, setProjectForm] = useState({ ...project });
  const [subProjForm, setSubProjForm] = useState({
    name: '', built_up_area: '', floors_count: '', flats_per_floor: '',
  });
  const [milestoneForm, setMilestoneForm] = useState({ 
    project_id: project.id, title: '', description: '', phase: 'other', status: 'not_started',
    planned_start: '', planned_end: '', assigned_to: '', priority: 'medium', progress: 0 
  });
  
  const [selectedUserToAssign, setSelectedUserToAssign] = useState('');
  const [elevationPhotoFile, setElevationPhotoFile] = useState(null);
  const [elevationPhotoPreview, setElevationPhotoPreview] = useState('');
  const [uploadingElevationPhoto, setUploadingElevationPhoto] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const resetSubProjForm = () => setSubProjForm({ name: '', built_up_area: '', floors_count: '', flats_per_floor: '' });

  useEffect(() => {
    setProjectForm({ ...project });
    setElevationPhotoFile(null);
    setElevationPhotoPreview('');
  }, [project]);

  // Queries
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', project.id],
    queryFn: () => base44.entities.Milestone.filter({ project_id: project.id }, '-created_date', 100),
  });

  const { data: subProjects = [], isLoading: loadingSubProjects } = useQuery({
    queryKey: ['subprojects', project.id],
    queryFn: () => base44.entities.SubProject.filter({ project_id: project.id }, '-created_date', 100),
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
    mutationFn: (data) => {
      const {
        id: _id,
        created_date: _created,
        updated_date: _updated,
        created_by_id: _creator,
        ...payload
      } = data;
      return base44.entities.Project.update(project.id, payload);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectForm(updated);
      toast({
        title: 'Project saved',
        description: 'Project details were updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Save failed',
        description: error?.message || 'Could not update project. Try again.',
        variant: 'destructive',
      });
    },
  });

  const handleElevationPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setElevationPhotoFile(file);
    setElevationPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveElevationPhoto = () => {
    setElevationPhotoFile(null);
    setElevationPhotoPreview('');
    setProjectForm({ ...projectForm, elevation_photo_url: '' });
  };

  const handleSaveProjectDetails = async () => {
    let nextForm = projectForm;
    if (elevationPhotoFile) {
      setUploadingElevationPhoto(true);
      try {
        const res = await base44.integrations.Core.UploadFile({ file: elevationPhotoFile });
        nextForm = { ...projectForm, elevation_photo_url: res.file_url || '' };
        setProjectForm(nextForm);
        setElevationPhotoFile(null);
        setElevationPhotoPreview('');
      } finally {
        setUploadingElevationPhoto(false);
      }
    }
    updateProjectMutation.mutate(nextForm);
  };

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Milestone.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', project.id] }),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (id) => base44.entities.Milestone.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', project.id] }),
  });

  const createSubProjectMutation = useMutation({
    mutationFn: async (data) => {
      const subProj = await base44.entities.SubProject.create(data);
      const floors = parseInt(data.floors_count, 10) || 0;
      const flatsPerFloor = parseInt(data.flats_per_floor, 10) || 0;
      const totalFlats = floors * flatsPerFloor;

      if (totalFlats > 0) {
        const flatsList = [];
        const baseArea = (parseFloat(data.built_up_area) || 0) / totalFlats;
        for (let floor = 1; floor <= floors; floor++) {
          for (let fIdx = 1; fIdx <= flatsPerFloor; fIdx++) {
            flatsList.push({
              project_id: project.id,
              sub_project_id: subProj.id,
              floor_number: floor,
              flat_number: `${floor}${String(fIdx).padStart(2, '0')}`,
              area_sqft: parseFloat(baseArea.toFixed(2)),
              cost_estimate: 0,
            });
          }
        }
        await base44.entities.ProjectFlat.bulkCreate(flatsList);
      }
      return subProj;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subprojects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['flats', project.id] });
      setShowSubProjectModal(false);
      setEditSubProject(null);
      resetSubProjForm();
      toast({ title: 'Sub-project Created', description: 'Sub-project was added successfully.' });
    },
    onError: (err) => {
      toast({
        title: 'Could not create sub-project',
        description: err?.message || 'Something went wrong. Check that the server is running.',
        variant: 'destructive',
      });
    },
  });

  const updateSubProjectMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SubProject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subprojects', project.id] });
      setShowSubProjectModal(false);
      setEditSubProject(null);
      resetSubProjForm();
      toast({ title: 'Sub-project Updated', description: 'Changes were saved.' });
    },
    onError: (err) => {
      toast({
        title: 'Could not update sub-project',
        description: err?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const deleteSubProjectMutation = useMutation({
    mutationFn: (id) => base44.entities.SubProject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subprojects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['flats', project.id] });
      toast({ title: 'Sub-project Deleted' });
    },
    onError: (err) => {
      toast({
        title: 'Could not delete sub-project',
        description: err?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const openAddSubProject = () => {
    setEditSubProject(null);
    resetSubProjForm();
    setShowSubProjectModal(true);
  };

  const openEditSubProject = (sp) => {
    setEditSubProject(sp);
    setSubProjForm({
      name: sp.name || '',
      built_up_area: sp.built_up_area ?? '',
      floors_count: sp.floors_count != null && sp.floors_count !== '' ? String(sp.floors_count) : '',
      flats_per_floor: sp.flats_per_floor != null && sp.flats_per_floor !== '' ? String(sp.flats_per_floor) : '',
    });
    setShowSubProjectModal(true);
  };

  const handleSubProjectSubmit = () => {
    if (!subProjForm.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a sub-project name.',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      project_id: project.id,
      name: subProjForm.name.trim(),
      built_up_area: subProjForm.built_up_area !== '' ? parseFloat(subProjForm.built_up_area) || 0 : 0,
      floors_count: subProjForm.floors_count !== '' ? parseInt(subProjForm.floors_count, 10) || 0 : 0,
      flats_per_floor: subProjForm.flats_per_floor !== '' ? parseInt(subProjForm.flats_per_floor, 10) || 0 : 0,
    };
    if (editSubProject) {
      updateSubProjectMutation.mutate({ id: editSubProject.id, data: payload });
    } else {
      createSubProjectMutation.mutate(payload);
    }
  };

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
                <p className="text-sm text-muted-foreground">
                  {project.project_code ? `Code: ${project.project_code} · ` : ''}
                  {project.location || 'No Location Set'} · {project.client || 'No Client Set'}
                  {project.project_type && (
                    <> · <span className="font-medium text-foreground">{getProjectTypeLabel(project.project_type)}</span></>
                  )}
                </p>
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
        <TabsList className="grid w-full grid-cols-3 max-w-[560px]">
          <TabsTrigger value="milestones" className="gap-2">
            <Target className="w-4 h-4" /> Milestones
          </TabsTrigger>
          <TabsTrigger value="subprojects" className="gap-2">
            <Building2 className="w-4 h-4" /> Sub Projects
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-2">
            <Settings className="w-4 h-4" /> Settings
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

        {/* 2. Sub Projects Tab */}
        <TabsContent value="subprojects" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-heading font-semibold">Sub Projects</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Assign one or more sub-projects (towers, blocks, phases) to this project.
              </p>
            </div>
            <Button size="sm" className="gap-2" onClick={openAddSubProject}>
              <Plus className="w-4 h-4" /> Add Sub Project
            </Button>
          </div>

          {loadingSubProjects ? (
            <p className="text-center text-sm text-muted-foreground py-12">Loading sub-projects...</p>
          ) : subProjects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium">No sub-projects yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Add towers, blocks, or packages linked to this project.
                </p>
                <Button size="sm" className="gap-2" onClick={openAddSubProject}>
                  <Plus className="w-4 h-4" /> Add Sub Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {subProjects.map((sp) => (
                <Card key={sp.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{sp.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(sp.floors_count || 0)} floors · {(sp.flats_per_floor || 0)} flats/floor
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSubProject(sp)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Delete sub-project "${sp.name}" and its flat breakdown?`)) {
                              deleteSubProjectMutation.mutate(sp.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-muted-foreground">Built-up Area</p>
                        <p className="font-semibold mt-0.5">{Number(sp.built_up_area || 0).toLocaleString()} sqft</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-muted-foreground">Total Flats</p>
                        <p className="font-semibold mt-0.5">{(sp.floors_count || 0) * (sp.flats_per_floor || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. Admin Settings Tab */}
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
                      <Label>Project Code</Label>
                      <Input
                        value={projectForm.project_code || ''}
                        onChange={e => setProjectForm({ ...projectForm, project_code: e.target.value })}
                        placeholder="e.g. PRJ-001"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <Label>Project Type *</Label>
                      <Select
                        value={projectForm.project_type || undefined}
                        onValueChange={(v) => setProjectForm({ ...projectForm, project_type: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select project type" /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Project Manager</Label>
                      <Input 
                        value={projectForm.project_manager || ''} 
                        onChange={e => setProjectForm({ ...projectForm, project_manager: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Location</Label>
                    <Input 
                      value={projectForm.location || ''} 
                      onChange={e => setProjectForm({ ...projectForm, location: e.target.value })} 
                    />
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

                  <div>
                    <Label>Elevation Photo</Label>
                    {(elevationPhotoPreview || projectForm.elevation_photo_url) ? (
                      <div className="relative mt-1 rounded-lg border overflow-hidden">
                        <img
                          src={elevationPhotoPreview || projectForm.elevation_photo_url}
                          alt="Elevation"
                          className="w-full h-40 object-cover"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={handleRemoveElevationPhoto}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <label
                          htmlFor="edit-elevation-photo-input"
                          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 text-white text-[11px] px-2 py-1 cursor-pointer hover:bg-black/70 transition-colors"
                        >
                          <ImagePlus className="w-3 h-3" /> Replace
                        </label>
                      </div>
                    ) : (
                      <label
                        htmlFor="edit-elevation-photo-input"
                        className="mt-1 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <ImagePlus className="w-5 h-5" />
                        Click to upload building elevation photo
                      </label>
                    )}
                    <input
                      id="edit-elevation-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleElevationPhotoChange}
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full gap-2 bg-primary text-white"
                    onClick={handleSaveProjectDetails}
                    disabled={updateProjectMutation.isPending || uploadingElevationPhoto || !projectForm.name?.trim()}
                  >
                    <Save className="w-4 h-4" />
                    {uploadingElevationPhoto ? 'Uploading Photo...' : updateProjectMutation.isPending ? 'Saving...' : 'Save Project Details'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Side: Assigned Users config */}
            <div className="space-y-6">
              
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

      <Dialog open={showSubProjectModal} onOpenChange={(open) => {
        setShowSubProjectModal(open);
        if (!open) {
          setEditSubProject(null);
          resetSubProjForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editSubProject ? 'Edit Sub Project' : 'Add Sub Project'}</DialogTitle>
            <DialogDescription>
              Sub-projects are linked to this project only. You can add multiple towers, blocks, or packages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Sub-project Name *</Label>
              <Input
                value={subProjForm.name}
                onChange={(e) => setSubProjForm({ ...subProjForm, name: e.target.value })}
                placeholder="e.g. Tower A, Block B, Phase 1"
              />
            </div>
            <div>
              <Label>Built-up Area (sqft)</Label>
              <Input
                type="number"
                value={subProjForm.built_up_area}
                onChange={(e) => setSubProjForm({ ...subProjForm, built_up_area: e.target.value })}
                placeholder="e.g. 50000"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Floors</Label>
                <Input
                  type="number"
                  value={subProjForm.floors_count}
                  onChange={(e) => setSubProjForm({ ...subProjForm, floors_count: e.target.value })}
                />
              </div>
              <div>
                <Label>Flats per Floor</Label>
                <Input
                  type="number"
                  value={subProjForm.flats_per_floor}
                  onChange={(e) => setSubProjForm({ ...subProjForm, flats_per_floor: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubProjectModal(false)}>Cancel</Button>
            <Button
              onClick={handleSubProjectSubmit}
              disabled={
                !subProjForm.name.trim() ||
                createSubProjectMutation.isPending ||
                updateSubProjectMutation.isPending
              }
            >
              {editSubProject ? 'Save Changes' : 'Add Sub Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}