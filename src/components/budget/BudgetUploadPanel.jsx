import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';

const CONSTANT_BUDGET_HEADS = [
  { code: '01-PRE', title: 'Preliminaries & Site Setup', original_budget: 200000 },
  { code: '02-EXC', title: 'Excavation & Earthworks', original_budget: 300000 },
  { code: '03-SUB', title: 'Substructure & Foundation', original_budget: 2500000 },
  { code: '04-SUP', title: 'Superstructure RCC Frame', original_budget: 5000000 },
  { code: '05-MAS', title: 'Masonry & Partition Walls', original_budget: 800000 },
  { code: '06-WPF', title: 'Waterproofing & Insulation', original_budget: 400000 },
  { code: '07-PLT', title: 'Internal Plastering', original_budget: 500000 },
  { code: '08-FLR', title: 'Tiling & Flooring', original_budget: 900000 },
  { code: '09-DW',  title: 'Doors, Windows & Glazing', original_budget: 1500000 },
  { code: '10-ELE', title: 'Electrical Systems', original_budget: 1200000 },
  { code: '11-PLU', title: 'Plumbing & Sanitary', original_budget: 800000 },
  { code: '12-MEC', title: 'HVAC & Ventilation', original_budget: 1300000 },
  { code: '13-FF',  title: 'Fire Fighting & Alarms', original_budget: 600000 },
  { code: '14-PNT', title: 'Wall Painting & Finishes', original_budget: 400000 },
  { code: '15-LND', title: 'Roadworks & Landscaping', original_budget: 700000 },
  { code: '16-MIS', title: 'Contingencies & Miscellaneous', original_budget: 500000 }
];

const findParentBudgetHead = (lineItemText, l1Items) => {
  const text = (lineItemText || '').trim().toUpperCase();
  
  // 1. Check for numeric prefix at the start, e.g. "03-...", "3....", "12 ..."
  const numMatch = text.match(/^\s*(0?[1-9]|1[0-6])\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    const found = l1Items.find(item => item.code.startsWith(String(num).padStart(2, '0')));
    if (found) return found;
  }

  // 2. Check for alpha code prefix, e.g. "SUB-01", "SUP: columns"
  for (const item of l1Items) {
    const parts = item.code.split('-');
    const alphaCode = parts[1] || parts[0];
    if (text.startsWith(alphaCode)) {
      return item;
    }
  }

  // 3. Fallback: Search for keywords of L1 titles in the line item text
  for (const item of l1Items) {
    const titleWords = item.title.toUpperCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of titleWords) {
      if (text.includes(word)) {
        return item;
      }
    }
  }

  // 4. Default: Map to "16-MIS"
  return l1Items.find(item => item.code.includes('MIS')) || l1Items[0];
};

