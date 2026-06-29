import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { mapProjectTypeToScheduleLabel, getProjectTypeLabel } from '@/lib/projectTypes';

const ALL_QUESTIONS = [
  { key: 'project_type', label: 'What type of project is this?', type: 'project_type_select' },
  { key: 'project_id', label: 'Which project should this schedule be for?', type: 'project_select' },
  { key: 'start_date', label: 'What is the planned project start date?', type: 'date' },
  { key: 'duration_months', label: 'What is the total project duration (months)?', type: 'number', placeholder: 'e.g. 18' },
  { key: 'floors', label: 'How many floors / storeys? (or N/A)', type: 'text', placeholder: 'e.g. 12' },
  { key: 'num_subprojects', label: 'How many sub-projects / packages are included?', type: 'number', placeholder: 'e.g. 2' },
  { key: 'site_access', label: 'What is the site access condition?', type: 'select', options: ['Easy site access', 'Restricted site access', 'Urban infill / constrained site', 'N/A'] },
  { key: 'delivery_strategy', label: 'What is the delivery strategy?', type: 'select', options: ['Fast-track delivery', 'Standard delivery', 'Phased delivery', 'Design & build', 'N/A'] },
  { key: 'finish_quality', label: 'What quality of finishes is expected?', type: 'select', options: ['Standard quality', 'High-end finishes', 'Budget economy finishes', 'N/A'] },
  { key: 'include_mep', label: 'Should MEP (Mechanical, Electrical, Plumbing) be included?', type: 'select', options: ['Yes — full MEP', 'Yes — basic MEP', 'No'] },
  { key: 'handover_type', label: 'What type of handover is required?', type: 'select', options: ['Full commissioning + testing', 'Standard handover', 'Phased handover', 'No formal handover'] },
  { key: 'key_constraints', label: 'Any key constraints or special requirements?', type: 'textarea', placeholder: 'e.g. restricted site access, fast-track delivery, phased handover...' },
];

