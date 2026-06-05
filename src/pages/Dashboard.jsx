import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { 
  FolderKanban, Users, Clock, ShieldCheck, AlertTriangle, 
  TrendingUp, ArrowRight, Bell
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import ProgressRing from '@/components/shared/ProgressRing';
import WBSHealthPanel from '@/components/dashboard/WBSHealthPanel';

export default function Dashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 50),
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones'],
    queryFn: () => base44.entities.Milestone.list('-created_date', 100),
  });

  const { data: laborEntries = [] } = useQuery({
    queryKey: ['attendance-recent'],
    queryFn: () => base44.entities.AttendanceEntry.list('-date', 500),
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ['inspections'],
    queryFn: () => base44.entities.QualityInspection.list('-created_date', 50),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => base44.entities.Notification.filter({ is_read: false }, '-created_date', 10),
  });

  const activeProjects = projects.filter(p => p.status === 'in_progress').length;
  // Dashboard filters: date range and multiple projects
  const today = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toIso = (d) => d.toISOString().split('T')[0];
  const [dashboardFrom, setDashboardFrom] = React.useState(toIso(sevenDaysAgo));
  const [dashboardTo, setDashboardTo] = React.useState(toIso(today));
  const [dashboardProjects, setDashboardProjects] = React.useState([]); // empty = all

  const inDateRange = (dateStr) => {
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    return d >= dashboardFrom && d <= dashboardTo;
  };

  const projectMatch = (projectId) => {
    if (!dashboardProjects || dashboardProjects.length === 0) return true;
    return dashboardProjects.includes(projectId);
  };

  const filteredAttendance = laborEntries.filter(e => projectMatch(e.project_id) && inDateRange(e.date));

  const totalPresent = filteredAttendance.filter(e => e.status === 'present').length;
  const totalAbsent = filteredAttendance.filter(e => e.status === 'absent').length;
  const selectedProjectsList = dashboardProjects && dashboardProjects.length > 0 ? projects.filter(p => dashboardProjects.includes(p.id)) : projects;
  const avgProgress = selectedProjectsList.length > 0 
    ? Math.round(selectedProjectsList.reduce((sum, p) => sum + (p.progress || 0), 0) / selectedProjectsList.length) 
    : 0;
  const qualityScore = inspections.length > 0
    ? Math.round(inspections.reduce((sum, i) => sum + (i.compliance_score || 0), 0) / inspections.length)
    : 0;

  const delayedMilestones = milestones.filter(m => m.status === 'delayed' || m.status === 'blocked');

  // Phase distribution for pie chart
  const phaseData = ['foundation', 'structure', 'mep', 'finishing', 'handover'].map(phase => ({
    name: phase.charAt(0).toUpperCase() + phase.slice(1),
    value: milestones.filter(m => m.phase === phase).length
  })).filter(d => d.value > 0);

  const pieColors = ['#1e3a5f', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

  // Labor hours by trade
  const tradeCounts = {};
  filteredAttendance.forEach(e => {
    tradeCounts[e.trade || 'other'] = (tradeCounts[e.trade || 'other'] || 0) + (e.status === 'present' ? 1 : 0);
  });
  const tradeData = Object.entries(tradeCounts).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    hours: Math.round(count)
  })).sort((a, b) => b.hours - a.hours).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time overview of all construction operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications">
            <Button variant="outline" size="sm" className="gap-2 relative">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alerts</span>
              {notifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                  {notifications.length}
                </span>
              )}
            </Button>
          </Link>
          <Link to="/projects">
            <Button size="sm" className="gap-2">
              <FolderKanban className="w-4 h-4" />
              <span className="hidden sm:inline">View Projects</span>
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div>
          <label className="text-sm text-muted-foreground">From</label>
          <input type="date" value={dashboardFrom} onChange={e => setDashboardFrom(e.target.value)} className="ml-2 p-2 rounded-md border border-border bg-card text-foreground" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">To</label>
          <input type="date" value={dashboardTo} onChange={e => setDashboardTo(e.target.value)} className="ml-2 p-2 rounded-md border border-border bg-card text-foreground" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Projects</label>
          <div className="ml-2 inline-block">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <span className="text-sm">{dashboardProjects.length === 0 ? 'All Projects' : `${dashboardProjects.length} selected`}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Select Projects</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDashboardProjects(projects.map(p => p.id))}>All</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDashboardProjects([])}>Clear</Button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-auto">
                    {projects.map(p => (
                      <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer">
                        <Checkbox checked={dashboardProjects.includes(p.id)} onCheckedChange={() => {
                          setDashboardProjects(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                        }} />
                        <div className="text-sm">{p.name}</div>
                      </label>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Projects" value={activeProjects} subtitle={`${projects.length} total`} icon={FolderKanban} />
        <StatCard title="Present" value={totalPresent} subtitle="Selected date/project" icon={Users} />
        <StatCard title="Avg. Progress" value={`${avgProgress}%`} subtitle="Across all projects" icon={TrendingUp} />
        <StatCard title="Quality Score" value={`${qualityScore}%`} subtitle={`${inspections.length} inspections`} icon={ShieldCheck} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Labor by Trade */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              Labor Hours by Trade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tradeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tradeData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="hours" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                No labor data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              Milestone Phases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phaseData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={phaseData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {phaseData.map((_, i) => (
                        <Cell key={i} fill={pieColors[i % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {phaseData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No milestone data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WBS Health Panel */}
      <WBSHealthPanel />

      {/* Projects + Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading">Active Projects</CardTitle>
              <Link to="/projects" className="text-xs text-accent font-medium flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.filter(p => p.status !== 'completed').slice(0, 5).map(project => (
              <div key={project.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                <ProgressRing value={project.progress || 0} size={44} strokeWidth={3} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.location || 'No location'}</p>
                </div>
                <StatusBadge status={project.status} />
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No projects yet. Create your first project to get started.</p>
            )}
          </CardContent>
        </Card>

        {/* Alerts & Bottlenecks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {delayedMilestones.slice(0, 5).map(m => (
              <div key={m.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                <p className="text-xs font-semibold text-amber-800">{m.title}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">{m.phase?.replace(/_/g, ' ')}</p>
                <StatusBadge status={m.status} className="mt-1.5" />
              </div>
            ))}
            {delayedMilestones.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No bottlenecks detected</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}