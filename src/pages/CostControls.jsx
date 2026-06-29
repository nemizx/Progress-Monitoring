import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  Building2, Home, Hammer, ClipboardCheck, Lock, 
  Sparkles, CheckCircle2, AlertCircle, RefreshCw, 
  Search, Link2, Unlink, Coins, TrendingUp, HelpCircle
} from 'lucide-react';
import { formatCurrencyINR, formatCompactCurrencyINR } from '@/lib/formatters';
import ProjectSubProjectSelector from '@/components/shared/ProjectSubProjectSelector';
import SubProjectGate from '@/components/shared/SubProjectGate';

// Fuzzy similarity logic helper based on word overlap
const computeNameSimilarity = (s1, s2) => {
  if (!s1 || !s2) return 0;
  const w1 = s1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const w2 = s2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  if (w1.length === 0 || w2.length === 0) return 0;
  const intersection = w1.filter(w => w2.includes(w));
  return (2 * intersection.length) / (w1.length + w2.length);
};

export default function CostControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State variables
  const [projectId, setProjectId] = useState('');
  const [activeTab, setActiveTab] = useState('subprojects');
  
  // Dialog controls
  const [showSubProjectModal, setShowSubProjectModal] = useState(false);
  const [showMepModal, setShowMepModal] = useState(false);
  
  // Form states
  const [subProjForm, setSubProjForm] = useState({ name: '', built_up_area: '', floors_count: '5', flats_per_floor: '4' });
  const [mepForm, setMepForm] = useState({ budget_head_code: '11-ELE', activity_name: '', scope_type: 'flat', unit: 'Nos', rate_per_unit: '', quantity_per_scope: '1' });
  
  // UI filter states
  const [selectedSubProjectId, setSelectedSubProjectId] = useState('');
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(0.3);

  // Queries
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100)
  });

  // Auto-select first project — removed; user must pick project then sub-project

  const { data: subProjects = [], isLoading: loadingSubProjects } = useQuery({
    queryKey: ['subprojects', projectId],
    queryFn: () => projectId 
      ? base44.entities.SubProject.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId
  });

  const { data: flats = [], isLoading: loadingFlats } = useQuery({
    queryKey: ['flats', projectId],
    queryFn: () => projectId 
      ? base44.entities.ProjectFlat.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId
  });

  const { data: mepBoqs = [], isLoading: loadingMepBoqs } = useQuery({
    queryKey: ['mep_boqs', projectId],
    queryFn: () => projectId 
      ? base44.entities.MepBoq.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId
  });

  const { data: budgetItems = [], isLoading: loadingBudget } = useQuery({
    queryKey: ['budgetItems', projectId],
    queryFn: () => projectId 
      ? base44.entities.BudgetItem.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['activities', projectId],
    queryFn: () => projectId 
      ? base44.entities.ScheduleActivity.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId
  });

  const { data: progressEntries = [] } = useQuery({
    queryKey: ['progress_entries', projectId],
    queryFn: () => projectId 
      ? base44.entities.ProgressEntry.filter({ project_id: projectId })
      : Promise.resolve([]),
    enabled: !!projectId
  });

  // Mutations
  const createSubProject = useMutation({
    mutationFn: async (data) => {
      // 1. Create sub project
      const subProj = await base44.entities.SubProject.create(data);
      
      // 2. Automatically generate the flats breakdown
      const floors = parseInt(data.floors_count) || 1;
      const flatsPerFloor = parseInt(data.flats_per_floor) || 0;
      const totalFlats = floors * flatsPerFloor;
      
      if (totalFlats > 0) {
        const flatsList = [];
        const baseArea = (parseFloat(data.built_up_area) || 0) / totalFlats;
        
        for (let floor = 1; floor <= floors; floor++) {
          for (let fIdx = 1; fIdx <= flatsPerFloor; fIdx++) {
            const flatNum = `${floor}${String(fIdx).padStart(2, '0')}`;
            flatsList.push({
              project_id: projectId,
              sub_project_id: subProj.id,
              floor_number: floor,
              flat_number: flatNum,
              area_sqft: parseFloat(baseArea.toFixed(2)),
              cost_estimate: 0
            });
          }
        }
        await base44.entities.ProjectFlat.bulkCreate(flatsList);
      }
      return subProj;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subprojects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['flats', projectId] });
      setShowSubProjectModal(false);
      setSubProjForm({ name: '', built_up_area: '', floors_count: '5', flats_per_floor: '4' });
      toast({ title: 'Sub-project Created', description: 'Breakdown of flats has been populated successfully.' });
    }
  });

  const createMepBoq = useMutation({
    mutationFn: (data) => base44.entities.MepBoq.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mep_boqs', projectId] });
      setShowMepModal(false);
      setMepForm({ budget_head_code: '11-ELE', activity_name: '', scope_type: 'flat', unit: 'Nos', rate_per_unit: '', quantity_per_scope: '1' });
      toast({ title: 'BOQ Activity Added', description: 'MEQ activity was added to the BOQ baseline.' });
    }
  });

  const deleteSubProject = useMutation({
    mutationFn: (id) => base44.entities.SubProject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subprojects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['flats', projectId] });
      toast({ title: 'Sub-project Deleted', description: 'Associated flats structure has been deleted.' });
    }
  });

  const deleteMepBoq = useMutation({
    mutationFn: (id) => base44.entities.MepBoq.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mep_boqs', projectId] });
      toast({ title: 'BOQ Activity Deleted' });
    }
  });

  const linkActivity = useMutation({
    mutationFn: ({ activityId, budgetItemId }) => base44.entities.ScheduleActivity.update(activityId, { budget_item_id: budgetItemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      toast({ title: 'Activity Connected', description: 'Budget ecosystem linked.' });
    }
  });

  const unlinkActivity = useMutation({
    mutationFn: (activityId) => base44.entities.ScheduleActivity.update(activityId, { budget_item_id: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      toast({ title: 'Activity Unlinked' });
    }
  });

  // Automated L3 budget generator mutation
  const generateL3Budget = useMutation({
    mutationFn: async () => {
      if (subProjects.length === 0 || mepBoqs.length === 0) {
        throw new Error('Please configure sub-projects and MEP BOQ activities first.');
      }

      // Fetch L1 budget heads for this project
      const l1BudgetHeads = budgetItems.filter(b => b.level === 1);
      if (l1BudgetHeads.length === 0) {
        throw new Error('Please initialize L1 budget heads first.');
      }

      const generatedL3Items = [];

      for (const subProj of subProjects) {
        const floors = subProj.floors_count;
        const flatsInSubProj = flats.filter(f => f.sub_project_id === subProj.id);
        const flatsPerFloor = subProj.flats_per_floor;

        for (let floor = 1; floor <= floors; floor++) {
          for (const boq of mepBoqs) {
            // Find parent L1 budget head
            const parentL1 = l1BudgetHeads.find(l1 => l1.code.includes(boq.budget_head_code.split('-')[0]));
            if (!parentL1) continue;

            const isFlatScope = boq.scope_type === 'flat';
            const rate = parseFloat(boq.rate_per_unit) || 0;
            const qtyPerScope = parseFloat(boq.quantity_per_scope) || 1;
            
            // Calculate budget amount for the floor
            const quantity = isFlatScope ? flatsPerFloor : 1;
            const unit = isFlatScope ? 'flats' : 'floor';
            const costPerUnit = rate * qtyPerScope;
            const floorBudget = quantity * costPerUnit;

            generatedL3Items.push({
              project_id: projectId,
              code: `${parentL1.code}-L3-${floor}-${subProj.name.replace(/\s+/g, '').slice(0, 3).toUpperCase()}-${boq.activity_name.replace(/\s+/g, '').slice(0, 3).toUpperCase()}`,
              title: `Floor ${floor} - ${subProj.name} - ${boq.activity_name}`,
              level: 3,
              parent_id: parentL1.id,
              quantity: quantity,
              cost_per_unit: costPerUnit,
              unit: unit,
              original_budget: floorBudget,
              revised_budget: floorBudget,
              committed_cost: 0,
              actual_cost: 0,
              forecast_cost: floorBudget,
              revision_notes: `Auto-generated from MEP BOQ of ${subProj.name}.`,
              revision_number: 0,
              sub_project: subProj.name,
              rate_per_sqft: parseFloat((floorBudget / (subProj.built_up_area / floors)).toFixed(2))
            });
          }
        }
      }

      if (generatedL3Items.length > 0) {
        await base44.entities.BudgetItem.bulkCreate(generatedL3Items);
      }
      return generatedL3Items.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['budgetItems', projectId] });
      toast({ 
        title: 'L3 Budget Populated', 
        description: `Successfully created ${count} L3 floor-wise budget items under correct heads.` 
      });
    },
    onError: (err) => {
      toast({ 
        title: 'Generator Failed', 
        description: err.message,
        variant: 'destructive'
      });
    }
  });

  // Calculate helpers
  const totalSubProjectsArea = subProjects.reduce((sum, sp) => sum + (parseFloat(sp.built_up_area) || 0), 0);
  const totalSubProjectsFlats = subProjects.reduce((sum, sp) => sum + (sp.floors_count * sp.flats_per_floor), 0);
  const totalMepBoqEst = mepBoqs.reduce((sum, boq) => {
    const totalUnits = boq.scope_type === 'flat' ? totalSubProjectsFlats : subProjects.reduce((s, sp) => s + sp.floors_count, 0);
    return sum + (totalUnits * (parseFloat(boq.rate_per_unit) || 0) * (parseFloat(boq.quantity_per_scope) || 1));
  }, 0);

  // Set default subproject filter — removed; user must select sub-project

  const isScopeReady = !!projectId && !!selectedSubProjectId;
  const activeSubProject = subProjects.find(sp => sp.id === selectedSubProjectId);
  const flatsInActiveSubProject = flats.filter(f => f.sub_project_id === selectedSubProjectId);
  
  // Group flats by floor for active subproject
  const floorsMap = {};
  if (activeSubProject) {
    for (let f = 1; f <= activeSubProject.floors_count; f++) {
      floorsMap[f] = flatsInActiveSubProject.filter(flat => flat.floor_number === f);
    }
  }

  // Matching logic variables (Schedule Integration)
  const l3BudgetItems = budgetItems.filter(b => b.level === 3 && b.project_id === projectId);
  
  const mappingSuggestions = l3BudgetItems.map(item => {
    // Find same L1 budget head matching
    // Extract code e.g. "11-ELE" from budget item code or parent_id code
    const parentHead = budgetItems.find(p => p.id === item.parent_id);
    const headCode = parentHead ? parentHead.code : '';
    
    // Filter activities: must not have a budget item linked, or is linked to this item
    // And is mapped to the same type of work
    const potentialActivities = activities.filter(act => {
      // Find L1 head code of the activity by name fuzzy matching, or check if it matches the parent category
      // To strictly match same budget head: 11-ELE contains "ELE" / "Electrical", 10-PLU contains "PLU" / "Plumbing", 13-FF contains "FF" / "Fire"
      const actName = act.name.toLowerCase();
      let actCategory = '';
      if (actName.includes('electrical') || actName.includes('wiring') || actName.includes('conduit') || actName.includes('switch')) actCategory = '11-ELE';
      else if (actName.includes('plumb') || actName.includes('piping') || actName.includes('drain') || actName.includes('sanit')) actCategory = '10-PLU';
      else if (actName.includes('fire') || actName.includes('sprinkler') || actName.includes('alarm') || actName.includes('exting')) actCategory = '13-FF';
      else if (actName.includes('excav') || actName.includes('earth') || actName.includes('backfill')) actCategory = '01-EAR';
      else if (actName.includes('rcc') || actName.includes('concrete') || actName.includes('slab') || actName.includes('column')) actCategory = '02-RCC';
      
      // Allow if activity belongs to this head code category
      return actCategory === headCode;
    });

    // Compute similarity score for each potential activity
    const suggestions = potentialActivities.map(act => {
      const score = computeNameSimilarity(item.title, act.name);
      return { activity: act, score };
    }).filter(s => s.score >= fuzzyThreshold)
      .sort((a, b) => b.score - a.score);

    // Current linked activity if any
    const linkedActivity = activities.find(a => a.budget_item_id === item.id);

    return {
      budgetItem: item,
      linkedActivity,
      suggestions: suggestions.slice(0, 3) // suggest top 3
    };
  });

  // Approved progress entries logic (Cost Controls Lock)
  const approvedProgress = progressEntries.filter(p => p.status === 'approved');
  const lockedSpent = approvedProgress.reduce((sum, p) => sum + (parseFloat(p.value_of_work_done) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header and project switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-accent" />
            MEP BOQs & Cost Controls
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Advanced cost validation ecosystem: flat-wise BOQs, automated L3 floor budgets, and locked cost controls.
          </p>
        </div>
        <ProjectSubProjectSelector
          projects={projects}
          subProjects={subProjects}
          projectId={projectId}
          subProjectId={selectedSubProjectId}
          onProjectChange={(val) => { setProjectId(val); setSelectedSubProjectId(''); }}
          onSubProjectChange={setSelectedSubProjectId}
        />
      </div>

      {!projectId ? (
        <SubProjectGate projectId={projectId} subProjectId={selectedSubProjectId} subProjects={subProjects} />
      ) : (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sub-Projects Area</p>
              <p className="text-xl font-bold mt-1">{totalSubProjectsArea.toLocaleString()} SQFT</p>
              <p className="text-[10px] text-muted-foreground mt-1">{subProjects.length} Towers / Packages configured</p>
            </div>
            <Building2 className="w-8 h-8 text-primary/30" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Breakdown Total</p>
              <p className="text-xl font-bold mt-1">{totalSubProjectsFlats} Flats</p>
              <p className="text-[10px] text-muted-foreground mt-1">Populated across all floors</p>
            </div>
            <Home className="w-8 h-8 text-blue-500/30" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">MEP BOQ Baseline</p>
              <p className="text-xl font-bold mt-1">{formatCompactCurrencyINR(totalMepBoqEst)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{mepBoqs.length} MEP activities budgeted</p>
            </div>
            <Hammer className="w-8 h-8 text-accent/30" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Locked Spent (Approved)</p>
              <p className="text-xl font-bold mt-1 text-emerald-600 font-sans">{formatCompactCurrencyINR(lockedSpent)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-500" />
                Locked under strict Cost Controls
              </p>
            </div>
            <ClipboardCheck className="w-8 h-8 text-emerald-500/30" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="subprojects" className="rounded-lg text-sm font-medium">Sub-Projects & Flats</TabsTrigger>
          <TabsTrigger value="boq" disabled={!isScopeReady} className="rounded-lg text-sm font-medium">MEP BOQ baseline</TabsTrigger>
          <TabsTrigger value="l3gen" disabled={!isScopeReady} className="rounded-lg text-sm font-medium flex items-center gap-1">
            L3 Budget Gen
            <Sparkles className="w-3 h-3 text-amber-500" />
          </TabsTrigger>
          <TabsTrigger value="scheduler" disabled={!isScopeReady} className="rounded-lg text-sm font-medium">Schedule alignment</TabsTrigger>
          <TabsTrigger value="controls" disabled={!isScopeReady} className="rounded-lg text-sm font-medium">Cost Controls & locks</TabsTrigger>
        </TabsList>

        {/* Tab 1: Sub-projects and flats */}
        <TabsContent value="subprojects">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Sub-Projects Setup</CardTitle>
                  <CardDescription>Define structures and tower specs</CardDescription>
                </div>
                <Button size="sm" className="gap-1.5" onClick={() => setShowSubProjectModal(true)}>
                  Add Sub-Project
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingSubProjects ? (
                  <div className="text-center py-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading setup...
                  </div>
                ) : subProjects.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg p-4 bg-muted/10">
                    No sub-projects defined yet. Click above to configure.
                  </div>
                ) : (
                  subProjects.map(sp => (
                    <div 
                      key={sp.id} 
                      onClick={() => setSelectedSubProjectId(sp.id)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all hover:bg-muted/30 ${
                        selectedSubProjectId === sp.id 
                          ? 'border-primary bg-primary/5 shadow-sm' 
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{sp.name}</h3>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete sub-project "${sp.name}" and all generated flats breakdown?`)) {
                              deleteSubProject.mutate(sp.id);
                            }
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2.5 text-xs text-muted-foreground font-sans">
                        <div>
                          <span className="block font-semibold text-foreground">{sp.built_up_area.toLocaleString()}</span>
                          <span>BU Area (sqft)</span>
                        </div>
                        <div>
                          <span className="block font-semibold text-foreground">{sp.floors_count}</span>
                          <span>Floors</span>
                        </div>
                        <div>
                          <span className="block font-semibold text-foreground">{sp.flats_per_floor}</span>
                          <span>Flats/Floor</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Flats Breakdown & Floor Mapping</CardTitle>
                <CardDescription>
                  {activeSubProject 
                    ? `Interactive floor grid for ${activeSubProject.name} (${activeSubProject.floors_count} Floors, ${activeSubProject.flats_per_floor} flats each)`
                    : 'Select a sub-project to inspect the floor mapping grid'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeSubProject ? (
                  <div className="space-y-4">
                    {/* Floor selector tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 border-b">
                      {Array.from({ length: activeSubProject.floors_count }).map((_, idx) => {
                        const floorNum = activeSubProject.floors_count - idx; // show top floor first
                        return (
                          <button
                            key={floorNum}
                            onClick={() => setSelectedFloor(floorNum)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
                              selectedFloor === floorNum 
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-muted text-muted-foreground hover:bg-muted/70'
                            }`}
                          >
                            Floor {floorNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Flat Grid for selected floor */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 font-sans">
                        Floor {selectedFloor} Flats Layout
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(floorsMap[selectedFloor] || []).map(flat => (
                          <div key={flat.id} className="p-3 border rounded-xl bg-card hover:bg-muted/20 transition-all text-center space-y-1">
                            <span className="block text-xs font-bold text-muted-foreground">Flat</span>
                            <span className="block font-bold text-sm text-foreground">{flat.flat_number}</span>
                            <span className="block text-[10px] text-muted-foreground font-sans">{flat.area_sqft} SQFT</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-sm text-muted-foreground font-sans border border-dashed rounded-xl">
                    <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    No active sub-project selected. Select or configure a sub-project from the left.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: MEP BOQ Baseline */}
        <TabsContent value="boq">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">MEP Department BOQ Activities</CardTitle>
                <CardDescription>Baseline rates for non-granular budget heads (Electrical, Plumbing, Firefighting)</CardDescription>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setShowMepModal(true)}>
                Add BOQ Activity
              </Button>
            </CardHeader>
            <CardContent>
              {loadingMepBoqs ? (
                <div className="text-center py-12 text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading BOQ...
                </div>
              ) : mepBoqs.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground border border-dashed rounded-xl">
                  <Hammer className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  No MEP activities configured. Click Add BOQ Activity to create the baseline.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b bg-muted/50 font-bold text-xs uppercase text-muted-foreground tracking-wider font-sans">
                        <th className="p-3">Budget Head</th>
                        <th className="p-3">Activity Name</th>
                        <th className="p-3">Scope Scope</th>
                        <th className="p-3 text-right">Quantity</th>
                        <th className="p-3 text-right">Rate (₹)</th>
                        <th className="p-3 text-right">Est. Unit Cost</th>
                        <th className="p-3 text-right">Total Estimated (₹)</th>
                        <th className="p-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mepBoqs.map(boq => {
                        const totalUnits = boq.scope_type === 'flat' 
                          ? totalSubProjectsFlats 
                          : subProjects.reduce((s, sp) => s + sp.floors_count, 0);
                        const rate = parseFloat(boq.rate_per_unit) || 0;
                        const qty = parseFloat(boq.quantity_per_scope) || 1;
                        const totalCost = totalUnits * rate * qty;

                        return (
                          <tr key={boq.id} className="border-b hover:bg-muted/10 font-sans">
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] font-semibold font-mono">
                                {boq.budget_head_code}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold">{boq.activity_name}</td>
                            <td className="p-3 capitalize">{boq.scope_type}-wise</td>
                            <td className="p-3 text-right font-mono">{qty} {boq.unit}</td>
                            <td className="p-3 text-right font-mono">{formatCurrencyINR(rate)}</td>
                            <td className="p-3 text-right font-mono">{formatCurrencyINR(rate * qty)}</td>
                            <td className="p-3 text-right font-bold font-mono text-primary">{formatCurrencyINR(totalCost)}</td>
                            <td className="p-3 text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm('Delete this MEP BOQ baseline item?')) {
                                    deleteMepBoq.mutate(boq.id);
                                  }
                                }}
                              >
                                ✕
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: L3 Budget Generator */}
        <TabsContent value="l3gen">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-base font-bold">L3 Budget Maturation Engine</CardTitle>
                <CardDescription>Auto-populate flat/floor cost breakups</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2 text-muted-foreground font-sans leading-relaxed">
                  <p>
                    By merging the <strong>Flats Breakdown Grid</strong> and the <strong>MEP BOQ Activity Rates</strong>, the maturation engine generates floor-wise budget lines.
                  </p>
                  <p>
                    This is strictly created for:
                  </p>
                  <ul className="list-disc list-inside text-xs space-y-1 font-semibold text-foreground">
                    <li>11. Electrical Work</li>
                    <li>13. Fire Fighting work</li>
                    <li>10. Plumbing and Drainage Work</li>
                  </ul>
                  <p className="text-xs">
                    This populates the L3 budget which is necessary to align the activity schedule and track actual progress.
                  </p>
                </div>

                <div className="pt-2 border-t border-border">
                  <Button 
                    className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-95 text-white font-bold"
                    onClick={() => generateL3Budget.mutate()}
                    disabled={generateL3Budget.isPending || subProjects.length === 0 || mepBoqs.length === 0}
                  >
                    {generateL3Budget.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Populating L3...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Matures L3 Budget (Auto-Gen)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Active L3 Budgets Generated</CardTitle>
                <CardDescription>Floor-wise line items mapped under L1 heads</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBudget ? (
                  <div className="text-center py-12 text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading budget tree...
                  </div>
                ) : l3BudgetItems.length === 0 ? (
                  <div className="text-center py-16 text-sm text-muted-foreground border border-dashed rounded-xl">
                    <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    No generated L3 budget items found. Run the engine on the left to populate.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {/* Unique Budget Head groupings */}
                    {['10-PLU', '11-ELE', '13-FF'].map(headCode => {
                      const parent = budgetItems.find(p => p.level === 1 && p.code.includes(headCode.split('-')[0]));
                      const itemsInHead = l3BudgetItems.filter(b => b.parent_id === parent?.id);
                      if (itemsInHead.length === 0) return null;

                      return (
                        <div key={headCode} className="space-y-2">
                          <h4 className="text-xs font-bold text-muted-foreground font-mono uppercase bg-muted/60 p-2 rounded-lg flex items-center justify-between">
                            <span>{parent?.code} — {parent?.title}</span>
                            <Badge variant="outline" className="bg-primary/5 text-primary text-[10px]">
                              {itemsInHead.length} items
                            </Badge>
                          </h4>
                          <div className="divide-y border rounded-xl overflow-hidden bg-card">
                            {itemsInHead.map(item => (
                              <div key={item.id} className="p-3 flex items-center justify-between hover:bg-muted/10 transition-colors font-sans text-xs">
                                <div>
                                  <div className="font-semibold text-sm text-foreground">{item.title}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                    Code: {item.code} | {item.sub_project} | Qty: {item.quantity} {item.unit} @ {formatCurrencyINR(item.cost_per_unit)}/unit
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-sm text-primary">{formatCurrencyINR(item.original_budget)}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    Est. Rate/sqft: ₹{item.rate_per_sqft || 0}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Schedule activity integrator */}
        <TabsContent value="scheduler">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">L3 Budget to Schedule Activity Alignment</CardTitle>
                <CardDescription>Use fuzzy logic matching to link schedule activities to matured budget lines</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Fuzzy Threshold:</Label>
                <Select value={String(fuzzyThreshold)} onValueChange={v => setFuzzyThreshold(parseFloat(v))}>
                  <SelectTrigger className="w-24 h-8 bg-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.1">0.1 (Very Loose)</SelectItem>
                    <SelectItem value="0.3">0.3 (Medium)</SelectItem>
                    <SelectItem value="0.5">0.5 (Strict)</SelectItem>
                    <SelectItem value="0.7">0.7 (Exact Words)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBudget || loadingActivities ? (
                <div className="text-center py-12 text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading alignment board...
                </div>
              ) : l3BudgetItems.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground border border-dashed rounded-xl">
                  <Link2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  No L3 budget items available to align. Maturing the L3 budget is required first.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs bg-muted/60 p-3 rounded-lg text-muted-foreground font-sans">
                    💡 Connections are allowed only for items in the same <strong>L1 Budget Head</strong>. The suggestions list matches scheduled activities matching keywords (like Floor number, Trade, etc.) using Dice coefficient matching.
                  </div>
                  
                  <div className="divide-y border rounded-xl overflow-hidden bg-card">
                    {mappingSuggestions.map(({ budgetItem, linkedActivity, suggestions }) => (
                      <div key={budgetItem.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/5 transition-colors font-sans text-xs">
                        <div className="space-y-1 md:max-w-[40%]">
                          <Badge variant="outline" className="text-[9px] font-semibold uppercase font-mono">
                            {budgetItem.code.split('-L3-')[0]}
                          </Badge>
                          <h4 className="font-semibold text-sm text-foreground">{budgetItem.title}</h4>
                          <p className="text-[10px] text-muted-foreground">
                            Subproject: {budgetItem.sub_project} | Budget: <strong className="text-primary">{formatCurrencyINR(budgetItem.original_budget)}</strong>
                          </p>
                        </div>

                        {/* Linked status */}
                        <div className="flex-1 flex flex-col justify-center max-w-sm">
                          {linkedActivity ? (
                            <div className="p-2 border border-emerald-200 bg-emerald-500/5 rounded-xl flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">Linked Activity</span>
                                <span className="font-bold text-sm text-emerald-800">{linkedActivity.name}</span>
                                <span className="text-[9px] text-emerald-600 block mt-0.5 font-mono">ID: {linkedActivity.activity_id} | Progress: {linkedActivity.progress}%</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0" 
                                onClick={() => unlinkActivity.mutate(linkedActivity.id)}
                              >
                                <Unlink className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="p-2 border border-dashed rounded-xl text-muted-foreground text-center">
                              Not linked to scheduling calendar
                            </div>
                          )}
                        </div>

                        {/* Suggestions panel */}
                        <div className="md:w-72 space-y-1.5 border-l pl-4">
                          <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Fuzzy Suggestions</span>
                          {!linkedActivity && suggestions.length === 0 ? (
                            <span className="text-muted-foreground text-xs italic block py-1">No activities meet threshold</span>
                          ) : !linkedActivity && suggestions.map(({ activity, score }) => (
                            <button
                              key={activity.id}
                              onClick={() => linkActivity.mutate({ activityId: activity.id, budgetItemId: budgetItem.id })}
                              className="w-full text-left p-1.5 border rounded-lg bg-muted/30 hover:bg-primary/5 hover:border-primary/50 transition-all flex items-center justify-between gap-2"
                            >
                              <div className="overflow-hidden">
                                <span className="font-semibold text-foreground text-xs block truncate">{activity.name}</span>
                                <span className="text-[9px] text-muted-foreground block font-mono">{activity.activity_id} | Progress: {activity.progress}%</span>
                              </div>
                              <Badge className="bg-primary/10 text-primary text-[9px] hover:bg-primary/20 shrink-0">
                                Link ({(score * 100).toFixed(0)}%)
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Cost Controls and locks */}
        <TabsContent value="controls">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  Cost Lock Status Ledger
                </CardTitle>
                <CardDescription>Once daily work progress is approved, cost allocations are locked in place under compliance</CardDescription>
              </CardHeader>
              <CardContent>
                {approvedProgress.length === 0 ? (
                  <div className="text-center py-16 text-sm text-muted-foreground border border-dashed rounded-xl">
                    <Lock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    No approved progress logs yet. Daily logs with "approved" status will populate the ledger.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b bg-muted/50 font-bold text-xs uppercase text-muted-foreground tracking-wider font-sans">
                          <th className="p-3">DPR Date</th>
                          <th className="p-3">Budget Item</th>
                          <th className="p-3">Work done description</th>
                          <th className="p-3 text-right">Quantity done</th>
                          <th className="p-3 text-right">Unit Rate (₹)</th>
                          <th className="p-3 text-right">Earned Cost (₹)</th>
                          <th className="p-3 text-center">Lock Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedProgress.map(entry => {
                          const budgetItem = budgetItems.find(b => b.id === entry.budget_item_id);
                          const rate = budgetItem ? (parseFloat(budgetItem.cost_per_unit) || 0) : 0;
                          
                          return (
                            <tr key={entry.id} className="border-b hover:bg-muted/10 font-sans">
                              <td className="p-3 font-semibold font-mono">{entry.date}</td>
                              <td className="p-3">
                                <div>
                                  <span className="font-semibold block">{budgetItem?.title || 'Unknown item'}</span>
                                  <span className="text-[9px] text-muted-foreground font-mono">{budgetItem?.code}</span>
                                </div>
                              </td>
                              <td className="p-3 text-xs text-muted-foreground max-w-xs truncate" title={entry.work_done_description}>
                                {entry.work_done_description}
                              </td>
                              <td className="p-3 text-right font-mono">{entry.quantity_done} {entry.unit}</td>
                              <td className="p-3 text-right font-mono">{formatCurrencyINR(rate)}</td>
                              <td className="p-3 text-right font-bold text-emerald-600 font-mono">{formatCurrencyINR(parseFloat(entry.value_of_work_done) || 0)}</td>
                              <td className="p-3 text-center">
                                <Badge className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/15 border-emerald-600/20 border gap-1 text-[10px]">
                                  <Lock className="w-3 h-3 text-emerald-600" />
                                  LOCKED
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-base font-bold">Compliance Rules</CardTitle>
                <CardDescription>Enforcing strict Cost Control Ledger parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3.5 font-sans text-xs">
                  <div className="p-3 rounded-xl border bg-amber-500/5 border-amber-500/20 flex gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-700">Immutability Lock</h4>
                      <p className="text-muted-foreground mt-0.5">
                        Approved progress cannot be reduced or deleted, protecting the ledger against retroactive adjustments.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20 flex gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-700">Ecosystem Integrity</h4>
                      <p className="text-muted-foreground mt-0.5">
                        Budget matching guarantees all labor and subcontractor payments map directly to their corresponding L1 categories.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-blue-500/5 border-blue-500/20 flex gap-2.5">
                    <TrendingUp className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-blue-700">Earned Value Reporting</h4>
                      <p className="text-muted-foreground mt-0.5">
                        Actual costs are computed automatically as quantity executed multiplied by the approved BOQ rate.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </>
      )}

      {/* SubProject Creation Modal */}
      <Dialog open={showSubProjectModal} onOpenChange={setShowSubProjectModal}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle>Configure New Sub-Project</DialogTitle>
            <DialogDescription>Setup structure details. Flats breakdown will be automatically generated floor-wise.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Sub-project / Tower Name *</Label>
              <Input 
                value={subProjForm.name} 
                onChange={e => setSubProjForm({ ...subProjForm, name: e.target.value })} 
                placeholder="e.g. Tower A" 
              />
            </div>
            
            <div className="space-y-1">
              <Label>Built Up Area (SQFT) *</Label>
              <Input 
                type="number" 
                value={subProjForm.built_up_area} 
                onChange={e => setSubProjForm({ ...subProjForm, built_up_area: e.target.value })} 
                placeholder="e.g. 50000" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Number of Floors</Label>
                <Input 
                  type="number" 
                  value={subProjForm.floors_count} 
                  onChange={e => setSubProjForm({ ...subProjForm, floors_count: e.target.value })} 
                />
              </div>
              <div className="space-y-1">
                <Label>Flats per Floor</Label>
                <Input 
                  type="number" 
                  value={subProjForm.flats_per_floor} 
                  onChange={e => setSubProjForm({ ...subProjForm, flats_per_floor: e.target.value })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubProjectModal(false)}>Cancel</Button>
            <Button 
              onClick={() => createSubProject.mutate({ 
                project_id: projectId,
                name: subProjForm.name,
                built_up_area: parseFloat(subProjForm.built_up_area) || 0,
                floors_count: parseInt(subProjForm.floors_count) || 1,
                flats_per_floor: parseInt(subProjForm.flats_per_floor) || 0
              })}
              disabled={!subProjForm.name || !subProjForm.built_up_area || createSubProject.isPending}
            >
              Configure & Generate Flats
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MEP BOQ Creation Modal */}
      <Dialog open={showMepModal} onOpenChange={setShowMepModal}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle>Add MEP BOQ Baseline Activity</DialogTitle>
            <DialogDescription>Specify rate, scope type, and target category for the estimation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>L1 Budget Head *</Label>
              <Select 
                value={mepForm.budget_head_code} 
                onValueChange={val => setMepForm({ ...mepForm, budget_head_code: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10-PLU">10. Plumbing, Drainage Work</SelectItem>
                  <SelectItem value="11-ELE">11. Electrical Work</SelectItem>
                  <SelectItem value="13-FF">13. Buildings Fire Fighting Work</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Activity Name *</Label>
              <Input 
                value={mepForm.activity_name} 
                onChange={e => setMepForm({ ...mepForm, activity_name: e.target.value })} 
                placeholder="e.g. PVC Conduit Laying" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Scope Type</Label>
                <Select 
                  value={mepForm.scope_type} 
                  onValueChange={val => setMepForm({ ...mepForm, scope_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat-wise rate</SelectItem>
                    <SelectItem value="floor">Floor-wise rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Measurement Unit</Label>
                <Input 
                  value={mepForm.unit} 
                  onChange={e => setMepForm({ ...mepForm, unit: e.target.value })} 
                  placeholder="e.g. Nos, Meters" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Rate per unit (₹) *</Label>
                <Input 
                  type="number" 
                  value={mepForm.rate_per_unit} 
                  onChange={e => setMepForm({ ...mepForm, rate_per_unit: e.target.value })} 
                  placeholder="e.g. 150" 
                />
              </div>
              <div className="space-y-1">
                <Label>Quantity per Scope</Label>
                <Input 
                  type="number" 
                  value={mepForm.quantity_per_scope} 
                  onChange={e => setMepForm({ ...mepForm, quantity_per_scope: e.target.value })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMepModal(false)}>Cancel</Button>
            <Button 
              onClick={() => createMepBoq.mutate({ 
                project_id: projectId,
                budget_head_code: mepForm.budget_head_code,
                activity_name: mepForm.activity_name,
                scope_type: mepForm.scope_type,
                unit: mepForm.unit,
                rate_per_unit: parseFloat(mepForm.rate_per_unit) || 0,
                quantity_per_scope: parseFloat(mepForm.quantity_per_scope) || 1
              })}
              disabled={!mepForm.activity_name || !mepForm.rate_per_unit || createMepBoq.isPending}
            >
              Add Activity to BOQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
