import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HardHat, Plus, Minus, Trash2, Loader2, FolderKanban, UserPlus, Briefcase } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/components/ui/use-toast';

const createEmptyRow = () => ({
  id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  designation: '',
});

export default function TechnicalStaff() {
  const [projectFilter, setProjectFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [staffRows, setStaffRows] = useState([createEmptyRow()]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const { data: staffMembers = [], isLoading: staffLoading } = useQuery({
    queryKey: ['technical-staff', projectFilter],
    queryFn: () => base44.entities.TechnicalStaff.filter({ project_id: projectFilter }),
    enabled: !!projectFilter,
  });

  const createStaffMutation = useMutation({
    mutationFn: (items) => base44.entities.TechnicalStaff.bulkCreate(items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['technical-staff', projectFilter] });
      toast({
        title: 'Staff Added',
        description: `${variables.length} technical staff member${variables.length === 1 ? '' : 's'} added.`,
      });
      setShowAdd(false);
      setStaffRows([createEmptyRow()]);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to add staff: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id) => base44.entities.TechnicalStaff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-staff', projectFilter] });
      toast({ title: 'Staff Removed', description: 'Technical staff member deleted.' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete staff: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleOpenAdd = () => {
    setStaffRows([createEmptyRow()]);
    setShowAdd(true);
  };

  const updateRow = (rowId, field, value) => {
    setStaffRows((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, [field]: value } : row
    )));
  };

  const addRow = () => setStaffRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (rowId) => {
    setStaffRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== rowId)));
  };

  const handleSubmitStaff = (e) => {
    e.preventDefault();

    const validRows = staffRows
      .map((row) => ({
        name: row.name.trim(),
        designation: row.designation.trim(),
      }))
      .filter((row) => row.name && row.designation);

    if (validRows.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Add at least one staff row with Name and Designation.',
        variant: 'destructive',
      });
      return;
    }

    createStaffMutation.mutate(
      validRows.map((row) => ({
        project_id: projectFilter,
        ...row,
      }))
    );
  };

  const handleDeleteStaff = (id, name) => {
    if (confirm(`Remove ${name} from technical staff?`)) {
      deleteStaffMutation.mutate(id);
    }
  };

  const selectedProject = projects.find((p) => p.id === projectFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Technical Staff</h1>
          <p className="text-sm text-muted-foreground mt-1 font-sans">
            Select a project and manage technical staff details
          </p>
        </div>
        {projectFilter && (
          <Button className="gap-2" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4" /> Add Technical Staff
          </Button>
        )}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex-1 max-w-sm">
            <Label className="text-xs text-muted-foreground mb-1.5 block font-sans">Select Project *</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full font-sans">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent className="font-sans">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedProject && (
            <div className="text-sm border-l sm:pl-4 border-muted">
              <span className="text-muted-foreground text-xs font-sans">Project Location</span>
              <p className="font-medium mt-0.5">{selectedProject.location || '—'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {!projectFilter ? (
        <EmptyState
          icon={FolderKanban}
          title="Select a project"
          description="Choose a project first to view and manage technical staff details."
        />
      ) : staffLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground font-sans">Loading staff details...</span>
        </div>
      ) : staffMembers.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="No Technical Staff Registered"
          description="Add technical staff for this project. Daily attendance is marked from Site Progress → Daily DPR Sheet."
          actionLabel="Add Technical Staff"
          onAction={handleOpenAdd}
        />
      ) : (
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="text-left p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Designation</th>
                  <th className="text-right p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Add/Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffMembers.map((staff) => (
                  <tr key={staff.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3.5 font-medium text-foreground">{staff.name}</td>
                    <td className="p-3.5 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 opacity-60 text-primary" />
                        <span>{staff.designation}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteStaff(staff.id, staff.name)}
                        title="Delete staff member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={(open) => {
        if (!open) {
          setShowAdd(false);
          setStaffRows([createEmptyRow()]);
        }
      }}>
        <DialogContent className="sm:max-w-4xl font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Technical Staff
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitStaff} className="space-y-4 pt-2">
            <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-1">
              <Label className="text-xs font-semibold">Staff Name *</Label>
              <Label className="text-xs font-semibold">Designation *</Label>
              <span />
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {staffRows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 items-start border rounded-lg p-3 bg-muted/10"
                >
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold md:hidden">Staff Name *</Label>
                    <Input
                      placeholder="e.g. Atul Kulkarni"
                      value={row.name}
                      onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold md:hidden">Designation *</Label>
                    <Input
                      placeholder="e.g. JE, Site Engineer"
                      value={row.designation}
                      onChange={(e) => updateRow(row.id, 'designation', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-0 md:pt-1">
                    {index === staffRows.length - 1 && (
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={addRow} title="Add row">
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                    {staffRows.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={() => removeRow(row.id)}
                        title="Remove row"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createStaffMutation.isPending}>
                {createStaffMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Staff{staffRows.length > 1 ? ` (${staffRows.length})` : ''}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
