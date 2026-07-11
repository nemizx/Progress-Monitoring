import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Building2, Plus, Trash2, Loader2, Pencil,
  Upload, Download, FileSpreadsheet, UserPlus, FileText,
} from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const BUDGET_HEADS = [
  'Earth Work',
  'RCC',
  'Masonry and Plaster',
  'Waterproofing',
  'Doors and Wooden',
  'Windows and Sliding Doors',
  'Flooring and Tiling',
  'MS and SS Work- Grills and Railing',
  'Painting and polishing',
  'Plumbing and drainage',
  'Electric',
  'Lift',
  'Building Firefighting',
  'Elevation and Glazing and Facade',
  'Facade',
  'Misc and Dep. Labour and Cleaning',
  'Building Amenities',
  'Core and Shell',
];

const CONTRACTOR_FIELDS = [
  { key: 'vendor_code', label: 'Vendor Code', required: false, placeholder: 'Auto-generated', readOnly: true },
  { key: 'name', label: 'Company Name', required: true, placeholder: 'e.g. Raj Civil Contractors' },
  { key: 'contact_person', label: 'Contact Person', required: true, placeholder: 'e.g. Jane Doe' },
  { key: 'phone', label: 'Mobile no.', required: true, placeholder: 'e.g. 9876543210' },
  { key: 'email', label: 'Email id', required: true, placeholder: 'e.g. contact@company.com' },
  { key: 'address', label: 'Address', required: true, placeholder: 'e.g. 123 Main St' },
  { key: 'type_of_work', label: 'Type of work', required: true, placeholder: 'Select type of work...', type: 'select', options: BUDGET_HEADS },
  { key: 'vendor_category', label: 'Vendor Category', required: true, placeholder: 'Select category...', type: 'select', options: ['Labour', 'Labour with material'] },
  { key: 'remark', label: 'Remark', required: false, placeholder: 'Optional remark...' },
];

const TEMPLATE_HEADERS = [
  'Company Name',
  'Contact Person',
  'Mobile no.',
  'Email id',
  'Address',
  'Type of work',
  'Vendor Category',
  'Remark'
];

const HEADER_ALIASES = {
  name: ['company name', 'name', 'company', 'contractor name', 'contractor'],
  contact_person: ['contact person', 'contact', 'person'],
  phone: ['mobile no.', 'mobile', 'phone', 'phone no', 'mobile number'],
  email: ['email id', 'email', 'email address'],
  address: ['address', 'location'],
  type_of_work: ['type of work', 'trade', 'work type'],
  vendor_category: ['vendor category', 'category'],
  remark: ['remark', 'remarks', 'notes', 'note'],
};

const createEmptyRow = () => ({
  id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  type_of_work: '',
  vendor_category: '',
  remark: '',
});

const emptyContractor = () => ({
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  type_of_work: '',
  vendor_category: '',
  remark: '',
});

const normalizeHeader = (value) => String(value || '').trim().toLowerCase();

const mapHeaderToField = (header) => {
  const normalized = normalizeHeader(header);
  return Object.entries(HEADER_ALIASES).find(([, aliases]) => (
    aliases.includes(normalized)
  ))?.[0] || null;
};

const normalizeContractorRow = (row) => ({
  name: String(row.name || '').trim(),
  contact_person: String(row.contact_person || '').trim(),
  phone: String(row.phone || '').trim(),
  email: String(row.email || '').trim(),
  address: String(row.address || '').trim(),
  type_of_work: String(row.type_of_work || '').trim(),
  vendor_category: String(row.vendor_category || '').trim(),
  remark: String(row.remark || '').trim(),
});

