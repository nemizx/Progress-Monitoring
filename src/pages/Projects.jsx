import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, MapPin, Calendar, IndianRupee, ImagePlus, X, Pencil, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import ProgressRing from '@/components/shared/ProgressRing';
import EmptyState from '@/components/shared/EmptyState';
import ProjectDetail from '@/components/projects/ProjectDetail';
import { formatCompactCurrencyINR } from '@/lib/formatters';
import { PROJECT_TYPES, getProjectTypeLabel } from '@/lib/projectTypes';
import { COMPANIES } from '@/lib/companies';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function Projects() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [tempSubProjects, setTempSubProjects] = useState([]);
  const [newSubProjectName, setNewSubProjectName] = useState('');
  const [validationError, setValidationError] = useState('');
  
  const [editingSubProjectIndex, setEditingSubProjectIndex] = useState(null);
  const [editingSubProjectName, setEditingSubProjectName] = useState('');
  const [showConfirmLeaveDialog, setShowConfirmLeaveDialog] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState(null);

  const [form, setForm] = useState({
    name: '', description: '', location: '', client: '', status: 'planning',
    start_date: '', end_date: '', budget: '', project_manager: '', priority: 'medium',
    project_type: '', project_code: '',
  });
  const [elevationPhotoFile, setElevationPhotoFile] = useState(null);
  const [elevationPhotoPreview, setElevationPhotoPreview] = useState('');
  const [uploadingElevationPhoto, setUploadingElevationPhoto] = useState(false);

  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const { data: allSubProjects = [] } = useQuery({
    queryKey: ['subprojects-all'],
    queryFn: () => base44.entities.SubProject.list('-created_date', 1000),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, projectData, subProjectChanges }) =>
      base44.projects.saveWithSubprojects(id, projectData, subProjectChanges),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['subprojects-all'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setForm({
      name: '', description: '', location: '', client: '', status: 'planning',
      start_date: '', end_date: '', budget: '', project_manager: '', priority: 'medium',
      project_type: '', project_code: '',
    });
    setElevationPhotoFile(null);
    setElevationPhotoPreview('');
    setEditingProjectId(null);
    setTempSubProjects([]);
    setNewSubProjectName('');
    setValidationError('');
    setEditingSubProjectIndex(null);
    setEditingSubProjectName('');
    setShowConfirmLeaveDialog(false);
    setPendingNavigationAction(null);
  };

  const handleElevationPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setElevationPhotoFile(file);
    setElevationPhotoPreview(URL.createObjectURL(file));
  };

  const isFormDirty = useMemo(() => {
    if (!editingProjectId) {
      return (form.name?.trim() !== '' || form.project_code?.trim() !== '') || tempSubProjects.length > 0;
    }

    const originalProject = projects.find(p => p.id === editingProjectId);
    if (!originalProject) return false;

    const formFieldsChanged = 
      (form.name || '') !== (originalProject.name || '') ||
      (form.description || '') !== (originalProject.description || '') ||
      (form.location || '') !== (originalProject.location || '') ||
      (form.client || '') !== (originalProject.client || '') ||
      (form.status || 'planning') !== (originalProject.status || 'planning') ||
      (form.start_date || '') !== (originalProject.start_date || '') ||
      (form.end_date || '') !== (originalProject.end_date || '') ||
      (parseFloat(form.budget) || 0) !== (parseFloat(originalProject.budget) || 0) ||
      (form.project_manager || '') !== (originalProject.project_manager || '') ||
      (form.priority || 'medium') !== (originalProject.priority || 'medium') ||
      (form.project_type || 'residential') !== (originalProject.project_type || 'residential') ||
      (form.project_code || '') !== (originalProject.project_code || '') ||
      (form.elevation_photo_url || '') !== (originalProject.elevation_photo_url || '') ||
      elevationPhotoFile !== null;

    const subprojectsModified = tempSubProjects.some(sp => sp.status === 'added' || sp.status === 'updated' || sp.status === 'deleted');

    return formFieldsChanged || subprojectsModified;
  }, [form, editingProjectId, projects, tempSubProjects, elevationPhotoFile]);

  const handleStartSubProjectRename = (index, currentName) => {
    setEditingSubProjectIndex(index);
    setEditingSubProjectName(currentName);
  };

  const handleSaveSubProjectRename = (index) => {
    const trimmed = editingSubProjectName.trim();
    if (!trimmed) {
      setEditingSubProjectIndex(null);
      return;
    }
    setTempSubProjects(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return {
        ...item,
        name: trimmed,
        status: item.status === 'added' ? 'added' : 'updated'
      };
    }));
    setEditingSubProjectIndex(null);
  };

  const handleDeleteSubProject = (index) => {
    setTempSubProjects(prev => {
      const item = prev[index];
      if (item.status === 'added') {
        return prev.filter((_, i) => i !== index);
      } else {
        return prev.map((it, i) => i === index ? { ...it, status: 'deleted' } : it);
      }
    });
  };

  const handleSave = async () => {
    setValidationError('');

    if (!form.project_code || !form.project_code.trim()) {
      setValidationError('Project Code is required.');
      return;
    }

    if (!form.name || !form.name.trim()) {
      setValidationError('Project Name is required.');
      return;
    }

    if (!form.client || !form.client.trim()) {
      setValidationError('Name of Company is required.');
      return;
    }

    if (!form.project_type || !form.project_type.trim()) {
      setValidationError('Project Type is required.');
      return;
    }

    // Uniqueness validation on project code (case-insensitive)
    const isDuplicateCode = projects.some(
      p => p.project_code?.trim().toLowerCase() === form.project_code.trim().toLowerCase() && p.id !== editingProjectId
    );
    if (isDuplicateCode) {
      setValidationError('Project Code must be unique. A project with this code already exists.');
      return;
    }

    let elevation_photo_url = form.elevation_photo_url || elevationPhotoPreview || '';
    if (elevationPhotoFile) {
      setUploadingElevationPhoto(true);
      try {
        const res = await base44.integrations.Core.UploadFile({ file: elevationPhotoFile });
        elevation_photo_url = res.file_url || '';
      } catch (err) {
        console.error('Failed to upload logo:', err);
      } finally {
        setUploadingElevationPhoto(false);
      }
    }

    const payload = {
      ...form,
      project_code: form.project_code.trim(),
      name: form.name.trim(),
      client: form.client.trim(),
      project_type: form.project_type,
      budget: form.budget || 0,
      elevation_photo_url,
    };

    const added = tempSubProjects.filter(sp => sp.status === 'added').map(sp => ({ name: sp.name }));
    const updated = tempSubProjects.filter(sp => sp.status === 'updated').map(sp => ({ id: sp.id, name: sp.name }));
    const deleted = tempSubProjects.filter(sp => sp.status === 'deleted').map(sp => ({ id: sp.id }));

    const subProjectChanges = { added, updated, deleted };

    try {
      await saveMutation.mutateAsync({
        id: editingProjectId,
        projectData: payload,
        subProjectChanges
      });
    } catch (e) {
      setValidationError(e.message || 'Failed to save project. Transaction rolled back.');
    }
  };

  const handleEditClick = (project) => {
    setEditingProjectId(project.id);
    setForm({
      name: project.name || '',
      description: project.description || '',
      location: project.location || '',
      client: project.client || '',
      status: project.status || 'planning',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      budget: project.budget || '',
      project_manager: project.project_manager || '',
      priority: project.priority || 'medium',
      project_type: project.project_type || 'residential',
      project_code: project.project_code || '',
    });
    setElevationPhotoPreview(project.elevation_photo_url || '');
    setElevationPhotoFile(null);
    setValidationError('');
    
    // Load subprojects
    const subs = allSubProjects
      .filter(sp => sp.project_id === project.id)
      .map(sp => ({
        id: sp.id,
        name: sp.name,
        status: 'existing'
      }));
    setTempSubProjects(subs);
    setNewSubProjectName('');
  };

  const handleEditClickWithCheck = (project) => {
    if (isFormDirty) {
      setPendingNavigationAction(() => () => handleEditClick(project));
      setShowConfirmLeaveDialog(true);
    } else {
      handleEditClick(project);
    }
  };

  const handleCancelEditWithCheck = () => {
    if (isFormDirty) {
      setPendingNavigationAction(() => () => resetForm());
      setShowConfirmLeaveDialog(true);
    } else {
      resetForm();
    }
  };

  const handleSelectProjectWithCheck = (project) => {
    if (isFormDirty) {
      setPendingNavigationAction(() => () => setSelectedProject(project));
      setShowConfirmLeaveDialog(true);
    } else {
      setSelectedProject(project);
    }
  };

  const filtered = projects
    .filter(p => {
      if (!user || user.role === 'admin') return true;
      const matchCompany = !user.company_access || p.client === user.company_access;
      const matchProject = !user.project_access_id || p.id === user.project_access_id;
      return matchCompany && matchProject;
    })
    .filter(p => {
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
    <div className="bg-[#f5f3ef] min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight text-slate-800">Project master</h1>
      </div>

      {/* Card 1: Create/Edit Project Form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-lg font-heading font-bold text-slate-800">
            {editingProjectId ? 'Edit Project Details' : 'Create New Project'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-500">
              {editingProjectId ? `Editing: ${form.project_code || 'PRJ'}` : 'No project selected'}
            </span>
            {editingProjectId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEditWithCheck}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50/50 h-7 px-2"
              >
                Cancel Edit
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Project Details */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name of Company */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Name of Company *</Label>
                <Select
                  value={form.client}
                  onValueChange={v => setForm({ ...form, client: v })}
                >
                  <SelectTrigger className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm">
                    <SelectValue placeholder="< select >" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Project Type *</Label>
                <Select
                  value={form.project_type}
                  onValueChange={v => setForm({ ...form, project_type: v })}
                >
                  <SelectTrigger className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm">
                    <SelectValue placeholder="< select >" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Project Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                />
              </div>

              {/* Project Code */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Project Code *</Label>
                <Input
                  value={form.project_code}
                  onChange={e => setForm({ ...form, project_code: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Location</Label>
                <Input
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                />
              </div>

              {/* Project Manager */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Project Manager</Label>
                <Input
                  value={form.project_manager}
                  onChange={e => setForm({ ...form, project_manager: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                />
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                />
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Budget</Label>
                <Input
                  type="number"
                  value={form.budget}
                  onChange={e => setForm({ ...form, budget: parseFloat(e.target.value) || '' })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={v => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Notes</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm resize-none"
                />
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600 font-medium">
                {validationError}
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={handleSave}
                disabled={!isFormDirty || saveMutation.isPending || uploadingElevationPhoto}
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-medium px-6 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                {uploadingElevationPhoto
                  ? 'Uploading Logo...'
                  : editingProjectId
                    ? (saveMutation.isPending ? 'Updating...' : 'Update Project')
                    : (saveMutation.isPending ? 'Saving...' : 'Save Project')}
              </Button>
            </div>
          </div>

          {/* Right Column: Logo & Sub-projects */}
          <div className="space-y-6 lg:border-l lg:pl-8 border-slate-100">
            {/* Logo Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Logo</h3>
              <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50/50 min-h-[140px] text-center">
                {elevationPhotoPreview || form.elevation_photo_url ? (
                  <div className="relative w-24 h-24 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <img src={elevationPhotoPreview || form.elevation_photo_url} alt="Logo" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-sm transition-colors"
                      onClick={() => {
                        setElevationPhotoFile(null);
                        setElevationPhotoPreview('');
                        setForm({ ...form, elevation_photo_url: '' });
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 flex flex-col items-center">
                    <p className="text-xs text-slate-400 max-w-[180px]">Select a logo image file to upload. Max 5 MB.</p>
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium bg-white text-slate-600 shadow-sm hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <ImagePlus className="w-3.5 h-3.5 text-slate-400" />
                      Choose Logo Image
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleElevationPhotoChange}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sub-projects Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sub-Projects</h3>

              <div className="min-h-[120px] max-h-[200px] overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/30 p-3 space-y-2">
                {tempSubProjects.filter(sp => sp.status !== 'deleted').length > 0 ? (
                  tempSubProjects.filter(sp => sp.status !== 'deleted').map((sp) => {
                    const realIndex = tempSubProjects.findIndex(item => item === sp);
                    return (
                      <div key={sp.id || realIndex} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-100 shadow-xs text-xs">
                        {editingSubProjectIndex === realIndex ? (
                          <input
                            type="text"
                            value={editingSubProjectName}
                            onChange={e => setEditingSubProjectName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveSubProjectRename(realIndex);
                              if (e.key === 'Escape') setEditingSubProjectIndex(null);
                            }}
                            onBlur={() => handleSaveSubProjectRename(realIndex)}
                            autoFocus
                            className="flex-1 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:ring-0 rounded px-1.5 py-0.5 text-xs text-slate-800"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{sp.name}</span>
                            {sp.status === 'added' && (
                              <span className="text-[9px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1 rounded">Unsaved</span>
                            )}
                            {sp.status === 'updated' && (
                              <span className="text-[9px] font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20 px-1 rounded">Modified</span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          {editingSubProjectIndex !== realIndex && (
                            <button
                              type="button"
                              onClick={() => handleStartSubProjectRename(realIndex, sp.name)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSubProject(realIndex)}
                            className="text-rose-500 hover:text-rose-700 p-0.5 rounded-md hover:bg-rose-50/50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center py-8">
                    <span className="text-xs text-slate-400 italic">No sub-projects added yet.</span>
                  </div>
                )}
              </div>
 
              <div className="flex gap-2 items-end pt-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] font-semibold text-slate-500">New sub-project</Label>
                  <Input
                    value={newSubProjectName}
                    onChange={e => setNewSubProjectName(e.target.value)}
                    className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-xs h-9"
                    placeholder="e.g. Tower B"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const name = newSubProjectName.trim();
                        if (!name) return;
                        setTempSubProjects([...tempSubProjects, { name, status: 'added' }]);
                        setNewSubProjectName('');
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={() => {
                    const name = newSubProjectName.trim();
                    if (!name) return;
                    setTempSubProjects([...tempSubProjects, { name, status: 'added' }]);
                    setNewSubProjectName('');
                  }}
                  className="bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold px-4 h-9 rounded-lg transition-colors"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Created Projects Table List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-slate-800">Created Projects</h2>
            <p className="text-xs text-slate-400 mt-1">Showing {filtered.length} of {projects.length} projects</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9 bg-slate-50 border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-xs h-9"
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 bg-slate-50 border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-xs h-9">
                <SelectValue />
              </SelectTrigger>
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
        </div>

        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-3 w-16 text-center">Logo</th>
                  <th className="p-3">Project Name</th>
                  <th className="p-3 w-32">Code</th>
                  <th className="p-3">Project Manager</th>
                  <th className="p-3">Name of Company</th>
                  <th className="p-3 w-36 text-center">Sub-Projects</th>
                  <th className="p-3 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(project => {
                  const subCount = allSubProjects.filter(sp => sp.project_id === project.id).length;
                  return (
                    <tr
                      key={project.id}
                      onClick={() => handleEditClickWithCheck(project)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors text-xs"
                    >
                      {/* Logo */}
                      <td className="p-3 text-center">
                        <div className="w-10 h-10 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden mx-auto flex items-center justify-center shadow-xs">
                          {project.elevation_photo_url ? (
                            <img src={project.elevation_photo_url} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <ImagePlus className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      </td>
 
                      {/* Project Name */}
                      <td className="p-3 font-semibold text-slate-800">
                        <span className="hover:underline hover:text-slate-900">
                          {project.name}
                        </span>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <StatusBadge status={project.status} className="scale-90 origin-left" />
                          <StatusBadge status={project.priority} className="scale-90 origin-left" />
                        </div>
                      </td>
 
                      {/* Code */}
                      <td className="p-3 font-mono">
                        {project.project_code ? (
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium text-[10px]">
                            {project.project_code}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
 
                      {/* Project Manager */}
                      <td className="p-3 text-slate-600">
                        {project.project_manager || <span className="text-slate-300">—</span>}
                      </td>
 
                      {/* Client */}
                      <td className="p-3 text-slate-600">
                        {project.client || <span className="text-slate-300">—</span>}
                      </td>
 
                      {/* Sub-Projects count pill */}
                      <td className="p-3 text-center">
                        <span className="px-3 py-1 rounded-full border border-slate-100 bg-slate-50 text-slate-600 font-medium text-[10px]">
                          {subCount} {subCount === 1 ? 'sub-project' : 'sub-projects'}
                        </span>
                      </td>
 
                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProjectWithCheck(project);
                            }}
                            className="h-7 px-2.5 text-[10px] font-semibold border-slate-200 hover:bg-slate-50 hover:text-slate-800 text-slate-600 rounded-md"
                          >
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={isLoading ? null : undefined}
            title={isLoading ? 'Loading projects...' : 'No projects found'}
            description={isLoading ? '' : "Try adjusting your search filters or create a new project above."}
          />
        )}
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog open={showConfirmLeaveDialog} onOpenChange={setShowConfirmLeaveDialog}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-slate-100 rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-bold text-base font-heading">You have unsaved Project changes.</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-2 leading-relaxed">
              This includes Project information and Sub Project changes. Do you want to save before leaving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmLeaveDialog(false);
                setPendingNavigationAction(null);
              }}
              className="text-xs font-semibold h-9 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmLeaveDialog(false);
                if (pendingNavigationAction) {
                  pendingNavigationAction();
                  setPendingNavigationAction(null);
                }
              }}
              className="text-xs font-semibold h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200"
            >
              Discard
            </Button>
            <Button
              onClick={async () => {
                setShowConfirmLeaveDialog(false);
                await handleSave();
                if (pendingNavigationAction) {
                  pendingNavigationAction();
                  setPendingNavigationAction(null);
                }
              }}
              className="text-xs font-semibold h-9 bg-slate-800 hover:bg-slate-900 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}