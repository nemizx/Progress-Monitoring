import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Shield, Plus, Trash2, Pencil, CheckCircle, Search, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';
import { useAuth } from '@/lib/AuthContext';
import { COMPANIES } from '@/lib/companies';

const ROLES = ['admin', 'planning_team', 'project_manager', 'site_engineer', 'department_head', 'management'];

const IndeterminateCheckbox = ({ checked, indeterminate, onChange, disabled }) => {
  const ref = React.useRef();

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="rounded border-slate-300 text-[#0f172a] focus:ring-[#0f172a] w-4 h-4 cursor-pointer disabled:opacity-50 mx-auto block"
    />
  );
};

export default function AdminPanel() {
  const { user: currentUser } = useAuth();

  // User management states
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    email: '',
    role: 'site_engineer',
    password: '',
    company_access: '',
    project_access_id: '',
    mobile: '',
    status: 'active'
  });
  const [userError, setUserError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom multi-select dropdown visibility states
  const [showAddCompanyDropdown, setShowAddCompanyDropdown] = useState(false);
  const [showAddProjectDropdown, setShowAddProjectDropdown] = useState(false);
  const [showEditCompanyDropdown, setShowEditCompanyDropdown] = useState(false);
  const [showEditProjectDropdown, setShowEditProjectDropdown] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.custom-dropdown-container')) {
        setShowAddCompanyDropdown(false);
        setShowAddProjectDropdown(false);
        setShowEditCompanyDropdown(false);
        setShowEditProjectDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const queryClient = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date', 100) });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list('-created_date', 100) });
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => base44.entities.Role.list() });
  const { data: dbModules = [] } = useQuery({ queryKey: ['modules'], queryFn: () => base44.entities.Module.list() });
  const { data: dbPermissions = [] } = useQuery({ queryKey: ['permissions'], queryFn: () => base44.entities.RolePermission.list() });

  const [permissionsGrid, setPermissionsGrid] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionsSuccess, setPermissionsSuccess] = useState('');
  const [permissionsError, setPermissionsError] = useState('');

  const rolesList = roles.length > 0 ? roles.map(r => r.id) : ROLES;

  const getRoleDisplayName = (roleId) => {
    return roles.find(r => r.id === roleId)?.name || roleId.replace(/_/g, ' ');
  };

  useEffect(() => {
    if (dbPermissions.length > 0) {
      const grid = {};
      dbPermissions.forEach(p => {
        if (!grid[p.role_id]) grid[p.role_id] = {};
        grid[p.role_id][p.module_id] = p.can_view;
      });
      setPermissionsGrid(grid);
    }
  }, [dbPermissions]);

  const handleSavePermissions = async () => {
    setPermissionsSuccess('');
    setPermissionsError('');
    setSavingPermissions(true);

    const payload = [];
    rolesList.forEach(roleId => {
      dbModules.forEach(m => {
        const hasAccess = !!permissionsGrid[roleId]?.[m.id];
        payload.push({
          role_id: roleId,
          module_id: m.id,
          can_view: hasAccess
        });
      });
    });

    try {
      await base44.rolePermissions.saveBatch(payload);
      await queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setPermissionsSuccess('Permissions updated successfully.');
      setTimeout(() => setPermissionsSuccess(''), 5000);
    } catch (err) {
      setPermissionsError(err.message || 'Failed to save permissions');
    } finally {
      setSavingPermissions(false);
    }
  };

  // User Mutations
  const createUserMutation = useMutation({
    mutationFn: (data) => base44.entities.User.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetUserForm();
    },
    onError: (err) => {
      setUserError(err.message || 'Failed to create user');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetUserForm();
    },
    onError: (err) => {
      setUserError(err.message || 'Failed to update user');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      alert(err.message || 'Failed to delete user');
    }
  });
  const resetUserForm = () => {
    setUserForm({
      email: '',
      role: 'site_engineer',
      password: '',
      company_access: '',
      project_access_id: '',
      mobile: '',
      status: 'active'
    });
    setUserError('');
    setShowPassword(false);
    setEditingUser(null);
    setShowAddCompanyDropdown(false);
    setShowAddProjectDropdown(false);
    setShowEditCompanyDropdown(false);
    setShowEditProjectDropdown(false);
  };

  const handleCreateUser = async () => {
    setUserError('');
    if (!userForm.email || !userForm.email.trim()) {
      setUserError('User ID is required');
      return;
    }
    if (!userForm.password || !userForm.password.trim()) {
      setUserError('Password is required');
      return;
    }
    createUserMutation.mutate({
      email: userForm.email.trim(),
      role: userForm.role,
      password: userForm.password,
      company_access: userForm.company_access && userForm.company_access !== 'all_companies' ? userForm.company_access : null,
      project_access_id: userForm.project_access_id && userForm.project_access_id !== 'all_projects' ? userForm.project_access_id : null,
      mobile: userForm.mobile ? userForm.mobile.trim() : null,
      status: userForm.status || 'active'
    });
  };

  const handleUpdateUser = async () => {
    setUserError('');
    if (!userForm.email || !userForm.email.trim()) {
      setUserError('User ID is required');
      return;
    }
    const payload = {
      email: userForm.email.trim(),
      role: userForm.role,
      company_access: userForm.company_access && userForm.company_access !== 'all_companies' ? userForm.company_access : null,
      project_access_id: userForm.project_access_id && userForm.project_access_id !== 'all_projects' ? userForm.project_access_id : null,
      mobile: userForm.mobile ? userForm.mobile.trim() : null,
      status: userForm.status || 'active'
    };
    if (userForm.password && userForm.password.trim()) {
      payload.password = userForm.password;
    }
    updateUserMutation.mutate({
      id: editingUser.id,
      data: payload
    });
  };

  const handleDeleteUser = (userToDelete) => {
    if (currentUser && userToDelete.id === currentUser.id) {
      alert("Self-deletion protection: You cannot delete your own active administrator account.");
      return;
    }
    if (userToDelete.email === 'admin@planedge.co') {
      alert("System protection: The default primary admin user 'admin@planedge.co' cannot be deleted.");
      return;
    }
    if (confirm(`Are you sure you want to delete the user "${userToDelete.email}"?`)) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const startEditUser = (userToEdit) => {
    setEditingUser(userToEdit);
    setUserForm({
      email: userToEdit.email || '',
      role: userToEdit.role || 'site_engineer',
      password: '',
      company_access: userToEdit.company_access || '',
      project_access_id: userToEdit.project_access_id || '',
      mobile: userToEdit.mobile || '',
      status: userToEdit.status || 'active'
    });
    setUserError('');
    setShowPassword(false);
  };

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || '';

  const filteredUsers = users.filter(u => 
    !searchQuery || u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableProjectsForForm = projects.filter(p => {
    if (!userForm.company_access) return true;
    const selectedCompanies = userForm.company_access.split(',').map(c => c.trim()).filter(Boolean);
    return selectedCompanies.length === 0 || selectedCompanies.includes(p.client);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">User management and platform governance</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Users & Roles</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><Shield className="w-4 h-4" /> Role Matrix</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-6">
          {/* Card 1: User Form Inline */}
          <Card className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-heading font-bold text-slate-800">
                {editingUser ? 'Edit User Details' : 'Create New User'}
              </h2>
            </div>

            {userError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600 font-medium">
                {userError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* User ID */}
              <div className="space-y-1.5">
                <Label htmlFor="user-email">User ID *</Label>
                <Input
                  id="user-email"
                  type="text"
                  autoComplete="off"
                  value={userForm.email}
                  disabled={!!editingUser}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                  placeholder="Enter User ID (e.g. name@planedge.co)"
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <Label htmlFor="user-role">Role *</Label>
                <Select
                  value={userForm.role}
                  onValueChange={v => setUserForm({ ...userForm, role: v })}
                >
                  <SelectTrigger id="user-role" className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesList.map(r => (
                      <SelectItem key={r} value={r}>{getRoleDisplayName(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="user-password">
                  {editingUser ? 'Password (leave blank to keep current)' : 'Password *'}
                </Label>
                <div className="relative">
                  <Input
                    id="user-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm pr-10"
                    placeholder={editingUser ? '••••••••' : 'Enter password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <Label htmlFor="user-mobile">Mobile Number</Label>
                <Input
                  id="user-mobile"
                  type="text"
                  value={userForm.mobile}
                  onChange={e => setUserForm({ ...userForm, mobile: e.target.value })}
                  className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm"
                  placeholder="Enter mobile number"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label htmlFor="user-status">Status</Label>
                <Select
                  value={userForm.status}
                  onValueChange={v => setUserForm({ ...userForm, status: v })}
                >
                  <SelectTrigger id="user-status" className="bg-white border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Spacer */}
              <div className="hidden lg:block"></div>

              {/* Access To Companies */}
              <div className="custom-dropdown-container space-y-1.5 relative">
                <Label>Access To Companies</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAddCompanyDropdown(!showAddCompanyDropdown)}
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-left min-w-0 overflow-hidden"
                  >
                    <span className="truncate mr-2 flex-grow min-w-0 block">
                      {userForm.company_access 
                        ? userForm.company_access 
                        : <span className="text-slate-400">All Companies</span>}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">▼</span>
                  </button>
                  {showAddCompanyDropdown && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-md z-20 space-y-1.5">
                      {COMPANIES.map(c => {
                        const isChecked = (userForm.company_access || '').split(',').map(x => x.trim()).filter(Boolean).includes(c);
                        return (
                          <label key={c} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const currentList = (userForm.company_access || '').split(',').map(x => x.trim()).filter(Boolean);
                                let newList;
                                if (e.target.checked) {
                                  newList = [...currentList, c];
                                } else {
                                  newList = currentList.filter(x => x !== c);
                                }
                                setUserForm({
                                  ...userForm,
                                  company_access: newList.join(','),
                                  project_access_id: '' // reset project access on company change
                                });
                              }}
                              className="rounded border-slate-300 text-slate-800 w-3.5 h-3.5"
                            />
                            {c}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Access To Projects */}
              <div className="custom-dropdown-container space-y-1.5 relative">
                <Label>Access To Projects</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAddProjectDropdown(!showAddProjectDropdown)}
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-left min-w-0 overflow-hidden"
                  >
                    <span className="truncate mr-2 flex-grow min-w-0 block">
                      {userForm.project_access_id 
                        ? userForm.project_access_id.split(',').map(id => getProjectName(id)).filter(Boolean).join(', ')
                        : <span className="text-slate-400">All Projects</span>}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">▼</span>
                  </button>
                  {showAddProjectDropdown && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-md z-20 space-y-1.5">
                      {availableProjectsForForm.length > 0 ? (
                        availableProjectsForForm.map(p => {
                          const isChecked = (userForm.project_access_id || '').split(',').map(x => x.trim()).filter(Boolean).includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentList = (userForm.project_access_id || '').split(',').map(x => x.trim()).filter(Boolean);
                                  let newList;
                                  if (e.target.checked) {
                                    newList = [...currentList, p.id];
                                  } else {
                                    newList = currentList.filter(x => x !== p.id);
                                  }
                                  setUserForm({
                                    ...userForm,
                                    project_access_id: newList.join(',')
                                  });
                                }}
                                className="rounded border-slate-300 text-slate-800 w-3.5 h-3.5"
                              />
                              {p.name} ({p.project_code})
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-400 text-center py-2">No projects found.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-start">
              <Button
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-medium px-6 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                {editingUser 
                  ? (updateUserMutation.isPending ? 'Updating...' : 'Update')
                  : (createUserMutation.isPending ? 'Saving...' : 'Save')}
              </Button>
            </div>
          </Card>

          {/* Card 2: User List Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-slate-800">User Accounts</h2>
                <p className="text-xs text-slate-400 mt-1">Showing {filteredUsers.length} of {users.length} registered users</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search User ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-xs h-9"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Access Limit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead className="w-24 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <TableRow 
                        key={u.id} 
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => startEditUser(u)}
                      >
                        <TableCell className="font-semibold text-slate-800">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-slate-600 border-slate-200">
                            {getRoleDisplayName(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">{u.mobile || '—'}</TableCell>
                        <TableCell className="text-slate-600 text-xs max-w-xs truncate">
                          {u.company_access && u.project_access_id ? (
                            <span className="font-medium">Co: {u.company_access} | Prj: {u.project_access_id.split(',').map(id => getProjectName(id)).filter(Boolean).join(', ')}</span>
                          ) : u.company_access ? (
                            <span className="font-medium">Co: {u.company_access} (All Projects)</span>
                          ) : u.project_access_id ? (
                            <span className="font-medium">Prj: {u.project_access_id.split(',').map(id => getProjectName(id)).filter(Boolean).join(', ')}</span>
                          ) : (
                            <span className="text-slate-400">All Companies & Projects</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.status === 'inactive' ? (
                            <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">Inactive</Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {u.created_date ? format(new Date(u.created_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditUser(u);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUser(u);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-slate-400 text-xs">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>


        {/* Role Matrix */}
        <TabsContent value="roles" className="mt-4 space-y-4">
          <Card className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-slate-800 font-heading">Permission Matrix</h2>
                <p className="text-xs text-slate-400 mt-1">Configure role-based access control dynamically</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search Modules..."
                    value={permissionSearch}
                    onChange={e => setPermissionSearch(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 focus:border-slate-400 focus:ring-0 rounded-lg text-xs h-9"
                  />
                </div>
                <Button
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs px-4 h-9 rounded-lg shadow-sm font-medium flex items-center gap-2"
                >
                  {savingPermissions ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>

            {permissionsSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 font-medium">
                {permissionsSuccess}
              </div>
            )}
            {permissionsError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600 font-medium">
                {permissionsError}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Module / Sub Module</TableHead>
                    {rolesList.map(r => (
                      <TableHead key={r} className="text-center font-semibold text-slate-700 capitalize">
                        {getRoleDisplayName(r)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const parentModules = dbModules.filter(m => !m.parent_module_id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                    const childModulesMap = {};
                    dbModules.forEach(m => {
                      if (m.parent_module_id) {
                        if (!childModulesMap[m.parent_module_id]) childModulesMap[m.parent_module_id] = [];
                        childModulesMap[m.parent_module_id].push(m);
                      }
                    });

                    Object.keys(childModulesMap).forEach(parentId => {
                      childModulesMap[parentId].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                    });

                    const filteredParents = parentModules.filter(parent => {
                      const parentMatches = parent.module_name.toLowerCase().includes(permissionSearch.toLowerCase());
                      const children = childModulesMap[parent.id] || [];
                      const childMatches = children.some(c => c.module_name.toLowerCase().includes(permissionSearch.toLowerCase()));
                      return parentMatches || childMatches;
                    });

                    if (filteredParents.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={rolesList.length + 1} className="text-center py-8 text-slate-400 text-xs">
                            No modules found matching your search.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return filteredParents.map(parent => {
                      const children = childModulesMap[parent.id] || [];
                      const parentMatches = parent.module_name.toLowerCase().includes(permissionSearch.toLowerCase());
                      const filteredChildren = parentMatches 
                        ? children 
                        : children.filter(c => c.module_name.toLowerCase().includes(permissionSearch.toLowerCase()));

                      const getParentState = (parentId, roleId) => {
                        const sublist = childModulesMap[parentId] || [];
                        if (sublist.length === 0) {
                          return { checked: !!permissionsGrid[roleId]?.[parentId], indeterminate: false };
                        }
                        const checkedCount = sublist.filter(c => !!permissionsGrid[roleId]?.[c.id]).length;
                        if (checkedCount === 0) return { checked: false, indeterminate: false };
                        if (checkedCount === sublist.length) return { checked: true, indeterminate: false };
                        return { checked: false, indeterminate: true };
                      };

                      const toggleParent = (parentId, roleId) => {
                        const sublist = childModulesMap[parentId] || [];
                        const { checked, indeterminate } = getParentState(parentId, roleId);
                        const targetState = !(checked && !indeterminate);

                        setPermissionsGrid(prev => {
                          const next = { ...prev };
                          if (!next[roleId]) next[roleId] = {};
                          next[roleId][parentId] = targetState;
                          sublist.forEach(c => {
                            next[roleId][c.id] = targetState;
                          });
                          return next;
                        });
                      };

                      const toggleChild = (childId, parentId, roleId) => {
                        setPermissionsGrid(prev => {
                          const next = { ...prev };
                          if (!next[roleId]) next[roleId] = {};
                          const nextVal = !next[roleId][childId];
                          next[roleId][childId] = nextVal;

                          const sublist = childModulesMap[parentId] || [];
                          const allChecked = sublist.every(c => c.id === childId ? nextVal : !!next[roleId][c.id]);
                          next[roleId][parentId] = allChecked;
                          return next;
                        });
                      };

                      return (
                        <React.Fragment key={parent.id}>
                          {/* Parent Row */}
                          <TableRow className="bg-slate-50/20 hover:bg-slate-50/50 font-semibold border-b border-slate-100">
                            <TableCell className="text-slate-800 font-bold py-3">
                              {parent.module_name}
                            </TableCell>
                            {rolesList.map(roleId => {
                              const state = getParentState(parent.id, roleId);
                              return (
                                <TableCell key={roleId} className="text-center py-3">
                                  <IndeterminateCheckbox
                                    checked={state.checked}
                                    indeterminate={state.indeterminate}
                                    onChange={() => toggleParent(parent.id, roleId)}
                                    disabled={roleId === 'admin'}
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>

                          {/* Children Rows */}
                          {filteredChildren.map(child => (
                            <TableRow key={child.id} className="hover:bg-slate-50/30 border-b border-slate-100/50">
                              <TableCell className="pl-8 text-slate-600 py-2.5 flex items-center gap-2">
                                <span className="text-slate-300">└─</span> {child.module_name}
                              </TableCell>
                              {rolesList.map(roleId => (
                                <TableCell key={roleId} className="text-center py-2.5">
                                  <IndeterminateCheckbox
                                    checked={!!permissionsGrid[roleId]?.[child.id]}
                                    indeterminate={false}
                                    onChange={() => toggleChild(child.id, parent.id, roleId)}
                                    disabled={roleId === 'admin'}
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}