import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FileText, Loader2, Download, TrendingUp, AlertTriangle, Users, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import ReactMarkdown from 'react-markdown';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCompactCurrencyINR } from '@/lib/formatters';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';
import {
  filterActivitiesBySubProject,
  filterBudgetBySubProject,
  filterProgressBySubProject,
} from '@/lib/subProjectScope';

const PIE_COLORS = ['#1e3a5f', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

export default function Reports() {
  const {
    projects, subProjects, wbsItems, projectId, subProjectId,
    setProjectId, setSubProjectId, isReady, selectedProject, selectedSubProject,
  } = useProjectSubProject({ fetchWbs: true });

  const [reportType, setReportType] = useState('daily');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboards');

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => projectId ? base44.entities.Milestone.filter({ project_id: projectId }, '-created_date', 500) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: scheduleTasks = [] } = useQuery({
    queryKey: ['schedule-activities', projectId],
    queryFn: () => projectId ? base44.entities.ScheduleActivity.filter({ project_id: projectId }, '-created_date', 500) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: progressEntries = [] } = useQuery({
    queryKey: ['progress', projectId],
    queryFn: () => projectId ? base44.entities.ProgressEntry.filter({ project_id: projectId }, '-date', 500) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: changes = [] } = useQuery({
    queryKey: ['changes', projectId],
    queryFn: () => projectId ? base44.entities.ChangeEvent.filter({ project_id: projectId }, '-created_date', 200) : Promise.resolve([]),
    enabled: !!projectId,
  });
  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budget', projectId],
    queryFn: () => projectId ? base44.entities.BudgetItem.filter({ project_id: projectId }, 'code', 500) : Promise.resolve([]),
    enabled: !!projectId,
  });

  const scopedBudget = isReady ? filterBudgetBySubProject(budgetItems, wbsItems, subProjectId) : [];
  const scopedTasks = isReady ? filterActivitiesBySubProject(scheduleTasks, wbsItems, subProjectId) : [];
  const scopedEntries = isReady ? filterProgressBySubProject(progressEntries, budgetItems, wbsItems, subProjectId) : [];
  const scopedActivityIds = new Set(scopedTasks.map((t) => t.id));
  const scopedChanges = isReady
    ? changes.filter((c) => !c.activity_id || scopedActivityIds.has(c.activity_id))
    : [];

  const filteredProjects = isReady && selectedProject ? [selectedProject] : [];
  const filteredMilestones = isReady ? milestones : [];
  const filteredTasks = scopedTasks;
  const filteredEntries = scopedEntries;
  const filteredChanges = scopedChanges;
  const filteredBudget = scopedBudget;

  // Portfolio metrics
  const avgProgress = filteredProjects.length > 0 ? Math.round(filteredProjects.reduce((s, p) => s + (p.progress || 0), 0) / filteredProjects.length) : 0;
  const delayedCount = filteredProjects.filter(p => p.status === 'delayed').length;
  const totalBudget = filteredBudget.filter(b => b.level === 1).reduce((s, b) => s + (b.original_budget || 0), 0);
  const totalActual = filteredBudget.filter(b => b.level === 1).reduce((s, b) => s + (b.actual_cost || 0), 0);

  // Progress chart
  const byDate = {};
  filteredEntries.forEach(e => { byDate[e.date] = (byDate[e.date] || 0) + 1; });
  const progressChart = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, count]) => ({ date: date.slice(5), entries: count }));

  // Milestone status pie
  const msPie = [
    { name: 'Completed', value: filteredMilestones.filter(m => m.status === 'completed').length },
    { name: 'In Progress', value: filteredMilestones.filter(m => m.status === 'in_progress').length },
    { name: 'Delayed', value: filteredMilestones.filter(m => m.status === 'delayed').length },
    { name: 'Not Started', value: filteredMilestones.filter(m => m.status === 'not_started').length },
  ].filter(d => d.value > 0);

  // Change category breakdown
  const changeCats = {};
  filteredChanges.forEach(c => { changeCats[c.category || 'other'] = (changeCats[c.category || 'other'] || 0) + 1; });
  const changeChart = Object.entries(changeCats).map(([name, value]) => ({ name: name.replace(/_/g,' '), value }));

  const generateReport = async () => {
    if (!isReady) return;
    setGenerating(true);
    const today = new Date().toISOString().split('T')[0];
    const prompt = `Generate a professional ${reportType} construction progress report (${today}).

Projects: ${filteredProjects.map(p => `${p.name} (${p.status}, ${p.progress}% complete)`).join('; ')}
Milestones: ${filteredMilestones.length} total, ${filteredMilestones.filter(m=>m.status==='completed').length} completed, ${filteredMilestones.filter(m=>m.status==='delayed').length} delayed
Schedule: ${filteredTasks.length} activities, ${filteredTasks.filter(t=>t.status==='completed').length} done, ${filteredTasks.filter(t=>t.status==='delayed').length} delayed, ${filteredTasks.filter(t=>t.is_critical_path).length} critical path
Progress Entries: ${filteredEntries.length} field entries, ${filteredEntries.reduce((s,e)=>s+(e.labor_count||0),0)} labor-days logged
Change Events: ${filteredChanges.length} total (${filteredChanges.filter(c=>c.status==='open').length} open), ${filteredChanges.reduce((s,c)=>s+(c.impact_days||0),0)} days schedule impact
Budget: ${formatCompactCurrencyINR(totalBudget)} budget, ${formatCompactCurrencyINR(totalActual)} spent

Sections: Executive Summary, Progress Overview, Schedule Status, Critical Path Update, Change Management, Resource Summary, Key Risks, Actions Required Next ${reportType==='daily'?'Day':reportType==='weekly'?'Week':'Month'}.
Format with markdown. Be specific, professional, and actionable.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setReport(result);
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Executive dashboards, DPR/WPR/MPR, and portfolio analytics
            {selectedSubProject ? ` — ${selectedSubProject.name}` : ''}
          </p>
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="generate">Generate Report</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="mt-4 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Avg Progress" value={`${avgProgress}%`} icon={TrendingUp} />
            <StatCard title="Delayed Projects" value={delayedCount} icon={AlertTriangle} />
            <StatCard title="Budget" value={formatCompactCurrencyINR(totalBudget)} icon={DollarSign} />
            <StatCard title="Schedule Activities" value={filteredTasks.length} icon={FileText} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Health */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Project Health</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {filteredProjects.slice(0, 6).map(p => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate flex-1">{p.name}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <StatusBadge status={p.status} />
                        <span className="text-xs font-semibold">{p.progress || 0}%</span>
                      </div>
                    </div>
                    <Progress value={p.progress || 0} className="h-1.5" />
                  </div>
                ))}
                {filteredProjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No projects</p>}
              </CardContent>
            </Card>

            {/* Milestone Status Pie */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Milestone Status</CardTitle></CardHeader>
              <CardContent>
                {msPie.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie data={msPie} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                          {msPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {msPie.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-muted-foreground">{d.name}</span>
                          <span className="font-bold ml-auto">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No milestone data</p>}
              </CardContent>
            </Card>

            {/* Progress Activity */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">DPR Submissions — Last 14 Days</CardTitle></CardHeader>
              <CardContent>
                {progressChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={progressChart}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="entries" fill="hsl(38, 92%, 50%)" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No progress data</div>}
              </CardContent>
            </Card>

            {/* Change Events */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Change Events by Category</CardTitle></CardHeader>
              <CardContent>
                {changeChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={changeChart} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" fill="hsl(222, 47%, 20%)" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No change data</div>}
              </CardContent>
            </Card>
          </div>

          {/* Delay Dashboard */}
          {filteredProjects.filter(p => p.status === 'delayed').length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-amber-600"><AlertTriangle className="w-4 h-4" /> Delay Dashboard</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {filteredProjects.filter(p => p.status === 'delayed').map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.location}</p>
                    </div>
                    <StatusBadge status="delayed" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="generate" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Report Period</label>
                  <Tabs value={reportType} onValueChange={setReportType}>
                    <TabsList>
                      <TabsTrigger value="daily">DPR</TabsTrigger>
                      <TabsTrigger value="weekly">WPR</TabsTrigger>
                      <TabsTrigger value="monthly">MPR</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <Button onClick={generateReport} disabled={generating || !isReady} className="gap-2">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><FileText className="w-4 h-4" /> Generate Report</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {report && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-accent" />{reportType.toUpperCase()} Progress Report</CardTitle>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                    const blob = new Blob([report], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url;
                    a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.md`;
                    a.click(); URL.revokeObjectURL(url);
                  }}>
                    <Download className="w-3 h-3" /> Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none prose-headings:font-heading prose-headings:tracking-tight">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </SubProjectGate>
    </div>
  );
}