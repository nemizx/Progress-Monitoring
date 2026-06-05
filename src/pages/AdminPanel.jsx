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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, FileText, Shield, Plus, Upload, Trash2, Download, Pencil, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';

const ROLES = ['admin', 'planning_team', 'project_manager', 'site_engineer', 'department_head', 'management'];
const DOC_CATEGORIES = ['drawing', 'method_statement', 'schedule', 'report', 'specification', 'approval', 'other'];

export default function AdminPanel() {
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [docForm, setDocForm] = useState({ project_id: '', title: '', category: 'drawing', revision: 'A', revision_notes: '', uploaded_by: '', status: 'draft', tags: [] });
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('site_engineer');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const queryClient = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date', 100) });
  const { data: documents = [] } = useQuery({ queryKey: ['documents'], queryFn: () => base44.entities.Document.list('-created_date', 200) });

  const createDocMutation = useMutation({
    mutationFn: (data) => base44.entities.Document.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }); setShowAddDoc(false); setDocForm({ project_id: '', title: '', category: 'drawing', revision: 'A', revision_notes: '', uploaded_by: '', status: 'draft', tags: [] }); },
  });
  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
  const deleteDocMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const handleUploadDoc = async () => {
    setUploading(true);
    let file_url = '';
    if (docFile) {
      const res = await base44.integrations.Core.UploadFile({ file: docFile });
      file_url = res.file_url;
    }
    await createDocMutation.mutateAsync({ ...docForm, file_url, file_name: docFile?.name || '' });
    setUploading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    const mappedRole = inviteRole === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(inviteEmail, mappedRole);
    setInviteMsg(`Invitation sent to ${inviteEmail}`);
    setInviteEmail('');
    setInviting(false);
    setTimeout(() => setInviteMsg(''), 4000);
  };

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || '';

  const statusDocColor = { draft: 'bg-slate-100 text-slate-600', for_review: 'bg-blue-100 text-blue-700', approved: 'bg-emerald-100 text-emerald-700', superseded: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">User management, document control, and platform governance</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Users & Roles</TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5"><FileText className="w-4 h-4" /> Documents</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><Shield className="w-4 h-4" /> Role Matrix</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Team Members</h2>
            <Button size="sm" className="gap-1.5" onClick={() => setShowInvite(true)}><Plus className="w-4 h-4" /> Invite User</Button>
          </div>
          {inviteMsg && <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-lg border border-emerald-200 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {inviteMsg}</div>}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ROLES.map(role => (
                  <div key={role} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{role.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">Role</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Invite Dialog */}
          <Dialog open={showInvite} onOpenChange={setShowInvite}>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Email Address</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@company.com" /></div>
                <div><Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="bg-muted/40 rounded p-3 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Role Permissions:</p>
                  <p>• Admin: Full platform access</p>
                  <p>• Planning Team: Schedule creation & management</p>
                  <p>• Project Manager: All project data, approve reports</p>
                  <p>• Site Engineer: Progress entry, DPR submission</p>
                  <p>• Department Head: View all, approve changes</p>
                  <p>• Management: Read-only executive dashboards</p>
                </div>
                <Button className="w-full" onClick={handleInvite} disabled={!inviteEmail || inviting}>{inviting ? 'Sending...' : 'Send Invitation'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="docs" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Document Register</h2>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAddDoc(true)}><Upload className="w-4 h-4" /> Upload Document</Button>
          </div>

          <div className="flex gap-3 flex-wrap">
            {DOC_CATEGORIES.map(cat => (
              <Badge key={cat} variant="outline" className="cursor-pointer capitalize hover:bg-muted">{cat.replace(/_/g, ' ')}</Badge>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Rev</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium text-sm">
                          {doc.file_url ? (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{doc.title}</a>
                          ) : doc.title}
                        </TableCell>
                        <TableCell className="text-sm capitalize">{doc.category?.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-sm">{getProjectName(doc.project_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">Rev {doc.revision}</Badge></TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusDocColor[doc.status] || ''}`}>{doc.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{doc.created_date ? format(new Date(doc.created_date), 'MMM d') : ''}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Select value={doc.status} onValueChange={v => updateDocMutation.mutate({ id: doc.id, data: { status: v } })}>
                              <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{['draft','for_review','approved','superseded'].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDocMutation.mutate(doc.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {documents.length === 0 && <EmptyState icon={FileText} title="No documents" description="Upload drawings, method statements, and schedules." />}
            </CardContent>
          </Card>

          {/* Upload Dialog */}
          <Dialog open={showAddDoc} onOpenChange={setShowAddDoc}>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Project</Label>
                  <Select value={docForm.project_id} onValueChange={v => setDocForm({...docForm, project_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Title *</Label><Input value={docForm.title} onChange={e => setDocForm({...docForm, title: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label>
                    <Select value={docForm.category} onValueChange={v => setDocForm({...docForm, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Revision</Label><Input value={docForm.revision} onChange={e => setDocForm({...docForm, revision: e.target.value})} placeholder="A, B, C or 01..." /></div>
                </div>
                <div><Label>File</Label><Input type="file" onChange={e => setDocFile(e.target.files[0])} /></div>
                <div><Label>Uploaded By</Label><Input value={docForm.uploaded_by} onChange={e => setDocForm({...docForm, uploaded_by: e.target.value})} /></div>
                <div><Label>Notes</Label><Textarea value={docForm.revision_notes} onChange={e => setDocForm({...docForm, revision_notes: e.target.value})} rows={2} /></div>
                <Button className="w-full" onClick={handleUploadDoc} disabled={!docForm.title || uploading}>{uploading ? 'Uploading...' : 'Upload Document'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Role Matrix */}
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Permission Matrix</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Feature</th>
                      {ROLES.map(r => <th key={r} className="p-2 font-semibold capitalize text-center">{r.replace(/_/g,' ')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Schedule Creation', true, true, false, false, false, false],
                      ['Schedule Optimization', true, true, true, false, false, false],
                      ['Progress Entry (DPR)', true, false, true, true, false, false],
                      ['Approve Reports', true, false, true, false, true, false],
                      ['WBS Management', true, true, false, false, false, false],
                      ['Budget Editing', true, false, true, false, false, false],
                      ['Log Change Events', true, true, true, true, true, false],
                      ['Document Upload', true, true, true, true, false, false],
                      ['Document Approval', true, false, true, false, true, false],
                      ['Invite Users', true, false, false, false, false, false],
                      ['View Dashboards', true, true, true, true, true, true],
                      ['Portfolio View', true, false, true, false, true, true],
                    ].map(([feature, ...perms]) => (
                      <tr key={feature} className="border-b hover:bg-muted/20">
                        <td className="p-2 font-medium">{feature}</td>
                        {perms.map((allowed, i) => (
                          <td key={i} className="p-2 text-center">
                            {allowed ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}