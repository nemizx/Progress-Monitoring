import React, { useMemo, useState, forwardRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, HardHat, Briefcase, Plus, Minus, UserPlus, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import EmptyState from '@/components/shared/EmptyState';
import StatCard from '@/components/shared/StatCard';
import { useToast } from '@/components/ui/use-toast';
import { useDprPanelRef } from '@/components/progress/useDprPanelRef';

const createEmptyRow = () => ({
  id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  designation: '',
});

export default forwardRef(function TechnicalStaffAttendancePanel({
  projectId,
  subProjectId,
  selectedDate,
  isDateLocked = false,
}, ref) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [staffRows, setStaffRows] = useState([createEmptyRow()]);

  const { data: staffMembers = [], isLoading: staffLoading } = useQuery({
    queryKey: ['technical-staff', projectId],
    queryFn: () => base44.entities.TechnicalStaff.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: attendanceEntries = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['staff-attendance-date', projectId, subProjectId, selectedDate],
    queryFn: () => base44.entities.TechnicalStaffAttendance.filter({
      project_id: projectId,
      sub_project_id: subProjectId,
      date: selectedDate,
    }),
    enabled: !!projectId && !!subProjectId && !!selectedDate,
  });

  const attendanceByStaffId = useMemo(() => {
    const map = new Map();
    attendanceEntries.forEach((entry) => {
      if (entry.technical_staff_id) map.set(entry.technical_staff_id, entry);
    });
    return map;
  }, [attendanceEntries]);

  const createStaffMutation = useMutation({
    mutationFn: (items) => base44.entities.TechnicalStaff.bulkCreate(items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['technical-staff', projectId] });
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

  const saveAttendanceMutation = useMutation({
    mutationFn: async ({ staffId, status }) => {
      const existing = attendanceByStaffId.get(staffId);
      const payload = {
        project_id: projectId,
        sub_project_id: subProjectId,
        technical_staff_id: staffId,
        date: selectedDate,
        status,
      };

      if (existing?.id) {
        return base44.entities.TechnicalStaffAttendance.update(existing.id, payload);
      }
      return base44.entities.TechnicalStaffAttendance.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-attendance-date', projectId] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to save attendance: ${error.message}`,
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
        project_id: projectId,
        ...row,
      }))
    );
  };

  const presentCount = staffMembers.filter((staff) => attendanceByStaffId.get(staff.id)?.status === 'present').length;
  const absentCount = staffMembers.filter((staff) => attendanceByStaffId.get(staff.id)?.status === 'absent').length;
  const unmarkedCount = staffMembers.length - presentCount - absentCount;

  const formatAttendanceStatus = (status) => {
    if (status === 'present') return 'Present';
    if (status === 'absent') return 'Absent';
    return 'Not marked';
  };

  const getReviewData = useCallback(() => ({
    title: 'B. Technical Staff Attendance',
    columns: [
      { key: 'sr', label: 'Sr.' },
      { key: 'name', label: 'Name', tooltip: 'Full name of the technical staff member.' },
      { key: 'designation', label: 'Designation', tooltip: 'Role or designation on site, e.g. JE, Site Engineer.' },
      { key: 'status', label: 'Attendance', tooltip: 'Present or Absent for the selected DPR date.' },
    ],
    rows: staffMembers.map((staff, i) => ({
      sr: i + 1,
      name: staff.name,
      designation: staff.designation || '—',
      status: formatAttendanceStatus(attendanceByStaffId.get(staff.id)?.status),
    })),
  }), [staffMembers, attendanceByStaffId]);

  useDprPanelRef(ref, {
    validate: () => null,
    getReviewData,
    save: async () => {},
  });

  const isLoading = staffLoading || attendanceLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground font-sans">Loading technical staff attendance...</span>
      </div>
    );
  }

  if (staffMembers.length === 0) {
    return (
      <>
        <EmptyState
          icon={HardHat}
          title="No Technical Staff"
          description="Add technical staff for this project, then mark daily attendance for the selected DPR date."
          actionLabel="Add Technical Staff"
          onAction={handleOpenAdd}
        />
        <AddStaffDialog
          open={showAdd}
          onOpenChange={(open) => {
            if (!open) {
              setShowAdd(false);
              setStaffRows([createEmptyRow()]);
            }
          }}
          staffRows={staffRows}
          updateRow={updateRow}
          addRow={addRow}
          removeRow={removeRow}
          onSubmit={handleSubmitStaff}
          isPending={createStaffMutation.isPending}
        />
      </>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4" /> Add Technical Staff
        </Button>
      </div>

      {isDateLocked && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          DPR is locked for this date. Attendance cannot be changed.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Staff" value={staffMembers.length} icon={HardHat} />
        <StatCard title="Present" value={presentCount} icon={Briefcase} />
        <StatCard title="Absent" value={absentCount} icon={HardHat} />
        <StatCard title="Not Marked" value={unmarkedCount} icon={Briefcase} />
      </div>

      <Card className="overflow-hidden border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">
                  <div className="flex items-center gap-1 select-none">
                    <span>Name</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                        Full name of the technical staff member.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">
                  <div className="flex items-center gap-1 select-none">
                    <span>Designation</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                        Role or designation on site, e.g. JE, Site Engineer.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">
                  <div className="flex items-center gap-1 select-none">
                    <span>Attendance</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                        Mark this staff member Present or Absent for the selected DPR date.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {staffMembers.map((staff) => {
                const attendance = attendanceByStaffId.get(staff.id);
                const status = attendance?.status || '';

                return (
                  <tr key={staff.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{staff.name}</td>
                    <td className="p-3 text-muted-foreground">{staff.designation}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={status || 'unmarked'}
                          onValueChange={(value) => {
                            if (value === 'unmarked' || isDateLocked) return;
                            saveAttendanceMutation.mutate({ staffId: staff.id, status: value });
                          }}
                          disabled={isDateLocked || saveAttendanceMutation.isPending}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue placeholder="Mark attendance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmarked">Select</SelectItem>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                          </SelectContent>
                        </Select>
                        {status === 'present' && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Present</Badge>
                        )}
                        {status === 'absent' && (
                          <Badge className="bg-red-100 text-red-700 border-red-200">Absent</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AddStaffDialog
        open={showAdd}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setStaffRows([createEmptyRow()]);
          }
        }}
        staffRows={staffRows}
        updateRow={updateRow}
        addRow={addRow}
        removeRow={removeRow}
        onSubmit={handleSubmitStaff}
        isPending={createStaffMutation.isPending}
      />
    </div>
    </TooltipProvider>
  );
});

function AddStaffDialog({
  open,
  onOpenChange,
  staffRows,
  updateRow,
  addRow,
  removeRow,
  onSubmit,
  isPending,
}) {
  return (
    <TooltipProvider>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add Technical Staff
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-1">
            <div className="flex items-center gap-1 select-none">
              <Label className="text-xs font-semibold">Staff Name *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                  Full name of the technical staff member to add.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1 select-none">
              <Label className="text-xs font-semibold">Designation *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-center font-sans font-normal normal-case">
                  Role or designation on site, e.g. JE, Site Engineer.
                </TooltipContent>
              </Tooltip>
            </div>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Staff{staffRows.length > 1 ? ` (${staffRows.length})` : ''}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}