export default function Contractors() {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [contractorRows, setContractorRows] = useState([createEmptyRow()]);
  const [editForm, setEditForm] = useState(emptyContractor());
  const [editingId, setEditingId] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [parsingImport, setParsingImport] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();

  useEffect(() => {
    // Reset Add/Edit states whenever navigation occurs (e.g. clicking Contractors in sidebar)
    setShowAdd(false);
    setShowEdit(false);
    setEditingId(null);
    setEditForm(emptyContractor());
    setContractorRows([createEmptyRow()]);
  }, [location.key]);

  const { data: contractors = [], isLoading: contractorsLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 1000),
  });

  const sortedContractors = useMemo(
    () => [...contractors].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)),
    [contractors]
  );

  const createContractorsMutation = useMutation({
    mutationFn: (items) => base44.entities.Contractor.bulkCreate(items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast({
        title: 'Contractors Added',
        description: `${variables.length} contractor${variables.length === 1 ? '' : 's'} added.`,
      });
      setShowAdd(false);
      setShowImport(false);
      setContractorRows([createEmptyRow()]);
      setImportFile(null);
      setImportRows([]);
      setImportErrors([]);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to add contractors: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const updateContractorMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast({ title: 'Contractor Updated', description: 'Contractor details saved.' });
      setShowEdit(false);
      setEditingId(null);
      setEditForm(emptyContractor());
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update contractor: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const deleteContractorMutation = useMutation({
    mutationFn: (id) => base44.entities.Contractor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast({ title: 'Contractor Removed', description: 'Contractor deleted.' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete contractor: ${error.message}`,
        variant: 'destructive',
      });
    },
  });


  const updateRow = (rowId, field, value) => {
    setContractorRows((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, [field]: value } : row
    )));
  };

  const addRow = () => setContractorRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (rowId) => {
    setContractorRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== rowId)));
  };

  const getValidRows = (rows) => rows
    .map(normalizeContractorRow)
    .filter((row) => row.name && row.contact_person && row.phone && row.email && row.address && row.type_of_work && row.vendor_category);

  const handleSubmitAdd = (e) => {
    e.preventDefault();
    
    const errors = [];
    contractorRows.forEach((row, i) => {
      const idx = i + 1;
      if (!row.name) errors.push(`Contractor #${idx}: Company Name is required.`);
      else if (!row.contact_person) errors.push(`Contractor #${idx}: Contact Person is required.`);
      else if (!row.phone) errors.push(`Contractor #${idx}: Mobile no. is required.`);
      else if (!row.email) errors.push(`Contractor #${idx}: Email id is required.`);
      else if (!row.address) errors.push(`Contractor #${idx}: Address is required.`);
      else if (!row.type_of_work) errors.push(`Contractor #${idx}: Type of work is required.`);
      else if (!row.vendor_category) errors.push(`Contractor #${idx}: Vendor Category is required.`);
    });

    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors[0],
        variant: 'destructive',
      });
      return;
    }

    const payload = contractorRows.map(normalizeContractorRow);
    createContractorsMutation.mutate(payload);
  };

  const handleOpenEdit = (contractor) => {
    setEditingId(contractor.id);
    setEditForm({
      vendor_code: contractor.vendor_code || '',
      name: contractor.name || '',
      contact_person: contractor.contact_person || '',
      phone: contractor.phone || '',
      email: contractor.email || '',
      address: contractor.address || '',
      type_of_work: contractor.type_of_work || '',
      vendor_category: contractor.vendor_category || '',
      remark: contractor.remark || '',
    });
    setShowEdit(true);
  };

  const handleSubmitEdit = (e) => {
    e.preventDefault();
    const payload = normalizeContractorRow(editForm);

    if (!payload.name) return toast({ title: 'Validation Error', description: 'Company Name is required.', variant: 'destructive' });
    if (!payload.contact_person) return toast({ title: 'Validation Error', description: 'Contact Person is required.', variant: 'destructive' });
    if (!payload.phone) return toast({ title: 'Validation Error', description: 'Mobile no. is required.', variant: 'destructive' });
    if (!payload.email) return toast({ title: 'Validation Error', description: 'Email id is required.', variant: 'destructive' });
    if (!payload.address) return toast({ title: 'Validation Error', description: 'Address is required.', variant: 'destructive' });
    if (!payload.type_of_work) return toast({ title: 'Validation Error', description: 'Type of work is required.', variant: 'destructive' });
    if (!payload.vendor_category) return toast({ title: 'Validation Error', description: 'Vendor Category is required.', variant: 'destructive' });

    updateContractorMutation.mutate({
      id: editingId,
      data: payload,
    });
  };

  const handleDelete = (id, name) => {
    if (confirm(`Remove ${name} from contractors?`)) {
      deleteContractorMutation.mutate(id);
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSXModule = await import('xlsx');
      const XLSX = XLSXModule.default || XLSXModule;

      const sampleRows = [
        ['Raj Civil Contractors', 'Jane Doe', '9876543210', 'contact@rajcivil.com', '123 Main St, Mumbai', 'RCC', 'Labour with material', 'Main civil works'],
        ['Spark Electricals', 'John Smith', '9876543211', 'spark@elec.com', '456 Side St, Pune', 'Electric', 'Labour', ''],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...sampleRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contractors');

      // Use XLSX.write to get raw array buffer (works reliably in browser)
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Contractor_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast({ title: '✅ Template Downloaded', description: 'Contractor_Template.xlsx saved to your Downloads.' });
    } catch (err) {
      console.error('Template download failed:', err);
      toast({ title: 'Download Failed', description: err.message || 'Could not download template.', variant: 'destructive' });
    }
  };

  const exportToPDF = async () => {
    try {
      toast({ title: 'Generating PDF…', description: 'Please wait while the PDF is being created.' });

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      });

      // Build off-screen render container
      const container = document.createElement('div');
      container.style.cssText = `
        position: fixed; top: -9999px; left: -9999px;
        width: 1100px; background: #ffffff; font-family: Arial, sans-serif;
      `;

      const rowsHtml = sortedContractors.map((c, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
          <td style="padding:7px 10px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a;white-space:nowrap;font-size:11px">${c.vendor_code || '<span style="color:#94a3b8;font-weight:400">Pending</span>'}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;font-size:11px">${c.name || '—'}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;color:#334155;font-size:11px">${c.contact_person || '—'}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;color:#334155;white-space:nowrap;font-size:11px">${c.phone || '—'}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;color:#334155;font-size:11px">${c.email || '—'}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;color:#475569;font-size:11px">${c.address || '—'}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;color:#334155;font-size:11px">${c.type_of_work || '—'}</td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-size:11px">
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;
              background:${(c.vendor_category || '').toLowerCase().includes('material') ? '#dbeafe' : '#dcfce7'};
              color:${(c.vendor_category || '').toLowerCase().includes('material') ? '#1d4ed8' : '#166534'}">
              ${c.vendor_category || '—'}
            </span>
          </td>
          <td style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-size:11px">${c.remark || '—'}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="background:#0f172a;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:17px;font-weight:700;letter-spacing:0.5px">Planedge — Contractors Directory</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">Project Management System</div>
          </div>
          <div style="text-align:right;font-size:11px;color:#94a3b8">
            Exported on: ${dateStr}<br/>
            <span style="font-size:10px">Confidential — Internal Use Only</span>
          </div>
        </div>
        <div style="padding:10px 20px 6px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0">
          <span style="font-size:12px;font-weight:600;color:#475569">All Registered Contractors</span>
          <span style="font-size:13px;font-weight:700;color:#0f172a;background:#f1f5f9;padding:3px 10px;border-radius:6px">Total: ${sortedContractors.length}</span>
        </div>
        <div style="padding:12px 20px">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:#1e293b;color:#fff">
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155;white-space:nowrap">Vendor Code</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155">Company Name</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155">Contact Person</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155;white-space:nowrap">Mobile No.</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155">Email ID</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155">Address</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155">Type of Work</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155">Category</th>
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;border:1px solid #334155">Remark</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div style="padding:8px 20px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:right">
          Planedge Project Monitoring System &nbsp;|&nbsp; Generated on ${dateStr}
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      // jsPDF v2 API — stable and well-tested
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();   // 297mm
      const pageH = pdf.internal.pageSize.getHeight();  // 210mm
      const imgRatio = canvas.height / canvas.width;
      const totalImgH = pageW * imgRatio;

      let yOffset = 0;
      let remaining = totalImgH;
      let isFirst = true;

      while (remaining > 0) {
        if (!isFirst) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -yOffset, pageW, totalImgH);
        yOffset += pageH;
        remaining -= pageH;
        isFirst = false;
      }

      const filename = `Contractors_Directory_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);

      toast({ title: '✅ PDF Downloaded', description: `Saved as ${filename}` });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast({ title: 'Export Failed', description: err.message || 'Could not generate PDF.', variant: 'destructive' });
    }
  };



  const parseImportFile = async (file) => {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rawRows.length) {
      return { rows: [], errors: ['The uploaded file is empty.'] };
    }

    const headerRow = rawRows[0].map((cell) => String(cell || '').trim());
    const fieldIndexes = {};
    headerRow.forEach((header, index) => {
      const field = mapHeaderToField(header);
      if (field && fieldIndexes[field] === undefined) {
        fieldIndexes[field] = index;
      }
    });

    const missingHeaders = [];
    if (fieldIndexes.name === undefined) missingHeaders.push('Company Name');
    if (fieldIndexes.contact_person === undefined) missingHeaders.push('Contact Person');
    if (fieldIndexes.phone === undefined) missingHeaders.push('Mobile no.');
    if (fieldIndexes.email === undefined) missingHeaders.push('Email id');
    if (fieldIndexes.address === undefined) missingHeaders.push('Address');
    if (fieldIndexes.type_of_work === undefined) missingHeaders.push('Type of work');
    if (fieldIndexes.vendor_category === undefined) missingHeaders.push('Vendor Category');

    if (missingHeaders.length > 0) {
      return {
        rows: [],
        errors: [`Missing required columns: ${missingHeaders.join(', ')}. Download the template and use the default headers.`],
      };
    }

    const rows = [];
    const errors = [];

    rawRows.slice(1).forEach((cells, index) => {
      const rowNumber = index + 2;
      const hasValues = cells.some((cell) => String(cell || '').trim());
      if (!hasValues) return;

      const parsed = normalizeContractorRow({
        name: cells[fieldIndexes.name],
        contact_person: cells[fieldIndexes.contact_person],
        phone: cells[fieldIndexes.phone],
        email: cells[fieldIndexes.email],
        address: cells[fieldIndexes.address],
        type_of_work: cells[fieldIndexes.type_of_work],
        vendor_category: cells[fieldIndexes.vendor_category],
        remark: fieldIndexes.remark !== undefined ? cells[fieldIndexes.remark] : '',
      });

      if (!parsed.name) errors.push(`Row ${rowNumber}: Company Name is required.`);
      else if (!parsed.contact_person) errors.push(`Row ${rowNumber}: Contact Person is required.`);
      else if (!parsed.phone) errors.push(`Row ${rowNumber}: Mobile no. is required.`);
      else if (!parsed.email) errors.push(`Row ${rowNumber}: Email id is required.`);
      else if (!parsed.address) errors.push(`Row ${rowNumber}: Address is required.`);
      else if (!parsed.type_of_work) errors.push(`Row ${rowNumber}: Type of work is required.`);
      else if (!parsed.vendor_category) errors.push(`Row ${rowNumber}: Vendor Category is required.`);

      // Validate and standardize Type of work
      if (parsed.type_of_work) {
        const val = String(parsed.type_of_work).trim().toLowerCase();
        const matchedHead = BUDGET_HEADS.find(bh => bh.toLowerCase() === val);
        if (matchedHead) {
          parsed.type_of_work = matchedHead; // use canonical casing
        } else {
          errors.push(`Row ${rowNumber}: "${parsed.type_of_work}" is not a valid Type of Work. Valid options: ${BUDGET_HEADS.join(', ')}.`);
        }
      }

      // Validate and standardize Category
      if (parsed.vendor_category) {
        const val = String(parsed.vendor_category).toLowerCase();
        const matchedCat = ['Labour', 'Labour with material'].find(c => c.toLowerCase() === val);
        if (matchedCat) {
          parsed.vendor_category = matchedCat;
        } else {
          errors.push(`Row ${rowNumber}: Vendor Category must be "Labour" or "Labour with material".`);
        }
      }

      rows.push({
        id: `import_${rowNumber}_${Math.random().toString(36).slice(2, 7)}`,
        ...parsed,
      });
    });

    if (!rows.length && !errors.length) {
      errors.push('No contractor rows found in the uploaded file.');
    }

    return { rows, errors };
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    setImportFile(file || null);
    setImportRows([]);
    setImportErrors([]);

    if (!file) return;

    setParsingImport(true);
    try {
      const parsed = await parseImportFile(file);
      setImportRows(parsed.rows);
      setImportErrors(parsed.errors);
    } catch (error) {
      setImportErrors([`Failed to parse file: ${error.message}`]);
    } finally {
      setParsingImport(false);
    }
  };

  const handleConfirmImport = () => {
    const validRows = getValidRows(importRows);
    if (!validRows.length) {
      toast({
        title: 'Validation Error',
        description: 'No valid contractor rows to import.',
        variant: 'destructive',
      });
      return;
    }

    if (importErrors.length) {
      toast({
        title: 'Import Blocked',
        description: 'Fix upload warnings before importing.',
        variant: 'destructive',
      });
      return;
    }

    createContractorsMutation.mutate(validRows);
  };

  const closeImportDialog = () => {
    setShowImport(false);
    setImportFile(null);
    setImportRows([]);
    setImportErrors([]);
    setParsingImport(false);
  };

  const handleBulkImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast({ title: 'Reading Excel File...', description: 'Please wait while we parse your file.' });
    try {
      const parsed = await parseImportFile(file);
      if (parsed.errors && parsed.errors.length > 0) {
        toast({
          title: 'Import Warning',
          description: parsed.errors[0] + (parsed.errors.length > 1 ? ` (and ${parsed.errors.length - 1} other warnings)` : ''),
          variant: 'destructive',
        });
      }

      if (parsed.rows && parsed.rows.length > 0) {
        // Map the rows to add client-side row IDs
        const newRows = parsed.rows.map(r => ({
          ...r,
          id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        }));

        setContractorRows(prev => {
          // Check if first row is untouched/empty
          const isFirstRowEmpty = prev.length === 1 && 
            !prev[0].name && 
            !prev[0].contact_person && 
            !prev[0].phone && 
            !prev[0].email && 
            !prev[0].address && 
            !prev[0].type_of_work && 
            !prev[0].vendor_category && 
            !prev[0].remark;

          if (isFirstRowEmpty) {
            return newRows;
          } else {
            return [...prev, ...newRows];
          }
        });

        toast({
          title: '✅ Import Successful',
          description: `Loaded ${parsed.rows.length} contractors into the fields below.`,
        });
      } else {
        toast({
          title: 'Import Failed',
          description: 'No valid contractor rows found in the uploaded file.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to read the Excel file: ' + error.message,
        variant: 'destructive',
      });
    }

    // Reset target input
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      {showAdd ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-primary" />
                Add Contractors
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-sans">
                Register one or more contractors
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" type="button" className="gap-2 text-sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4" /> Download Template
              </Button>
              <Button variant="outline" type="button" className="gap-2 text-sm" onClick={() => document.getElementById('bulk-import-file-input').click()}>
                <Upload className="w-4 h-4" /> Import from Excel
              </Button>
              <input
                id="bulk-import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleBulkImport}
              />
              <Button variant="outline" onClick={() => {
                setShowAdd(false);
                setContractorRows([createEmptyRow()]);
              }}>
                Cancel &amp; Back
              </Button>
            </div>
          </div>

          <Card className="p-6 shadow-sm">
            <form onSubmit={handleSubmitAdd} className="space-y-6">
              <div className="space-y-6">
                {contractorRows.map((row, index) => (
                  <div key={row.id} className="border rounded-lg p-5 bg-muted/10 relative space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-semibold text-sm text-primary">Contractor #{index + 1}</span>
                      {contractorRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeRow(row.id)}
                          title="Remove contractor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {CONTRACTOR_FIELDS.map((field) => {
                        if (field.key === 'vendor_code') return null; // Auto-generated
                        return (
                          <div key={field.key} className="space-y-1.5">
                            <Label className="text-xs font-semibold">
                              {field.label}{field.required ? ' *' : ''}
                            </Label>
                            {field.type === 'select' ? (
                              <Select
                                value={row[field.key]}
                                onValueChange={(val) => updateRow(row.id, field.key, val)}
                              >
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder={field.placeholder} />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                placeholder={field.placeholder}
                                value={row[field.key]}
                                onChange={(e) => updateRow(row.id, field.key, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button type="button" variant="outline" className="gap-2" onClick={addRow}>
                  <Plus className="w-4 h-4" /> Add Another Contractor
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => {
                    setShowAdd(false);
                    setContractorRows([createEmptyRow()]);
                  }}>Cancel</Button>
                  <Button type="submit" disabled={createContractorsMutation.isPending}>
                    {createContractorsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit {contractorRows.length > 1 ? `(${contractorRows.length})` : ''}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </>
      ) : showEdit ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading font-bold tracking-tight flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Edit Contractor
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-sans">
                Update contractor information
              </p>
            </div>
            <div>
              <Button variant="outline" onClick={() => {
                setShowEdit(false);
                setEditingId(null);
                setEditForm(emptyContractor());
              }}>
                Cancel &amp; Back
              </Button>
            </div>
          </div>

          <Card className="p-6 shadow-sm">
            <form onSubmit={handleSubmitEdit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CONTRACTOR_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {field.label}{field.required ? ' *' : ''}
                    </Label>
                    {field.type === 'select' ? (
                      <Select
                        value={editForm[field.key]}
                        onValueChange={(val) => setEditForm((prev) => ({ ...prev, [field.key]: val }))}
                      >
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder={field.placeholder}
                        value={editForm[field.key]}
                        disabled={field.readOnly}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => {
                  setShowEdit(false);
                  setEditingId(null);
                  setEditForm(emptyContractor());
                }}>Cancel</Button>
                <Button type="submit" disabled={updateContractorMutation.isPending}>
                  {updateContractorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading font-bold tracking-tight">Contractors</h1>
              <p className="text-sm text-muted-foreground mt-1 font-sans">
                Manage contractors — add, edit, or import from Excel
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sortedContractors.length > 0 && (
                <Button variant="outline" className="gap-2" onClick={exportToPDF}>
                  <FileText className="w-4 h-4" /> Export PDF
                </Button>
              )}
              <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
                <Upload className="w-4 h-4" /> Import
              </Button>
              <Button className="gap-2" onClick={() => {
                setContractorRows([createEmptyRow()]);
                setShowAdd(true);
              }}>
                <Plus className="w-4 h-4" /> Add Contractors
              </Button>
            </div>
          </div>

          {contractorsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground font-sans">Loading contractors...</span>
            </div>
          ) : sortedContractors.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No Contractors Registered"
              description="Add contractors manually or import them using the default Excel template."
              actionLabel="Add Contractors"
              onAction={() => {
                setContractorRows([createEmptyRow()]);
                setShowAdd(true);
              }}
            />
          ) : (
            <Card className="shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans min-w-[950px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[100px]">Vendor Code</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap max-w-[150px]">Company Name</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap max-w-[120px]">Contact Person</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[110px]">Mobile no.</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap max-w-[150px]">Email id</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap max-w-[180px]">Address</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap max-w-[160px]">Type of work</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[120px]">Vendor Category</th>
                      <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap max-w-[140px]">Remark</th>
                      <th className="text-right p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[80px]">Add/Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedContractors.map((contractor) => (
                      <tr key={contractor.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3.5 font-medium text-foreground w-[100px]">{contractor.vendor_code || <span className="italic text-muted-foreground/50">Pending</span>}</td>
                        <td className="p-3.5 font-semibold text-foreground max-w-[150px] break-words">{contractor.name}</td>
                        <td className="p-3.5 text-foreground max-w-[120px] break-words">{contractor.contact_person || '—'}</td>
                        <td className="p-3.5 text-foreground w-[110px]">{contractor.phone || '—'}</td>
                        <td className="p-3.5 text-foreground max-w-[150px] break-all">{contractor.email || '—'}</td>
                        <td className="p-3.5 text-muted-foreground max-w-[180px] break-words" title={contractor.address}>{contractor.address || '—'}</td>
                        <td className="p-3.5 text-foreground max-w-[160px] break-words">{contractor.type_of_work || '—'}</td>
                        <td className="p-3.5 text-foreground w-[120px]">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            (contractor.vendor_category || '').toLowerCase().includes('material') 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {contractor.vendor_category || '—'}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground max-w-[140px] break-words" title={contractor.remark}>{contractor.remark || '—'}</td>
                        <td className="p-3.5 text-right w-[80px]">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenEdit(contractor)}
                              title="Edit contractor"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(contractor.id, contractor.name)}
                              title="Delete contractor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <Dialog open={showImport} onOpenChange={(open) => {
        if (!open) closeImportDialog();
        else setShowImport(true);
      }}>
        <DialogContent className="sm:max-w-4xl font-sans max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Import Contractors
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
                <Download className="w-4 h-4" />
                Download Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Upload Excel File *</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Use the default template headers. Multiple contractors can be imported in one file.
              </p>
            </div>

            {importErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold mb-1">Import warnings</p>
                <ul className="list-disc pl-5 space-y-1">
                  {importErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsingImport && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing uploaded file...
              </div>
            )}

            {importRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-muted/40 border-b text-sm font-medium flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Preview ({importRows.length} contractor{importRows.length === 1 ? '' : 's'})
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Company Name</th>
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Contact Person</th>
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Mobile no.</th>
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Email id</th>
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Address</th>
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Type of work</th>
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Category</th>
                        <th className="text-left p-2 font-semibold text-xs text-muted-foreground">Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-2 font-medium text-foreground">{row.name}</td>
                          <td className="p-2 text-foreground">{row.contact_person || '—'}</td>
                          <td className="p-2 text-foreground">{row.phone || '—'}</td>
                          <td className="p-2 text-foreground">{row.email || '—'}</td>
                          <td className="p-2 text-muted-foreground max-w-[150px] truncate" title={row.address}>{row.address || '—'}</td>
                          <td className="p-2 text-foreground">{row.type_of_work || '—'}</td>
                          <td className="p-2 text-foreground">{row.vendor_category || '—'}</td>
                          <td className="p-2 text-muted-foreground max-w-[100px] truncate" title={row.remark}>{row.remark || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeImportDialog}>Cancel</Button>
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={!importFile || parsingImport || importRows.length === 0 || importErrors.length > 0 || createContractorsMutation.isPending}
              >
                {createContractorsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {importRows.length > 0 ? `(${importRows.length})` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
