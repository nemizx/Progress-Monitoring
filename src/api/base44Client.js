// Real API client and SDK for Planedge_Monitors.
// Replaces the local storage-based mock database client.

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('base44_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const apiFetch = async (url, options = {}) => {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      const port = window.location.port || '5173';
      throw new Error(
        `Cannot reach the API server. Use the dev URL from your terminal (http://localhost:${port}) and ensure "npm run dev" is running with the backend on port 3000.`
      );
    }
    throw error;
  }
};

const handleResponse = async (res) => {
  if (!res.ok) {
    let errData;
    try {
      errData = await res.json();
    } catch (e) {
      errData = { error: 'Unknown server error' };
    }
    const err = new Error(errData.error || `Server error (${res.status}). Check that PostgreSQL is running and run npm run db:setup.`);
    err.status = res.status;
    throw err;
  }
  return await res.json();
};

// --- Generic Entity Services ---
const entityNames = [
  'Project',
  'WBSItem',
  'ScheduleActivity',
  'BudgetItem',
  'Milestone',
  'ProgressEntry',
  'AttendanceEntry',
  'QualityInspection',
  'Document',
  'ChangeEvent',
  'CollaborationPost',
  'Notification',
  'ScheduleTask',
  'SchedulingRule',
  'User',
  'SubProject',
  'ProjectFlat',
  'MepBoq',
  'TechnicalStaff',
  'TechnicalStaffAttendance',
  'Contractor',
  'ContractorLabour',
  'MachineryDetail',
  'MaterialStatus',
  'DaysReport',
  'StatusReport',
  'SpecialSiteVisit',
  'CriticalIssue',
  'NextDaysPlan',
  'WprReport',
  'MprReport'
];

const entities = {};
entityNames.forEach(name => {
  entities[name] = {
    list: async (sortField, limit) => {
      let url = `/api/entities/${name}`;
      const params = [];
      if (sortField) params.push(`sortField=${encodeURIComponent(sortField)}`);
      if (limit) params.push(`limit=${parseInt(limit)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await apiFetch(url, { headers: getHeaders() });
      return handleResponse(res);
    },

    filter: async (criteria, sortField, limit) => {
      let url = `/api/entities/${name}/filter`;
      const params = [];
      if (sortField) params.push(`sortField=${encodeURIComponent(sortField)}`);
      if (limit) params.push(`limit=${parseInt(limit)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await apiFetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(criteria)
      });
      return handleResponse(res);
    },

    create: async (data) => {
      const res = await apiFetch(`/api/entities/${name}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    },

    update: async (id, data) => {
      const res = await apiFetch(`/api/entities/${name}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    },

    delete: async (id) => {
      const res = await apiFetch(`/api/entities/${name}/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(res);
    },

    bulkCreate: async (items) => {
      const res = await apiFetch(`/api/entities/${name}/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(items)
      });
      return handleResponse(res);
    }
  };
});

// --- Authentication Client API ---
const auth = {
  me: async () => {
    const token = localStorage.getItem('base44_access_token');
    if (!token) {
      throw { status: 401, message: 'Authentication required' };
    }
    const res = await apiFetch('/api/auth/me', { headers: getHeaders() });
    return handleResponse(res);
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('Planedge_Monitors_current_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  loginViaEmailPassword: async (email, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await handleResponse(res);
    localStorage.setItem('base44_access_token', data.access_token);
    localStorage.setItem('Planedge_Monitors_current_user', JSON.stringify(data.user));
    return data.user;
  },

  register: async ({ email, password }) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await handleResponse(res);
    localStorage.setItem('base44_access_token', data.access_token);
    localStorage.setItem('Planedge_Monitors_current_user', JSON.stringify(data.user));
    return { success: true };
  },

  verifyOtp: async () => {
    const user = JSON.parse(localStorage.getItem('Planedge_Monitors_current_user') || '{}');
    return {
      access_token: localStorage.getItem('base44_access_token'),
      user
    };
  },

  resendOtp: async () => {
    return { success: true };
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem('base44_access_token', token);
    } else {
      localStorage.removeItem('base44_access_token');
    }
  },

  loginWithProvider: (provider, redirectUrl) => {
    window.location.href = redirectUrl || '/';
  },

  resetPasswordRequest: async () => {
    return { success: true };
  },

  resetPassword: async () => {
    return { success: true };
  },

  logout: () => {
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('Planedge_Monitors_current_user');
    window.location.href = '/login';
  },

  redirectToLogin: (redirectUrl) => {
    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
    const currentPath = window.location.pathname;
    if (publicPaths.some((path) => currentPath.startsWith(path))) {
      window.location.replace('/login');
      return;
    }

    let destination = redirectUrl || window.location.href;
    try {
      const url = new URL(destination, window.location.origin);
      if (publicPaths.some((path) => url.pathname.startsWith(path))) {
        window.location.replace('/login');
        return;
      }
      const from = url.pathname + url.search;
      window.location.replace(`/login?from=${encodeURIComponent(from)}`);
    } catch {
      window.location.replace('/login');
    }
  }
};

// --- Users Client ---
const usersMock = {
  inviteUser: async (email, role) => {
    return await entities.User.create({ email, role });
  }
};

// --- Integrations API ---
const uploadFile = async ({ file }) => {
  if (!file) {
    return { file_url: '' };
  }

  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  const token = localStorage.getItem('base44_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch('/api/upload', {
    method: 'POST',
    headers,
    body: formData
  });
  return handleResponse(res);
};

const invokeLLM = async ({ prompt }) => {
  const res = await apiFetch('/api/integrations/llm', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ prompt })
  });
  const data = await handleResponse(res);
  return data.text || data;
};

const generateScheduleClient = async (params) => {
  const res = await apiFetch('/api/integrations/schedule/generate', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params)
  });
  return handleResponse(res);
};

const finalizeScheduleClient = async (params) => {
  const res = await apiFetch('/api/integrations/schedule/finalize', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params)
  });
  return handleResponse(res);
};

const getModelParametersClient = async () => {
  const res = await apiFetch('/api/integrations/schedule/parameters', {
    headers: getHeaders()
  });
  return handleResponse(res);
};

// Main base44 namespace export
export const base44 = {
  entities,
  auth,
  users: usersMock,
  wbsTemplate: {
    list: async () => {
      const res = await apiFetch('/api/wbs-template', { headers: getHeaders() });
      return handleResponse(res);
    },
    createItem: async (data) => {
      const res = await apiFetch('/api/wbs-template/items', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    updateItem: async (wbsId, data) => {
      const res = await apiFetch(`/api/wbs-template/items/${encodeURIComponent(wbsId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    deleteItem: async (wbsId) => {
      const res = await apiFetch(`/api/wbs-template/items/${encodeURIComponent(wbsId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    applyToProject: async (projectId, subProjectId, mode = 'merge') => {
      const res = await apiFetch('/api/wbs-template/apply', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ project_id: projectId, sub_project_id: subProjectId, mode }),
      });
      return handleResponse(res);
    },
    resetToDefault: async () => {
      const res = await apiFetch('/api/wbs-template/reset', {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },
  integrations: {
    Core: {
      InvokeLLM: invokeLLM,
      UploadFile: uploadFile
    },
    Schedule: {
      generate: generateScheduleClient,
      finalize: finalizeScheduleClient,
      getModelParameters: getModelParametersClient
    }
  }
};
