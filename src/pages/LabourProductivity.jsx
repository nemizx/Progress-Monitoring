import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  FileSpreadsheet, Printer, Loader2, TrendingUp, Users, Award, ShieldAlert, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useProjectSubProject } from '@/hooks/useProjectSubProject';
import { downloadLabourProductivityExcel } from '@/lib/labourProductivityExcelExport';

export default function LabourProductivity() {
  // Use project sub-project hook to get projects and subprojects
  const {
    projects, subProjects, projectId, setProjectId
  } = useProjectSubProject({ fetchWbs: false });

  const [subProjectId, setSubProjectId] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [contractorId, setContractorId] = useState('all');
  const [typeOfWork, setTypeOfWork] = useState('all');

  // Load contractors for filtering list
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-list'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 100),
  });

  // Fetch productivity report data dynamically
  const { data: productivityData = [], isLoading, error } = useQuery({
    queryKey: ['labour-productivity-report', projectId, subProjectId, fromDate, toDate, contractorId, typeOfWork],
    queryFn: () => {
      if (!projectId) return Promise.resolve([]);
      return base44.analytics.getLabourProductivity({
        project_id: projectId,
        sub_project_id: subProjectId === 'all' ? undefined : subProjectId,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        contractor_id: contractorId === 'all' ? undefined : contractorId,
        type_of_work: typeOfWork === 'all' ? undefined : typeOfWork,
      });
    },
    enabled: !!projectId,
  });

  // Synchronize sub-project lists when project changes
  useEffect(() => {
    setSubProjectId('all');
  }, [projectId]);

  // Extract unique Type of Work values from contractors list to feed filter dropdown
  const typeOfWorkOptions = useMemo(() => {
    const set = new Set();
    contractors.forEach((c) => {
      if (c.type_of_work) {
        c.type_of_work.split(',').forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort();
  }, [contractors]);

  // Calculate summary metrics based on report data
  const summaryMetrics = useMemo(() => {
    if (productivityData.length === 0) {
      return {
        totalQty: 0,
        totalLabour: 0,
        avgProductivity: 0,
        highest: null,
        lowest: null,
      };
    }

    let totalQty = 0;
    let totalLabour = 0;
    let highest = null;
    let lowest = null;

    productivityData.forEach((row) => {
      const qty = Number(row.executed_qty || 0);
      const lab = Number(row.total_labour || 0);
      const prod = Number(row.productivity || 0);

      totalQty += qty;
      totalLabour += lab;

      // Only track high/low for rows with valid productivity values
      if (prod > 0) {
        if (!highest || prod > Number(highest.productivity)) {
          highest = row;
        }
        if (!lowest || prod < Number(lowest.productivity)) {
          lowest = row;
        }
      }
    });

    const avgProductivity = totalLabour > 0 ? (totalQty / totalLabour) : 0;

    return {
      totalQty,
      totalLabour,
      avgProductivity,
      highest,
      lowest,
    };
  }, [productivityData]);

  // Transform data for the bar chart
  const chartData = useMemo(() => {
    return productivityData
      .filter((row) => Number(row.productivity) > 0)
      .map((row) => ({
        name: `${row.contractor_name} (${row.type_of_work})`,
        Productivity: Number(row.productivity),
        unit: row.unit,
      }));
  }, [productivityData]);

  // Export to Excel handler
  const handleExportExcel = async () => {
    if (productivityData.length === 0) return;
    
    const activeProjectName = projects.find((p) => p.id === projectId)?.name || '';
    const activeSubProjectName = subProjectId !== 'all' ? subProjects.find((s) => s.id === subProjectId)?.name : '';

    await downloadLabourProductivityExcel(productivityData, {
      projectName: activeProjectName,
      subProjectName: activeSubProjectName,
      fromDate,
      toDate,
    });
  };

  // Print report trigger
  const handlePrint = () => {
    window.print();
  };

  const selectedProjectName = projects.find((p) => p.id === projectId)?.name || 'Project';

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* Stylesheet specifically to optimize printed reports */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white;
            color: black;
          }
          .no-print {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          table {
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #999 !important;
          }
        }
      ` }} />

      {/* Title & Top Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Labour Productivity Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze contractor performance and labour productivity ratios derived directly from DPR Worksheet metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={productivityData.length === 0}
            className="h-9"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
          <Button
            size="sm"
            onClick={handleExportExcel}
            disabled={productivityData.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Filters Toolbar Card */}
      <Card className="shadow-sm border no-print">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            {/* Project Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Select Project *</Label>
              <Select value={projectId || undefined} onValueChange={setProjectId}>
                <SelectTrigger className="w-full bg-background text-xs">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub Project Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Sub-Project</Label>
              <Select value={subProjectId} onValueChange={setSubProjectId}>
                <SelectTrigger className="w-full bg-background text-xs">
                  <SelectValue placeholder="All sub-projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Sub-Projects</SelectItem>
                  {subProjects.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id} className="text-xs">{sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full text-xs h-9 bg-background"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full text-xs h-9 bg-background"
              />
            </div>

            {/* Contractor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Contractor</Label>
              <Select value={contractorId} onValueChange={setContractorId}>
                <SelectTrigger className="w-full bg-background text-xs">
                  <SelectValue placeholder="All contractors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Contractors</SelectItem>
                  {contractors.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type of Work */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Type of Work</Label>
              <Select value={typeOfWork} onValueChange={setTypeOfWork}>
                <SelectTrigger className="w-full bg-background text-xs">
                  <SelectValue placeholder="All work types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Work Types</SelectItem>
                  {typeOfWorkOptions.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loader Block */}
      {isLoading && (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Calculating productivity statistics dynamically...</p>
        </div>
      )}

      {/* Error Block */}
      {error && (
        <Card className="border-destructive shadow-sm">
          <CardContent className="p-6 flex items-center gap-4 text-destructive">
            <ShieldAlert className="w-8 h-8" />
            <div>
              <h3 className="font-semibold text-sm">Failed to Load Report</h3>
              <p className="text-xs mt-1 text-muted-foreground">{error.message || 'Unknown database exception occurred.'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Report Container */}
      {!isLoading && !error && projectId && (
        <div className="space-y-6 print-full-width">
          
          {/* Header block visible only during printing */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-slate-900">Labour Productivity Analytics Report</h1>
            <div className="grid grid-cols-2 text-xs text-slate-600 mt-2 gap-2">
              <div><strong>Project:</strong> {selectedProjectName}</div>
              {subProjectId !== 'all' && (
                <div><strong>Sub-Project:</strong> {subProjects.find(s => s.id === subProjectId)?.name}</div>
              )}
              <div><strong>Period:</strong> {fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Time'}</div>
              <div><strong>Generated Date:</strong> {new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="shadow-sm border">
              <CardContent className="p-4 flex flex-col justify-between h-24">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Executed Qty</span>
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-2 text-xl font-bold font-mono tracking-tight text-slate-800">
                  {summaryMetrics.totalQty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardContent className="p-4 flex flex-col justify-between h-24">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Labour</span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-2 text-xl font-bold font-mono tracking-tight text-slate-800">
                  {summaryMetrics.totalLabour.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">md</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardContent className="p-4 flex flex-col justify-between h-24">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Avg Productivity</span>
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-2 text-xl font-bold font-mono tracking-tight text-primary">
                  {summaryMetrics.avgProductivity.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">/Labour</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardContent className="p-4 flex flex-col justify-between h-24">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Highest Ratio</span>
                  <Award className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-1">
                  {summaryMetrics.highest ? (
                    <>
                      <div className="text-sm font-bold text-slate-800 font-mono">
                        {Number(summaryMetrics.highest.productivity).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">{summaryMetrics.highest.unit}/Labour</span>
                      </div>
                      <div className="text-[10px] truncate text-muted-foreground font-semibold mt-0.5">
                        {summaryMetrics.highest.contractor_name}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground italic mt-2">No ratio logged</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardContent className="p-4 flex flex-col justify-between h-24">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Lowest Ratio</span>
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-1">
                  {summaryMetrics.lowest ? (
                    <>
                      <div className="text-sm font-bold text-slate-800 font-mono">
                        {Number(summaryMetrics.lowest.productivity).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">{summaryMetrics.lowest.unit}/Labour</span>
                      </div>
                      <div className="text-[10px] truncate text-muted-foreground font-semibold mt-0.5">
                        {summaryMetrics.lowest.contractor_name}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground italic mt-2">No ratio logged</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Visual comparison chart - Hidden on print */}
          {chartData.length > 0 && (
            <Card className="shadow-sm border no-print">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-800">Labour Productivity Comparison (Ratios)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-800 text-white p-3 rounded-lg shadow-lg border border-slate-700 text-xs">
                              <p className="font-semibold">{item.name}</p>
                              <p className="mt-1 text-accent font-bold">
                                Ratio: {item.Productivity.toFixed(2)} {item.unit}/Labour
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="Productivity" radius={[4, 4, 0, 0]} maxBarSize={45}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#1e3a5f' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Report Data Table */}
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b no-print">
              <CardTitle className="text-sm font-semibold text-slate-800">Analytics Summary Table</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b text-slate-500 font-bold">
                      <th className="p-3 text-center w-16 border-r">Sr. No</th>
                      <th className="p-3 text-left border-r">Contractor Name</th>
                      <th className="p-3 text-left border-r">Type of Work</th>
                      <th className="p-3 text-right border-r">Executed Quantity</th>
                      <th className="p-3 text-center border-r">Unit</th>
                      <th className="p-3 text-right border-r">Total Labour Deployed</th>
                      <th className="p-3 text-right">Productivity Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productivityData.map((row, idx) => (
                      <tr key={`row-${idx}`} className="border-b hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 text-center text-muted-foreground border-r font-mono">{idx + 1}</td>
                        <td className="p-3 border-r font-semibold text-slate-800">{row.contractor_name}</td>
                        <td className="p-3 border-r font-medium text-slate-600">{row.type_of_work}</td>
                        <td className="p-3 border-r text-right font-mono font-bold text-slate-800">
                          {Number(row.executed_qty || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 border-r text-center text-slate-500">{row.unit || '—'}</td>
                        <td className="p-3 border-r text-right font-mono font-semibold text-slate-700">
                          {Number(row.total_labour || 0).toLocaleString()} md
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary bg-primary/5">
                          {Number(row.productivity || 0).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">{row.unit}/Labour</span>
                        </td>
                      </tr>
                    ))}
                    {productivityData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center p-12 text-muted-foreground italic">
                          No matching DPR worksheet progress and contractor labour logs found for the selected parameters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {productivityData.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100/60 font-bold border-t border-b-2 text-slate-700">
                        <td colSpan={3} className="p-3 text-center border-r">Total / Average</td>
                        <td className="p-3 border-r text-right font-mono">
                          {summaryMetrics.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 border-r text-center text-slate-500">—</td>
                        <td className="p-3 border-r text-right font-mono">
                          {summaryMetrics.totalLabour.toLocaleString()} md
                        </td>
                        <td className="p-3 text-right font-mono text-primary bg-primary/10">
                          {summaryMetrics.avgProductivity.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">/Labour</span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
