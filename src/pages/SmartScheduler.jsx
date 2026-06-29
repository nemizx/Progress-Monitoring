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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Upload, Plus, AlertTriangle, CheckCircle, Loader2, CalendarClock, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';

export default function SmartScheduler() {
  const {
    projects, subProjects, projectId, subProjectId,
    setProjectId, setSubProjectId, isReady, selectedSubProject,
  } = useProjectSubProject();

  const [activeTab, setActiveTab] = useState('schedule');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [genForm, setGenForm] = useState({ project_id: '', project_type: '', num_floors: '', start_date: '', duration_months: '', special_requirements: '' });
  const [taskForm, setTaskForm] = useState({ project_id: '', name: '', phase: 'other', start_date: '', end_date: '', duration_days: '', assigned_crew: '', resources_needed: '', is_critical_path: false });
  const [uploadedFile, setUploadedFile] = useState(null);

  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['schedule-tasks', projectId],
    queryFn: () => projectId
      ? base44.entities.ScheduleTask.filter({ project_id: projectId }, 'order_index', 500)
      : Promise.resolve([]),
    enabled: !!projectId,
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduleTask.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] }); setShowAddTask(false); },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleTask.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduleTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] }),
  });

  const filtered = isReady ? tasks : [];
  const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'Unknown';

  const openAddTask = () => {
    setTaskForm({
      project_id: projectId,
      name: '', phase: 'other', start_date: '', end_date: '', duration_days: '',
      assigned_crew: '', resources_needed: '', is_critical_path: false,
    });
    setShowAddTask(true);
  };

  const openGenerate = () => {
    setGenForm({
      project_id: projectId,
      project_type: '', num_floors: '', start_date: '', duration_months: '', special_requirements: '',
    });
    setShowGenerate(true);
  };
  const handleGenerateSchedule = async () => {
    setGenerating(true);
    const prompt = `Generate a detailed construction schedule for a ${genForm.project_type} project with ${genForm.num_floors} floors. 
    Start date: ${genForm.start_date}. Duration: ${genForm.duration_months} months. 
    Special requirements: ${genForm.special_requirements}.
    Create a comprehensive list of construction tasks organized by phases: Foundation, Structure, MEP (Mechanical/Electrical/Plumbing), Finishing, Handover.
    For each task provide: name, phase, duration_days, description, assigned_crew suggestion, and whether it's on the critical path.
    Consider dependencies and logical sequencing.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                phase: { type: "string", enum: ["foundation", "structure", "mep", "finishing", "handover"] },
                duration_days: { type: "number" },
                description: { type: "string" },
                assigned_crew: { type: "string" },
                is_critical_path: { type: "boolean" }
              }
            }
          }
        }
      }
    });

    if (result?.tasks) {
      let currentDate = new Date(genForm.start_date);
      const tasksToCreate = result.tasks.map((task, i) => {
        const startDate = new Date(currentDate);
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + (task.duration_days || 7));
        if (task.is_critical_path) currentDate = new Date(endDate);
        return {
          project_id: genForm.project_id,
          name: task.name,
          description: task.description,
          phase: task.phase,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          duration_days: task.duration_days,
          assigned_crew: task.assigned_crew,
          is_critical_path: task.is_critical_path,
          status: 'not_started',
          order_index: i
        };
      });
      await base44.entities.ScheduleTask.bulkCreate(tasksToCreate);
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
    }
    setGenerating(false);
    setShowGenerate(false);
  };

  const handleAnalyzeFile = async () => {
    if (!uploadedFile) return;
    setAnalyzing(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this construction schedule file and identify potential issues, conflicts, and areas for improvement. 
      Look for: unrealistic durations, missing dependencies, resource conflicts, overlapping critical tasks, missing buffer time, 
      incorrect sequencing (e.g. finishing before structure), missing phases, and any other scheduling problems.
      Provide specific, actionable recommendations.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          overall_score: { type: "number", description: "Score 0-100" },
          summary: { type: "string" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                title: { type: "string" },
                description: { type: "string" },
                recommendation: { type: "string" }
              }
            }
          }
        }
      }
    });
    setAnalysisResult(result);
    setAnalyzing(false);
  };

  const phases = ['foundation', 'structure', 'mep', 'finishing', 'handover'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Smart Scheduler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered scheduling and schedule analysis
            {selectedSubProject ? ` — ${selectedSubProject.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showAnalyze} onOpenChange={v => { setShowAnalyze(v); if(!v) setAnalysisResult(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={!isReady}><Upload className="w-4 h-4" /> Analyze Schedule</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Analyze Schedule File</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Upload a schedule file (MS Project XML, Excel, CSV) to get AI-powered analysis of potential issues.</p>
                <Input type="file" accept=".xlsx,.xls,.csv,.xml,.mpp,.pdf" onChange={e => setUploadedFile(e.target.files[0])} />
                <Button onClick={handleAnalyzeFile} disabled={!uploadedFile || analyzing} className="w-full gap-2">
                  {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Wand2 className="w-4 h-4" /> Analyze with AI</>}
                </Button>
                {analysisResult && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-bold">{analysisResult.overall_score}/100</div>
                      <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
                    </div>
                    <div className="space-y-3">
                      {analysisResult.issues?.map((issue, i) => (
                        <Card key={i} className="border-l-4" style={{ borderLeftColor: issue.severity === 'critical' ? '#ef4444' : issue.severity === 'high' ? '#f59e0b' : issue.severity === 'medium' ? '#3b82f6' : '#94a3b8' }}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                              <div>
                                <p className="font-semibold text-sm">{issue.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                                <p className="text-xs font-medium mt-2 text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {issue.recommendation}</p>
                              </div>
                            </div>
                            <StatusBadge status={issue.severity} className="mt-2" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button className="gap-2" disabled={!isReady} onClick={openGenerate}>
            <Wand2 className="w-4 h-4" /> Generate Schedule
          </Button>
          <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
            <DialogContent>
              <DialogHeader><DialogTitle>AI Schedule Generator</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Project Type</Label><Input value={genForm.project_type} onChange={e => setGenForm({...genForm, project_type: e.target.value})} placeholder="e.g. Residential tower, Commercial building" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Number of Floors</Label><Input type="number" value={genForm.num_floors} onChange={e => setGenForm({...genForm, num_floors: e.target.value})} /></div>
                  <div><Label>Duration (months)</Label><Input type="number" value={genForm.duration_months} onChange={e => setGenForm({...genForm, duration_months: e.target.value})} /></div>
                </div>
                <div><Label>Start Date</Label><Input type="date" value={genForm.start_date} onChange={e => setGenForm({...genForm, start_date: e.target.value})} /></div>
                <div><Label>Special Requirements</Label><Textarea value={genForm.special_requirements} onChange={e => setGenForm({...genForm, special_requirements: e.target.value})} placeholder="Any special requirements..." rows={3} /></div>
                <Button onClick={handleGenerateSchedule} disabled={!genForm.project_id || generating} className="w-full gap-2">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Wand2 className="w-4 h-4" /> Generate Schedule</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" className="gap-2" disabled={!isReady} onClick={openAddTask}>
          <Plus className="w-4 h-4" /> Add Task
        </Button>
        <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Schedule Task</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Task Name *</Label><Input value={taskForm.name} onChange={e => setTaskForm({...taskForm, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phase</Label>
                  <Select value={taskForm.phase} onValueChange={v => setTaskForm({...taskForm, phase: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[...phases, 'other'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Duration (days)</Label><Input type="number" value={taskForm.duration_days} onChange={e => setTaskForm({...taskForm, duration_days: parseInt(e.target.value) || ''})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Date</Label><Input type="date" value={taskForm.start_date} onChange={e => setTaskForm({...taskForm, start_date: e.target.value})} /></div>
                <div><Label>End Date</Label><Input type="date" value={taskForm.end_date} onChange={e => setTaskForm({...taskForm, end_date: e.target.value})} /></div>
              </div>
              <div><Label>Assigned Crew</Label><Input value={taskForm.assigned_crew} onChange={e => setTaskForm({...taskForm, assigned_crew: e.target.value})} /></div>
              <Button className="w-full" onClick={() => createTaskMutation.mutate(taskForm)} disabled={!taskForm.project_id || !taskForm.name}>Add Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Schedule View by Phase */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="gantt">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6 mt-4">
          {phases.map(phase => {
            const phaseTasks = filtered.filter(t => t.phase === phase);
            if (phaseTasks.length === 0) return null;
            return (
              <div key={phase}>
                <h3 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">{phase}</h3>
                <div className="space-y-2">
                  {phaseTasks.map(task => (
                    <Card key={task.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-1 h-10 rounded-full ${task.is_critical_path ? 'bg-red-500' : 'bg-accent'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{task.name}</p>
                            {task.is_critical_path && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">CRITICAL</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{task.start_date} → {task.end_date} · {task.duration_days || '?'} days · {task.assigned_crew || 'Unassigned'}</p>
                        </div>
                        <StatusBadge status={task.status} />
                        <Select value={task.status} onValueChange={v => updateTaskMutation.mutate({ id: task.id, data: { status: v, progress: v === 'completed' ? 100 : task.progress } })}>
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['not_started', 'in_progress', 'completed', 'delayed'].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTaskMutation.mutate(task.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState icon={CalendarClock} title="No schedule tasks" description="Generate a schedule using AI or add tasks manually." actionLabel="Generate Schedule" onAction={openGenerate} />
          )}
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <GanttTimeline tasks={filtered} getProjectName={getProjectName} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </SubProjectGate>
    </div>
  );
}

function GanttTimeline({ tasks }) {
  if (tasks.length === 0) return <p className="text-center text-sm text-muted-foreground py-8">No tasks to display</p>;

  const allDates = tasks.flatMap(t => [t.start_date, t.end_date]).filter(Boolean);
  if (allDates.length === 0) return <p className="text-center text-sm text-muted-foreground py-8">Tasks need dates for timeline view</p>;
  
  const minDate = new Date(allDates.sort()[0]);
  const maxDate = new Date(allDates.sort().reverse()[0]);
  const totalDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {tasks.filter(t => t.start_date && t.end_date).map(task => {
          const start = (new Date(task.start_date) - minDate) / (1000 * 60 * 60 * 24);
          const duration = Math.max(1, (new Date(task.end_date) - new Date(task.start_date)) / (1000 * 60 * 60 * 24));
          const leftPct = (start / totalDays) * 100;
          const widthPct = (duration / totalDays) * 100;

          return (
            <div key={task.id} className="flex items-center gap-3 py-1.5">
              <div className="w-40 shrink-0 text-xs font-medium truncate">{task.name}</div>
              <div className="flex-1 relative h-6 bg-muted/50 rounded">
                <div
                  className={`absolute top-0 h-6 rounded flex items-center px-2 text-[10px] font-semibold text-white ${task.is_critical_path ? 'bg-red-500' : task.status === 'completed' ? 'bg-emerald-500' : 'bg-primary'}`}
                  style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
                >
                  {widthPct > 8 && `${duration}d`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}