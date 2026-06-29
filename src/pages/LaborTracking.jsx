import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Trash2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';

const TRADES = ['carpenter','electrician','plumber','mason','painter','welder','operator','laborer','supervisor','engineer','other'];

export default function LaborTracking() {
  const {
    projects, subProjects, projectId, subProjectId,
    setProjectId, setSubProjectId, isReady, selectedSubProject,
  } = useProjectSubProject();

  const [showAdd, setShowAdd] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    project_id: '', worker_name: '', trade: 'laborer', date: new Date().toISOString().split('T')[0],
    status: 'present', shift: 'full', remarks: ''
  });

  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ['attendance', projectId],
    queryFn: () => projectId
      ? base44.entities.AttendanceEntry.filter({ project_id: projectId }, '-date', 500)
      : Promise.resolve([]),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AttendanceEntry.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); setShowAdd(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AttendanceEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const openAddDialog = () => {
    setForm({
      project_id: projectId,
      worker_name: '', trade: 'laborer', date: dateFilter,
      status: 'present', shift: 'full', remarks: '',
    });
    setShowAdd(true);
  };

  const scopedEntries = isReady ? entries : [];
  const filtered = scopedEntries.filter(e => e.date === dateFilter);

  const presentCount = filtered.filter(e => e.status === 'present').length;
  const absentCount = filtered.filter(e => e.status === 'absent').length;
  const uniqueWorkers = new Set(filtered.map(e => e.worker_name)).size;

  const dayMap = {};
  scopedEntries.forEach(e => {
    if (e.status === 'present') dayMap[e.date] = (dayMap[e.date] || 0) + 1;
  });
  const dailyData = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, count]) => ({
    date: date.slice(5),
    count
  }));

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Daily Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Record worker attendance per project and date
            {selectedSubProject ? ` — ${selectedSubProject.name}` : ''}
          </p>
        </div>
        <Button className="gap-2" disabled={!isReady} onClick={openAddDialog}>
          <Plus className="w-4 h-4" /> Mark Attendance
        </Button>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Present" value={presentCount} icon={Users} />
          <StatCard title="Absent" value={absentCount} icon={AlertTriangle} />
          <StatCard title="Workers" value={uniqueWorkers} icon={Users} />
          <div />
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Daily Attendance (Last 14 Days)</CardTitle></CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(210 70% 18%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>}
          </CardContent>
        </Card>

        <div className="flex gap-3 items-end">
          <div>
            <Label>Date</Label>
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium text-sm">{entry.worker_name}</TableCell>
                      <TableCell className="text-sm capitalize">{entry.trade}</TableCell>
                      <TableCell className="text-sm">{getProjectName(entry.project_id)}</TableCell>
                      <TableCell className="text-sm">{entry.date}</TableCell>
                      <TableCell className={`text-sm ${entry.status === 'present' ? 'text-success' : 'text-destructive'}`}>{entry.status}</TableCell>
                      <TableCell className="text-sm">{entry.shift}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(entry.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filtered.length === 0 && <EmptyState title="No attendance records" description="Mark attendance for workers on the selected date." />}
          </CardContent>
        </Card>
      </SubProjectGate>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Attendance</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Worker Name *</Label><Input value={form.worker_name} onChange={e => setForm({...form, worker_name: e.target.value})} /></div>
              <div><Label>Trade</Label>
                <Select value={form.trade} onValueChange={v => setForm({...form, trade: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRADES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Shift</Label>
                <Select value={form.shift} onValueChange={v => setForm({...form, shift: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Remarks</Label><Input value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} /></div>
            <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.project_id || !form.worker_name}>
              Save Attendance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
