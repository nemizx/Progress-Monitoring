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
import { Plus, MessageSquare, AlertTriangle, Calendar, PenTool, Wind, Shield, FileText, Trash2, Pencil, Clock } from 'lucide-react';
import { format } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';
import { filterActivitiesBySubProject } from '@/lib/subProjectScope';

const CATEGORIES = {
  schedule_change: { label: 'Schedule Change', icon: Calendar, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  design_change: { label: 'Design Change', icon: PenTool, color: 'bg-purple-100 text-purple-700 border-purple-300' },
  site_issue: { label: 'Site Issue', icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-300' },
  noise_factor: { label: 'Noise Factor', icon: Wind, color: 'bg-blue-100 text-blue-700 border-blue-300' },
  risk: { label: 'Risk', icon: Shield, color: 'bg-orange-100 text-orange-700 border-orange-300' },
  other: { label: 'Other', icon: FileText, color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const POST_CATEGORIES = {
  daily_report: { label: 'Daily Report', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  difficulty: { label: 'Difficulty', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  schedule_change: { label: 'Schedule', icon: Calendar, color: 'bg-amber-100 text-amber-700' },
  design_change: { label: 'Design', icon: PenTool, color: 'bg-purple-100 text-purple-700' },
  safety: { label: 'Safety', icon: Shield, color: 'bg-orange-100 text-orange-700' },
  milestone_update: { label: 'Milestone', icon: Clock, color: 'bg-emerald-100 text-emerald-700' },
  general: { label: 'General', icon: MessageSquare, color: 'bg-slate-100 text-slate-700' },
};

export default function ChangeComms() {
  const {
    projects, subProjects, wbsItems, projectId, subProjectId,
    setProjectId, setSubProjectId, isReady,
  } = useProjectSubProject({ fetchWbs: true });

  const [activeTab, setActiveTab] = useState('changes');
  const [showAddChange, setShowAddChange] = useState(false);
  const [showAddPost, setShowAddPost] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [changeForm, setChangeForm] = useState({ project_id: '', activity_id: '', title: '', category: 'site_issue', description: '', impact_days: 0, impact_cost: 0, severity: 'medium', status: 'open', raised_by: '', assigned_to: '' });
  const [postForm, setPostForm] = useState({ project_id: '', category: 'general', title: '', content: '', priority: 'normal', author_name: '' });

  const queryClient = useQueryClient();
  const { data: allChanges = [] } = useQuery({
    queryKey: ['changes', projectId],
    queryFn: () => projectId ? base44.entities.ChangeEvent.filter({ project_id: projectId }, '-created_date', 200) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: allPosts = [] } = useQuery({
    queryKey: ['collab-posts', projectId],
    queryFn: () => projectId ? base44.entities.CollaborationPost.filter({ project_id: projectId }, '-created_date', 100) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: allActivities = [] } = useQuery({
    queryKey: ['schedule-activities', projectId],
    queryFn: () => projectId ? base44.entities.ScheduleActivity.filter({ project_id: projectId }) : Promise.resolve([]),
    enabled: !!projectId,
  });

  const activities = isReady ? filterActivitiesBySubProject(allActivities, wbsItems, subProjectId) : [];
  const changes = isReady ? allChanges : [];
  const posts = isReady ? allPosts : [];

  const createChangeMutation = useMutation({
    mutationFn: (data) => base44.entities.ChangeEvent.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['changes'] }); setShowAddChange(false); },
  });
  const updateChangeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChangeEvent.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changes'] }),
  });
  const deleteChangeMutation = useMutation({
    mutationFn: (id) => base44.entities.ChangeEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changes'] }),
  });
  const createPostMutation = useMutation({
    mutationFn: (data) => base44.entities.CollaborationPost.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['collab-posts'] }); setShowAddPost(false); setPostForm({ project_id: '', category: 'general', title: '', content: '', priority: 'normal', author_name: '' }); },
  });
  const deletePostMutation = useMutation({
    mutationFn: (id) => base44.entities.CollaborationPost.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collab-posts'] }),
  });

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || '';
  const filteredChanges = catFilter === 'all' ? changes : changes.filter(c => c.category === catFilter);
  const filteredPosts = catFilter === 'all' ? posts : posts.filter(p => p.category === catFilter);

  const openChanges = changes.filter(c => c.status === 'open').length;
  const totalImpactDays = changes.reduce((s, c) => s + (c.impact_days || 0), 0);
  const totalImpactCost = changes.reduce((s, c) => s + (c.impact_cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Collaboration & Communication</h1>
          <p className="text-sm text-muted-foreground mt-1">Change events, discussions, and team communication hub</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'changes' && <Button className="gap-2" disabled={!isReady} onClick={() => setShowAddChange(true)}><Plus className="w-4 h-4" /> Log Change</Button>}
          {activeTab === 'feed' && <Button className="gap-2" disabled={!isReady} onClick={() => setShowAddPost(true)}><Plus className="w-4 h-4" /> New Post</Button>}
        </div>
      </div>

      <ProjectSubProjectSelector
        projects={projects}
        subProjects={subProjects}
        projectId={projectId}
        subProjectId={subProjectId}
        onProjectChange={setProjectId}
        onSubProjectChange={setSubProjectId}
      />

      <SubProjectGate projectId={projectId} subProjectId={subProjectId} subProjects={subProjects}>
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-2xl font-bold">{openChanges}</div><div className="text-xs text-muted-foreground mt-1">Open Changes</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold text-amber-600">{totalImpactDays}d</div><div className="text-xs text-muted-foreground mt-1">Total Schedule Impact</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold">${totalImpactCost.toLocaleString()}</div><div className="text-xs text-muted-foreground mt-1">Cost Impact</div></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="changes">Change Events</TabsTrigger>
          <TabsTrigger value="feed">Team Feed</TabsTrigger>
        </TabsList>

        {/* Changes Tab */}
        <TabsContent value="changes" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant={catFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCatFilter('all')}>All</Button>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <Button key={key} variant={catFilter === key ? 'default' : 'outline'} size="sm" onClick={() => setCatFilter(key)} className="gap-1.5">
                <cat.icon className="w-3.5 h-3.5" />{cat.label}
              </Button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredChanges.map(change => {
              const cat = CATEGORIES[change.category] || CATEGORIES.other;
              return (
                <Card key={change.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${cat.color}`}>
                        <cat.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{change.title}</p>
                            <p className="text-xs text-muted-foreground">{getProjectName(change.project_id)} · Raised by {change.raised_by || 'Unknown'} · {change.created_date ? format(new Date(change.created_date), 'MMM d') : ''}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Select value={change.status} onValueChange={v => updateChangeMutation.mutate({ id: change.id, data: { status: v } })}>
                              <SelectTrigger className="w-28 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['open','under_review','resolved','rejected'].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteChangeMutation.mutate(change.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{change.description}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <StatusBadge status={change.severity} />
                          <StatusBadge status={change.status} />
                          {change.impact_days > 0 && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">⏱ +{change.impact_days}d impact</Badge>}
                          {change.impact_cost > 0 && <Badge variant="outline" className="text-[10px]">💰 ${change.impact_cost.toLocaleString()}</Badge>}
                        </div>
                        {change.resolution && <p className="text-xs bg-emerald-50 text-emerald-800 rounded p-2 mt-2 border border-emerald-200">✓ {change.resolution}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredChanges.length === 0 && <EmptyState icon={AlertTriangle} title="No change events" description="Track schedule changes, design revisions, and site issues." actionLabel="Log Change" onAction={() => setShowAddChange(true)} />}
          </div>
        </TabsContent>

        {/* Feed Tab */}
        <TabsContent value="feed" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant={catFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCatFilter('all')}>All</Button>
            {Object.entries(POST_CATEGORIES).map(([key, cat]) => (
              <Button key={key} variant={catFilter === key ? 'default' : 'outline'} size="sm" onClick={() => setCatFilter(key)} className="gap-1.5">
                <cat.icon className="w-3.5 h-3.5" />{cat.label}
              </Button>
            ))}
          </div>
          {filteredPosts.map(post => {
            const cat = POST_CATEGORIES[post.category] || POST_CATEGORIES.general;
            return (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
                      <cat.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{post.title}</p>
                          <p className="text-xs text-muted-foreground">{post.author_name || 'Anonymous'} · {getProjectName(post.project_id)} · {post.created_date ? format(new Date(post.created_date), 'MMM d, h:mm a') : ''}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {post.priority === 'urgent' && <Badge variant="destructive" className="text-[10px]">URGENT</Badge>}
                          {post.priority === 'high' && <Badge className="text-[10px] bg-amber-100 text-amber-700">HIGH</Badge>}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePostMutation.mutate(post.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <p className="text-sm mt-2 whitespace-pre-wrap">{post.content}</p>
                      <Badge variant="outline" className={`mt-2 text-[10px] ${cat.color}`}>{cat.label}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredPosts.length === 0 && <EmptyState icon={MessageSquare} title="No posts yet" description="Share updates, report difficulties, and communicate changes." actionLabel="New Post" onAction={() => setShowAddPost(true)} />}
        </TabsContent>
      </Tabs>
      </SubProjectGate>

      {/* Log Change Dialog */}
      <Dialog open={showAddChange} onOpenChange={setShowAddChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Change Event</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Project *</Label>
              <Select value={changeForm.project_id} onValueChange={v => setChangeForm({...changeForm, project_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label>
                <Select value={changeForm.category} onValueChange={v => setChangeForm({...changeForm, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Severity</Label>
                <Select value={changeForm.severity} onValueChange={v => setChangeForm({...changeForm, severity: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['low','medium','high','critical'].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Title *</Label><Input value={changeForm.title} onChange={e => setChangeForm({...changeForm, title: e.target.value})} /></div>
            <div><Label>Description</Label><Textarea value={changeForm.description} onChange={e => setChangeForm({...changeForm, description: e.target.value})} rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
              <div><Label>Schedule Impact (days)</Label><Input type="number" value={changeForm.impact_days} onChange={e => setChangeForm({...changeForm, impact_days: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Cost Impact (₹)</Label><Input type="number" value={changeForm.impact_cost} onChange={e => setChangeForm({...changeForm, impact_cost: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Raised By</Label><Input value={changeForm.raised_by} onChange={e => setChangeForm({...changeForm, raised_by: e.target.value})} /></div>
              <div><Label>Assigned To</Label><Input value={changeForm.assigned_to} onChange={e => setChangeForm({...changeForm, assigned_to: e.target.value})} /></div>
            </div>
            <Button className="w-full" onClick={() => createChangeMutation.mutate(changeForm)} disabled={!changeForm.project_id || !changeForm.title}>Log Change</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Post Dialog */}
      <Dialog open={showAddPost} onOpenChange={setShowAddPost}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Team Post</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Project *</Label>
              <Select value={postForm.project_id} onValueChange={v => setPostForm({...postForm, project_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label>
                <Select value={postForm.category} onValueChange={v => setPostForm({...postForm, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(POST_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label>
                <Select value={postForm.priority} onValueChange={v => setPostForm({...postForm, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['low','normal','high','urgent'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Your Name</Label><Input value={postForm.author_name} onChange={e => setPostForm({...postForm, author_name: e.target.value})} /></div>
            <div><Label>Title *</Label><Input value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} /></div>
            <div><Label>Content *</Label><Textarea value={postForm.content} onChange={e => setPostForm({...postForm, content: e.target.value})} rows={4} /></div>
            <Button className="w-full" onClick={() => createPostMutation.mutate(postForm)} disabled={!postForm.project_id || !postForm.title || !postForm.content}>Post</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}