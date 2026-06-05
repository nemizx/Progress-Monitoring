import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, ChevronRight, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react';

const QUESTIONS = [
  { key: 'project_type', label: 'What type of project is this?', type: 'select', options: ['Residential Building', 'Commercial Tower', 'Industrial Facility', 'Infrastructure / Civil', 'Renovation / Fit-out', 'Other'] },
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

export default function ScheduleWizard({ onComplete, onCancel, onGenerated }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [generatedData, setGeneratedData] = useState(null);

  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const canNext = answers[q?.key] !== undefined && answers[q?.key] !== '';

  const updateAnswer = (val) => setAnswers(a => ({ ...a, [q.key]: val }));

  const handleGenerate = async () => {
    setGenerating(true);
    const projectId = answers.project_id;
    const projectName = projects.find(p => p.id === projectId)?.name || 'Project';

    const prompt = `You are a senior construction planner. Generate a detailed construction schedule in JSON format for the following project:

Project name: ${projectName}
Project type: ${answers.project_type}
Start date: ${answers.start_date}
Total duration: ${answers.duration_months} months
Floors/storeys: ${answers.floors || 'N/A'}
MEP scope: ${answers.include_mep}
Handover type: ${answers.handover_type}
Key constraints: ${answers.key_constraints || 'None'}

Generate a realistic schedule with 20-30 activities covering all phases. 
Each activity should follow standard construction sequencing with logical predecessors.
Return ONLY a JSON array of activity objects (no wrapper key), each with:
{
  "activity_id": "A1010",
  "name": "string",
  "phase": "foundation|structure|mep|finishing|handover|other",
  "planned_start": "YYYY-MM-DD",
  "planned_end": "YYYY-MM-DD",
  "duration_days": number,
  "float_days": number,
  "is_critical_path": boolean,
  "is_milestone": boolean,
  "status": "not_started",
  "progress": 0,
  "assigned_crew": "string",
  "order_index": number,
  "predecessors": ["A1000"]
}

Distribute activities logically across the ${answers.duration_months}-month timeline starting ${answers.start_date}.
Critical path activities should have float_days = 0.`;

    const modelInputs = {
      projectId,
      projectType: answers.project_type,
      startDate: answers.start_date,
      durationMonths: answers.duration_months,
      floors: answers.floors,
      numSubprojects: answers.num_subprojects,
      includeMep: answers.include_mep,
      handoverType: answers.handover_type,
      keyConstraints: answers.key_constraints,
      standardAnswers: {
        site_access: answers.site_access,
        delivery_strategy: answers.delivery_strategy,
        finish_quality: answers.finish_quality
      }
    };

    const result = await base44.integrations.Schedule.generate(modelInputs);
    const activityList = result?.schedule || [];

    setGeneratedCount(activityList.length);
    setGeneratedData({
      schedule: activityList,
      features: result.features,
      projectId,
      projectName: projects.find(p => p.id === projectId)?.name || 'Project'
    });

    if (onGenerated) {
      onGenerated({
        schedule: activityList,
        features: result.features,
        projectId,
        projectName: projects.find(p => p.id === projectId)?.name || 'Project'
      });
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
          <p className="text-muted-foreground text-sm">AI is generating a full site schedule based on your project parameters. This takes about 15–20 seconds.</p>
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
        {/* Progress dots */}
        <div className="flex gap-1.5 mt-2">
          {QUESTIONS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full flex-1 transition-all ${i <= step ? 'bg-accent' : 'bg-muted'}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Step {step + 1} of {QUESTIONS.length}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Label className="text-sm font-medium">{q?.label}</Label>

        {q?.type === 'select' && (
          <Select value={answers[q.key] || ''} onValueChange={updateAnswer}>
            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
            <SelectContent>
              {q.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {q?.type === 'project_select' && (
          <Select value={answers[q.key] || ''} onValueChange={updateAnswer}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {q?.type === 'date' && (
          <Input type="date" value={answers[q.key] || ''} onChange={e => updateAnswer(e.target.value)} />
        )}

        {q?.type === 'number' && (
          <Input type="number" placeholder={q.placeholder} value={answers[q.key] || ''} onChange={e => updateAnswer(e.target.value)} />
        )}

        {q?.type === 'text' && (
          <Input placeholder={q.placeholder} value={answers[q.key] || ''} onChange={e => updateAnswer(e.target.value)} />
        )}

        {q?.type === 'textarea' && (
          <Textarea placeholder={q.placeholder} value={answers[q.key] || ''} onChange={e => updateAnswer(e.target.value)} rows={3} />
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {isLast ? (
            <Button className="flex-1 gap-2" disabled={!canNext} onClick={handleGenerate}>
              <Sparkles className="w-4 h-4" /> Generate Schedule
            </Button>
          ) : (
            <Button className="flex-1 gap-1" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}