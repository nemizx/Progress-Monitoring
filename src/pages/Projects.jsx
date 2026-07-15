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
import { Plus, Search, MapPin, Calendar, IndianRupee, ImagePlus, X } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import ProgressRing from '@/components/shared/ProgressRing';
import EmptyState from '@/components/shared/EmptyState';
import ProjectDetail from '@/components/projects/ProjectDetail';
import { formatCompactCurrencyINR } from '@/lib/formatters';
import { PROJECT_TYPES, getProjectTypeLabel } from '@/lib/projectTypes';

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', location: '', client: '', status: 'planning',
    start_date: '', end_date: '', budget: '', project_manager: '', priority: 'medium',
    project_type: 'residential', project_code: '',
  });
  const [elevationPhotoFile, setElevationPhotoFile] = useState(null);
  const [elevationPhotoPreview, setElevationPhotoPreview] = useState('');
  const [uploadingElevationPhoto, setUploadingElevationPhoto] = useState(false);

  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); resetForm(); },
  });

  const resetForm = () => {
    setForm({
      name: '', description: '', location: '', client: '', status: 'planning',
      start_date: '', end_date: '', budget: '', project_manager: '', priority: 'medium',
      project_type: 'residential', project_code: '',
    });
    setElevationPhotoFile(null);
    setElevationPhotoPreview('');
  };

  const handleElevationPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setElevationPhotoFile(file);
    setElevationPhotoPreview(URL.createObjectURL(file));
  };

  const handleCreateProject = async () => {
    let elevation_photo_url = '';
    if (elevationPhotoFile) {
      setUploadingElevationPhoto(true);
      try {
        const res = await base44.integrations.Core.UploadFile({ file: elevationPhotoFile });
        elevation_photo_url = res.file_url || '';
      } finally {
        setUploadingElevationPhoto(false);
      }
    }
    createMutation.mutate({ ...form, budget: form.budget || 0, elevation_photo_url });
  };

  const filtered = projects.filter(p => {
    const query = search.toLowerCase();
    const matchSearch = !search
      || p.name?.toLowerCase().includes(query)
      || p.location?.toLowerCase().includes(query)
      || p.project_code?.toLowerCase().includes(query);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (selectedProject) {
    const currentProject = projects.find(p => p.id === selectedProject.id) || selectedProject;
    return <ProjectDetail project={currentProject} onBack={() => setSelectedProject(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and monitor all construction projects</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Project Name *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Tower Block A" />
              </div>
              <div>
                <Label>Project Code</Label>
                <Input value={form.project_code} onChange={e => setForm({...form, project_code: e.target.value})} placeholder="e.g. PRJ-001" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Project details..." rows={3} />
              </div>
              <div>
                <Label>Project Type *</Label>
                <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select project type" /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Location</Label>
                  <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="City, Area" />
                </div>
                <div>
                  <Label>Client</Label>
                  <Input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Client name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Budget</Label>
                  <Input type="number" value={form.budget} onChange={e => setForm({...form, budget: parseFloat(e.target.value) || ''})} placeholder="0.00" />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Project Manager</Label>
                <Input value={form.project_manager} onChange={e => setForm({...form, project_manager: e.target.value})} placeholder="Name" />
              </div>
              <div>
                <Label>Elevation Photo</Label>
                {elevationPhotoPreview ? (
                  <div className="relative mt-1 rounded-lg border overflow-hidden">
                    <img src={elevationPhotoPreview} alt="Elevation preview" className="w-full h-40 object-cover" />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => { setElevationPhotoFile(null); setElevationPhotoPreview(''); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="create-elevation-photo-input"
                    className="mt-1 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <ImagePlus className="w-5 h-5" />
                    Click to upload building elevation photo
                  </label>
                )}
                <input
                  id="create-elevation-photo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleElevationPhotoChange}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreateProject}
                disabled={!form.name || !form.project_type || createMutation.isPending || uploadingElevationPhoto}
              >
                {uploadingElevationPhoto ? 'Uploading Photo...' : createMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="delayed">Delayed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group overflow-hidden"
              onClick={() => setSelectedProject(project)}
            >
              {project.elevation_photo_url && (
                <img
                  src={project.elevation_photo_url}
                  alt={`${project.name} elevation`}
                  className="w-full h-32 object-cover"
                />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-heading truncate group-hover:text-accent transition-colors">{project.name}</CardTitle>
                    {project.project_code && (
                      <p className="text-xs text-muted-foreground mt-0.5">Code: {project.project_code}</p>
                    )}
                    {project.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {project.location}
                      </p>
                    )}
                  </div>
                  <ProgressRing value={project.progress || 0} size={40} strokeWidth={3} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={project.status} />
                  <StatusBadge status={project.priority} />
                  {project.project_type && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border">
                      {getProjectTypeLabel(project.project_type)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  {project.start_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {project.start_date}
                    </div>
                  )}
                  {project.budget > 0 && (
                    <div className="flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" /> {formatCompactCurrencyINR(project.budget)}
                    </div>
                  )}
                </div>
                {project.client && <p className="text-xs text-muted-foreground">Client: {project.client}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState 
          icon={isLoading ? null : undefined}
          title={isLoading ? 'Loading projects...' : 'No projects found'} 
          description={isLoading ? '' : "Create your first construction project to start tracking progress."} 
          actionLabel={isLoading ? undefined : "New Project"}
          onAction={isLoading ? undefined : () => setShowCreate(true)}
        />
      )}
    </div>
  );
}