export default function ScheduleWizard({
  onComplete,
  onCancel,
  onGenerated,
  projectId: scopedProjectId,
  subProjectId: scopedSubProjectId,
  projectName: scopedProjectName,
  subProjectName: scopedSubProjectName,
  projectType: scopedProjectType,
  projectStartDate,
}) {
  const isScoped = !!(scopedProjectId && scopedSubProjectId);
  const scheduleProjectType = scopedProjectType ? mapProjectTypeToScheduleLabel(scopedProjectType) : null;
  const hasKnownProjectType = !!scheduleProjectType;

  const questions = useMemo(() => {
    let list = isScoped
      ? ALL_QUESTIONS.filter((q) => q.key !== 'project_id' && q.key !== 'num_subprojects')
      : ALL_QUESTIONS;
    if (hasKnownProjectType) {
      list = list.filter((q) => q.key !== 'project_type');
    }
    return list;
  }, [isScoped, hasKnownProjectType]);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => {
    const base = isScoped ? { project_id: scopedProjectId, num_subprojects: '1' } : {};
    if (scheduleProjectType) base.project_type = scheduleProjectType;
    if (projectStartDate) base.start_date = projectStartDate;
    return base;
  });
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
    enabled: !isScoped,
  });

  const q = questions[step];
  const isLast = step === questions.length - 1;
  const canNext = answers[q?.key] !== undefined && answers[q?.key] !== '';

  const updateAnswer = (val) => setAnswers((a) => ({ ...a, [q.key]: val }));

  const handleProjectSelect = (projectId) => {
    const selected = projects.find((p) => p.id === projectId);
    const mappedType = selected?.project_type
      ? mapProjectTypeToScheduleLabel(selected.project_type)
      : undefined;
    setAnswers((a) => ({
      ...a,
      project_id: projectId,
      ...(mappedType ? { project_type: mappedType } : {}),
      ...(selected?.start_date && !a.start_date ? { start_date: selected.start_date } : {}),
    }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const projectId = isScoped ? scopedProjectId : answers.project_id;
    const subProjectId = isScoped ? scopedSubProjectId : null;
    const projectName = isScoped
      ? scopedProjectName
      : (projects.find((p) => p.id === projectId)?.name || 'Project');
    const subProjectName = isScoped ? scopedSubProjectName : null;

    const modelInputs = {
      projectId,
      subProjectId,
      projectType: answers.project_type,
      startDate: answers.start_date,
      durationMonths: answers.duration_months,
      floors: answers.floors,
      numSubprojects: isScoped ? 1 : answers.num_subprojects,
      includeMep: answers.include_mep,
      handoverType: answers.handover_type,
      keyConstraints: answers.key_constraints,
      standardAnswers: {
        site_access: answers.site_access,
        delivery_strategy: answers.delivery_strategy,
        finish_quality: answers.finish_quality,
      },
    };

    const result = await base44.integrations.Schedule.generate(modelInputs);
    const activityList = result?.schedule || [];

    setGeneratedCount(activityList.length);

    const payload = {
      schedule: activityList,
      features: result.features,
      projectId,
      subProjectId,
      projectName: projectName || 'Project',
      subProjectName,
    };

    if (onGenerated) {
      onGenerated(payload);
      setGenerating(false);
      return;
    }

    setGenerating(false);
    setDone(true);
  };

  if (done) {
    return (
      <Card className="max-w-lg mx-auto text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-heading font-bold">Schedule Generated!</h3>
          <p className="text-muted-foreground text-sm">{generatedCount} activities created. Review and finalize before saving.</p>
          <Button className="w-full" onClick={onComplete}>Review & Finalize Schedule</Button>
        </CardContent>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card className="max-w-lg mx-auto text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h3 className="text-xl font-heading font-bold">Building Your Schedule...</h3>
          <p className="text-muted-foreground text-sm">
            Generating activities for {scopedProjectName || 'your project'}
            {scopedSubProjectName ? ` → ${scopedSubProjectName}` : ''}. This takes a few seconds.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-accent" />
          <CardTitle className="text-base font-heading">AI Schedule Builder</CardTitle>
        </div>
        {isScoped && (
          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-xs">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>
                <span className="font-medium">{scopedProjectName}</span>
                <span className="text-muted-foreground"> → </span>
                <span className="font-medium">{scopedSubProjectName}</span>
              </span>
            </div>
            {hasKnownProjectType && (
              <p className="text-xs text-muted-foreground px-1">
                Project type: <span className="font-medium text-foreground">{getProjectTypeLabel(scopedProjectType)}</span>
                <span className="text-muted-foreground"> (from project settings)</span>
              </p>
            )}
            {!hasKnownProjectType && (
              <p className="text-xs text-amber-600 px-1">
                Set project type under Projects → Admin before using AI builder for best results.
              </p>
            )}
          </div>
        )}
        <div className="flex gap-1.5 mt-2">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full flex-1 transition-all ${i <= step ? 'bg-accent' : 'bg-muted'}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Step {step + 1} of {questions.length}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Label className="text-sm font-medium">{q?.label}</Label>

        {q?.type === 'select' && (
          <Select value={answers[q.key] || undefined} onValueChange={updateAnswer}>
            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
            <SelectContent>
              {q.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {q?.type === 'project_type_select' && (
          <Select value={answers[q.key] || undefined} onValueChange={updateAnswer}>
            <SelectTrigger><SelectValue placeholder="Select project type" /></SelectTrigger>
            <SelectContent>
              {[
                'Residential Building',
                'Commercial Tower',
                'Residential + Commercial (Mixed Use)',
                'Industrial Facility',
                'Infrastructure / Civil',
                'Renovation / Fit-out',
              ].map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {q?.type === 'project_select' && (
          <Select value={answers[q.key] || undefined} onValueChange={handleProjectSelect}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {q?.type === 'date' && (
          <Input type="date" value={answers[q.key] || ''} onChange={(e) => updateAnswer(e.target.value)} />
        )}

        {q?.type === 'number' && (
          <Input type="number" placeholder={q.placeholder} value={answers[q.key] || ''} onChange={(e) => updateAnswer(e.target.value)} />
        )}

        {q?.type === 'text' && (
          <Input placeholder={q.placeholder} value={answers[q.key] || ''} onChange={(e) => updateAnswer(e.target.value)} />
        )}

        {q?.type === 'textarea' && (
          <Textarea placeholder={q.placeholder} value={answers[q.key] || ''} onChange={(e) => updateAnswer(e.target.value)} rows={3} />
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {isLast ? (
            <Button className="flex-1 gap-2" disabled={!canNext} onClick={handleGenerate}>
              <Sparkles className="w-4 h-4" /> Generate Schedule
            </Button>
          ) : (
            <Button className="flex-1 gap-1" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