export default function BudgetUploadPanel({ projects, projectFilter, budgetItems, onSuccess }) {
  const [uploadProject, setUploadProject] = useState(projectFilter || '');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const projectBudgetItems = budgetItems.filter(b => !uploadProject || b.project_id === uploadProject);
  const l1Count = projectBudgetItems.filter(b => b.level === 1).length;
  const l2Count = projectBudgetItems.filter(b => b.level === 2).length;

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];
    
    // Parse headers, trim spaces and normalize
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });
  };

  const findVal = (row, possibleKeys) => {
    for (const k of possibleKeys) {
      const matchKey = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (matchKey !== undefined) return row[matchKey];
    }
    return null;
  };

  const handleUpload = async () => {
    if (!file || !uploadProject) return;
    setUploading(true);
    setError('');
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        setError('The selected CSV file is empty.');
        setUploading(false);
        return;
      }

      // Check if L1 items exist for this project, otherwise create the 16 constant categories
      let projectL1Items = budgetItems.filter(b => b.level === 1 && b.project_id === uploadProject);
      
      if (projectL1Items.length === 0) {
        const l1ToCreate = CONSTANT_BUDGET_HEADS.map((h, index) => ({
          id: `bud_${uploadProject}_l1_${index + 1}`,
          project_id: uploadProject,
          code: h.code,
          title: h.title,
          level: 1,
          parent_id: null,
          original_budget: h.original_budget,
          revised_budget: h.original_budget,
          committed_cost: 0,
          actual_cost: 0,
          forecast_cost: h.original_budget,
          revision_notes: 'Automated seeding of constant budget heads.',
          revision_number: 0
        }));
        await base44.entities.BudgetItem.bulkCreate(l1ToCreate);
        projectL1Items = l1ToCreate;
      }

      const toCreate = [];
      const skipped = [];
      const parentMap = {};

      rows.forEach((row, rowIndex) => {
        const title = findVal(row, ['line item', 'line_item', 'title', 'item']);
        const qtyStr = findVal(row, ['quantity', 'qty', 'planned quantity']);
        const rateStr = findVal(row, ['cost per unit quantity', 'cost per unit', 'unit cost', 'unit_cost', 'rate']);
        const unit = findVal(row, ['unit', 'measurement']) || 'unit';

        if (!title) {
          skipped.push(`Row ${rowIndex + 2}: Missing 'line item' column`);
          return;
        }

        const qty = parseFloat(qtyStr) || 0;
        const rate = parseFloat(rateStr) || 0;

        if (qty <= 0 || rate <= 0) {
          skipped.push(`"${title}": Invalid quantity (${qty}) or cost per unit (${rate})`);
          return;
        }

        const parentL1 = findParentBudgetHead(title, projectL1Items);
        const budgetAmount = qty * rate;

        toCreate.push({
          id: `bud_${uploadProject}_l2_${Date.now()}_${rowIndex}`,
          project_id: uploadProject,
          code: `${parentL1.code}-L2-${rowIndex + 1}`,
          title: title,
          level: 2,
          parent_id: parentL1.id,
          quantity: qty,
          cost_per_unit: rate,
          unit: unit,
          original_budget: budgetAmount,
          revised_budget: budgetAmount,
          committed_cost: 0,
          actual_cost: 0,
          forecast_cost: budgetAmount,
          revision_notes: 'Imported from CSV.',
          revision_number: 0
        });
      });

      if (toCreate.length > 0) {
        await base44.entities.BudgetItem.bulkCreate(toCreate);
        onSuccess?.();
      }

      setResult({ created: toCreate.length, skipped });
      setFile(null);
    } catch (err) {
      console.error(err);
      setError(`Failed to import budget: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status overview */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { level: 'L1 Categories', count: l1Count, color: 'border-l-primary', desc: 'Standard budget categories' },
          { level: 'Line Items', count: l2Count, color: 'border-l-blue-500', desc: 'Detailed cost estimators' },
        ].map(s => (
          <Card key={s.level} className={`border-l-4 ${s.color}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.level} ({s.desc})</p>
              </div>
              {s.count > 0 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-accent" />
            Upload Budget CSV
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The CSV file must contain the following columns:
            <code className="bg-muted px-1 rounded text-xs ml-1 font-mono">line item</code>,
            <code className="bg-muted px-1 rounded text-xs ml-1 font-mono">quantity</code>, and
            <code className="bg-muted px-1 rounded text-xs ml-1 font-mono">cost per unit quantity</code>.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The system will automatically initialize the 16 constant L1 budget heads for this project and map each line item to the correct category using keyword or prefix matching.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Project *</Label>
            <Select value={uploadProject} onValueChange={setUploadProject}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* File picker */}
          <div>
            <Label>CSV File</Label>
            <div className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => document.getElementById('budget-csv-input').click()}>
              <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              {file
                ? <p className="text-sm font-medium text-primary">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                : <p className="text-sm text-muted-foreground">Click to select a CSV file</p>}
              <input id="budget-csv-input" type="file" accept=".csv" className="hidden"
                onChange={e => { setFile(e.target.files[0]); setResult(null); setError(''); e.target.value = ''; }} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 space-y-1">
              <p className="text-sm text-emerald-700 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />{result.created} line items imported successfully
              </p>
              {result.skipped.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-700 font-medium">{result.skipped.length} rows skipped:</p>
                  <ul className="text-xs text-amber-600 list-disc list-inside mt-1 space-y-0.5 font-mono">
                    {result.skipped.slice(0, 5).map((s, i) => <li key={i}>{s}</li>)}
                    {result.skipped.length > 5 && <li>…and {result.skipped.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={!file || !uploadProject || uploading}
            onClick={handleUpload}
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Importing...</> : <><Upload className="w-4 h-4" />Import Budget CSV</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}