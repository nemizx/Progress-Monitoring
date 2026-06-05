import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Plus, Check, Trash2, AlertTriangle, Info, ShieldAlert, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/shared/EmptyState';

const typeConfig = {
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  critical: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  milestone: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  quality: { icon: ShieldAlert, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  schedule: { icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
};

export default function Notifications() {
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState({ title: '', message: '', type: 'info', project_id: '' });

  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 100),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Notification.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); setShowCreate(false); setForm({ title: '', message: '', type: 'info', project_id: '' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Notification.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const filtered = typeFilter === 'all' ? notifications : notifications.filter(n => n.type === typeFilter);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = () => {
    notifications.filter(n => !n.is_read).forEach(n => {
      updateMutation.mutate({ id: n.id, data: { is_read: true } });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
              <Check className="w-4 h-4" /> Mark All Read
            </Button>
          )}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Create Alert</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Notification</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><Label>Message *</Label><Textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(typeConfig).map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Project</Label>
                    <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.message}>Send Alert</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={typeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter('all')}>All</Button>
        {Object.entries(typeConfig).map(([type, config]) => (
          <Button key={type} variant={typeFilter === type ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(type)} className="gap-1.5 capitalize">
            <config.icon className="w-3.5 h-3.5" /> {type}
          </Button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.map(notif => {
          const config = typeConfig[notif.type] || typeConfig.info;
          const Icon = config.icon;
          return (
            <Card key={notif.id} className={cn("border transition-all", !notif.is_read && config.bg)}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", !notif.is_read ? '' : 'bg-muted')}>
                  <Icon className={cn("w-4 h-4", !notif.is_read ? config.color : 'text-muted-foreground')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn("text-sm", !notif.is_read ? "font-semibold" : "font-medium text-muted-foreground")}>{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!notif.is_read && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateMutation.mutate({ id: notif.id, data: { is_read: true } })}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(notif.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {notif.created_date ? format(new Date(notif.created_date), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up. Critical alerts will appear here." />
        )}
      </div>
    </div>
  );
}