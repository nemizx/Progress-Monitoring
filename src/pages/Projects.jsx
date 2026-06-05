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
import { Plus, Search, MapPin, Calendar, IndianRupee } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import ProgressRing from '@/components/shared/ProgressRing';
import EmptyState from '@/components/shared/EmptyState';
import ProjectDetail from '@/components/projects/ProjectDetail';
import { formatCompactCurrencyINR } from '@/lib/formatters';

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', location: '', client: '', status: 'planning', start_date: '', end_date: '', budget: '', project_manager: '', priority: 'medium' });

  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); resetForm(); },
  });

  const resetForm = () => setForm({ name: '', description: '', location: '', client: '', status: 'planning', start_date: '', end_date: '', budget: '', project_manager: '', priority: 'medium' });

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase());
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
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Project details..." rows={3} />
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
              <Button className="w-full" onClick={() => createMutation.mutate({...form, budget: form.budget || 0})} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Project'}
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
              className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group"
              onClick={() => setSelectedProject(project)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-heading truncate group-hover:text-accent transition-colors">{project.name}</CardTitle>
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