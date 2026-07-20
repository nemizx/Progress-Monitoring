import {
  LayoutDashboard, CalendarClock, Network,
  ClipboardList, BarChart3, MessageSquare,
  Shield, Users, Building2
} from 'lucide-react';

export const navigationItems = [
  { id: 'dashboard', type: 'link', path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { 
    id: 'dpr_group', 
    type: 'group', 
    label: 'Progress', 
    icon: ClipboardList, 
    children: [
      { id: 'dpr_entry', path: '/progress', tab: 'dpr', label: 'DPR' },
      { id: 'wpr_entry', path: '/progress', tab: 'wpr', label: 'WPR' },
      { id: 'mpr_entry', path: '/progress', tab: 'mpr', label: 'MPR' },
    ]
  },
  { id: 'technical_staff', type: 'link', path: '/technical-staff', label: 'Technical Staff', icon: Users },
  { id: 'contractor_master', type: 'link', path: '/contractors', label: 'Contractors', icon: Building2 },
  { 
    id: 'schedule_group', 
    type: 'group', 
    label: 'Schedule', 
    icon: CalendarClock, 
    children: [
      { id: 'wbs_management', path: '/scheduler', label: 'Schedule Builder' },
      { id: 'schedule_monitor', path: '/schedule-monitor', label: 'Schedule Monitor' },
    ]
  },
  { 
    id: 'analytics_group', 
    type: 'group', 
    label: 'Analytics', 
    icon: BarChart3, 
    children: [
      { id: 'dpr_reports', path: '/reports', label: 'Reports' },
      { id: 'labour_productivity', path: '/analytics/labour-productivity', label: 'Labour Productivity' },
    ]
  },
  { 
    id: 'wbs_group', 
    type: 'group', 
    label: 'WBS', 
    icon: Network, 
    children: [
      { id: 'wbs_management', path: '/wbs', label: 'WBS' },
      { id: 'budget', path: '/budget', label: 'Budget' },
      { id: 'cost_controls', path: '/cost', label: 'Cost Controls' },
    ]
  },
  { 
    id: 'admin_group', 
    type: 'group', 
    label: 'Admin', 
    icon: Shield, 
    children: [
      { id: 'admin_panel', path: '/admin', label: 'Administration' },
      { id: 'project_master', path: '/projects', label: 'Projects' },
    ]
  },
  { id: 'collaboration', type: 'link', path: '/collaboration', label: 'Collaboration', icon: MessageSquare },
];
