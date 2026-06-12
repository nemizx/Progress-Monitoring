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

const handleResponse = async (res) => {
  if (!res.ok) {
    let errData;
    try {
      errData = await res.json();
    } catch (e) {
      errData = { error: 'Unknown server error' };
    }
    const err = new Error(errData.error || `HTTP error! status: ${res.status}`);
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
  'User'
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

      const res = await fetch(url, { headers: getHeaders() });
      return handleResponse(res);
    },
    
    filter: async (criteria, sortField, limit) => {
      let url = `/api/entities/${name}/filter`;
      const params = [];
      if (sortField) params.push(`sortField=${encodeURIComponent(sortField)}`);
      if (limit) params.push(`limit=${parseInt(limit)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(criteria)
      });
      return handleResponse(res);
    },

    create: async (data) => {
      const res = await fetch(`/api/entities/${name}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    },

    update: async (id, data) => {
      const res = await fetch(`/api/entities/${name}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    },

    delete: async (id) => {
      const res = await fetch(`/api/entities/${name}/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return handleResponse(res);
    },

    bulkCreate: async (items) => {
      const res = await fetch(`/api/entities/${name}/bulk`, {
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
    const res = await fetch('/api/auth/me', { headers: getHeaders() });
    return handleResponse(res);
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('Planedge_Monitors_current_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  loginViaEmailPassword: async (email, password) => {
    const res = await fetch('/api/auth/login', {
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
    const res = await fetch('/api/auth/register', {
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
    const redirectParam = redirectUrl ? `?from=${encodeURIComponent(redirectUrl)}` : '';
    window.location.href = `/login${redirectParam}`;
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

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers,
    body: formData
  });
  return handleResponse(res);
};

const invokeLLM = async ({ prompt }) => {
  const res = await fetch('/api/integrations/llm', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ prompt })
  });
  const data = await handleResponse(res);
  return data.text || data;
};

const generateScheduleClient = async (params) => {
  const res = await fetch('/api/integrations/schedule/generate', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params)
  });
  return handleResponse(res);
};

const finalizeScheduleClient = async (params) => {
  const res = await fetch('/api/integrations/schedule/finalize', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params)
  });
  return handleResponse(res);
};

const getModelParametersClient = async () => {
  const res = await fetch('/api/integrations/schedule/parameters', {
    headers: getHeaders()
  });
  return handleResponse(res);
};

// Main base44 namespace export
export const base44 = {
  entities,
  auth,
  users: usersMock,
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
