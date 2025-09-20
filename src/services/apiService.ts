// Local API service for MySQL backend
export const API_BASE_URL = 'http://localhost:3001/api'; // Local backend URL

export interface User {
  id: number;
  username: string;
  role?: string;
  name?: string;
}

export interface MedicalRecord {
  id: number;
  patient_name: string;
  raw_text: string;
  diagnosis: string | null;
  medications: string | null;
  patient_id?: string;
  age?: number;
  sex?: string;
  date?: string;
  weight?: number | null;
  height?: number | null;
  temperature?: number | null;
  image_url?: string;
  created_at: string;
}

export interface AuthResponse {
  user?: User;
  token?: string;
  error?: string;
}

class APIService {
  private token: string | null = null;
  // Simple in-memory cache/promise reuse to throttle repeated identical GETs
  private _requestCache: Record<string, { ts: number; promise?: Promise<any>; data?: any }> = {};

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
  // Read token from storage on every request so different auth flows (useAuth vs apiService)
  const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || this.token;

  // Build headers safely (options.headers may be undefined)
  const providedHeaders = (options.headers || {}) as Record<string, string>;

  // Detect FormData
  const isFormData = options.body && typeof (options.body as any).append === 'function';

  // Only add Content-Type when a body is present and it's not FormData.
  const contentTypeHeader = (options.body && !isFormData) ? { 'Content-Type': 'application/json' } : {};

  const headers: Record<string, any> = {
    ...contentTypeHeader,
    ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    ...providedHeaders,
  };

    try {
      const response = await fetch(url, { ...options, headers });

      // Handle 204 No Content
      if (response.status === 204) return null;

      // Try to parse JSON, but guard against empty responses
      let data: any = null;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          // Not JSON, return raw text
          data = text;
        }
      }

      if (!response.ok) {
        throw new Error((data && data.error) || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      // Detect common network / CORS failures and give a clearer message for debugging
      console.error('API request failed:', error);
      if (error instanceof TypeError && String(error.message).toLowerCase().includes('failed to fetch')) {
        throw new Error('Network error or CORS issue: failed to reach the backend. Ensure the API server is running and CORS (Access-Control-Allow-Origin) allows this origin.');
      }
      // If the error is a thrown Error with message, surface it
      if (error && (error as any).message) throw error;
      throw new Error('API request failed');
    }
  }

  // ------------------------
  // Audit logs
  async deleteAuditLog(id: string): Promise<void> {
    await this.request(`/audit-logs/${id}`, { method: 'DELETE' });
  }

  async createAuditLog(payload: { user_id?: number | null; action: string; details?: any; resource_type?: string; resource_id?: string | number }): Promise<any> {
    return this.request('/audit-logs', { method: 'POST', body: JSON.stringify(payload) });
  }

  // ------------------------
  // Auth
  async signIn(username: string, password: string): Promise<AuthResponse> {
  // Sign in via backend and store returned JWT

    try {
      const resp = await this.request('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (resp.access_token) {
        this.token = resp.access_token;
        localStorage.setItem('auth_token', resp.access_token);
        try {
          // prefer role claim from JWT if present
          const token = resp.access_token as string;
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (resp.user) {
            const u = { ...resp.user } as any;
            if (payload && payload.role) u.role = String(payload.role).toLowerCase();
            else if (u.role) u.role = String(u.role).toLowerCase();
            localStorage.setItem('user', JSON.stringify(u));
          }
        } catch (e) {
          // fallback: store as provided
          if (resp.user) localStorage.setItem('user', JSON.stringify(resp.user));
        }
      }
      return resp;
    } catch {
      return { error: 'Failed to sign in' };
    }
  }

  async signUp(username: string, password: string, name: string, role: string = 'doctor'): Promise<AuthResponse> {
    try {
      const resp = await this.request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password, name, role }),
      });
      if (resp.user && resp.access_token) {
        this.token = resp.access_token;
        localStorage.setItem('auth_token', resp.access_token);
        try {
          const token = resp.access_token as string;
          const payload = JSON.parse(atob(token.split('.')[1]));
          const u = { ...resp.user } as any;
          if (payload && payload.role) u.role = String(payload.role).toLowerCase();
          else if (u.role) u.role = String(u.role).toLowerCase();
          localStorage.setItem('user', JSON.stringify(u));
        } catch (e) {
          localStorage.setItem('user', JSON.stringify(resp.user));
        }
      }
      return resp;
    } catch {
      return { error: 'Failed to sign up' };
    }
  }

  async signOut(): Promise<void> {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  async changePassword(current_password: string, new_password: string): Promise<any> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password })
    });
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // ------------------------
  // Medical Records
  async getMedicalRecords(q?: string): Promise<MedicalRecord[]> {
    const endpoint = q ? `/medical-records?q=${encodeURIComponent(q)}` : '/medical-records';
    const key = endpoint;
    const now = Date.now();
    // reuse in-flight promise if recent (2s) to avoid spamming the backend
    const cached = this._requestCache[key];
    if (cached) {
      if (cached.promise && now - cached.ts < 2000) {
        console.debug('[apiService] Reusing in-flight getMedicalRecords promise for', q || '__all__');
        const data = await cached.promise;
        return data.records || [];
      }
      if (cached.data && now - cached.ts < 2000) {
        console.debug('[apiService] Returning cached getMedicalRecords data for', q || '__all__');
        return cached.data.records || [];
      }
    }

    console.debug('[apiService] getMedicalRecords called', q || '__all__');
    const p = this.request(endpoint);
    this._requestCache[key] = { ts: now, promise: p };
    try {
      const data = await p;
      this._requestCache[key] = { ts: Date.now(), data };
      return data.records || [];
    } catch (err) {
      if (this._requestCache[key] && this._requestCache[key].promise === p) delete this._requestCache[key];
      throw err;
    }
  }

  async getMedicalRecord(id: number): Promise<MedicalRecord> {
    const data = await this.request(`/medical-records/${id}`);
    return data.record;
  }

  async getAnalytics(): Promise<{ total_patients: number; diagnoses: { diagnosis: string; count: number }[] }> {
    const data = await this.request(`/medical-records/stats`);
    return {
      total_patients: data?.total_patients || 0,
      diagnoses: data?.diagnoses || []
    };
  }

  async createMedicalRecord(record: {
    patient_name: string;
    raw_text: string;
    diagnosis?: string;
    medications?: string;
    age?: number;
    sex?: string;
    date?: string;
    patient_id?: string;
    weight?: number | null;
    height?: number | null;
    temperature?: number | null;
    image_url?: string;
    doctor_name?: string;
  }): Promise<MedicalRecord> {
    const data = await this.request('/medical-records', {
      method: 'POST',
      body: JSON.stringify(record),
    });
    return data.record;
  }

  async updateMedicalRecord(id: number, updates: Partial<MedicalRecord>): Promise<MedicalRecord> {
    const data = await this.request(`/medical-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return data.record;
  }

  async deleteMedicalRecord(id: number): Promise<void> {
    await this.request(`/medical-records/${id}`, { method: 'DELETE' });
  }

  async uploadFile(file: File | Blob): Promise<any> {
    const formData = new FormData();

    // If we received a plain Blob, convert it to a File so some backends have a filename
    let fileToSend: File;
    if ((file as File).name) {
      fileToSend = file as File;
    } else {
      const blob = file as Blob;
      const ext = blob.type && blob.type.split('/')[1] ? `.${blob.type.split('/')[1]}` : '.jpg';
      fileToSend = new File([blob], `capture${ext}`, { type: blob.type || 'image/jpeg' });
    }

    formData.append('file', fileToSend);
    const headers: any = {};
    const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || this.token;
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers,
    });

    // Try to parse response body for helpful errors
    const text = await response.text();
    let json: any = null;
    if (text) {
      try { json = JSON.parse(text); } catch (e) { json = text; }
    }

    if (!response.ok) {
      const msg = (json && json.error) ? json.error : (typeof json === 'string' ? json : `HTTP ${response.status}`);
      const detail = (json && json.detail) ? json.detail : null;
      const trace = (json && json.trace) ? json.trace : null;
      // Throw a rich error object so callers can surface server 'detail' and 'trace'
      const err: any = new Error(`File upload failed: ${msg}`);
      if (detail) err.detail = detail;
      if (trace) err.trace = trace;
      err.status = response.status;
      throw err;
    }

    return json; // Returns record_id and extracted fields
  }

  // Upload by data URL (base64) or File
  // Accept data URL (string) or File/Blob
  async uploadMedicalRecord(data: string | File | Blob): Promise<any> {
    if (typeof data === 'string') {
      // If it's a data URL (base64), convert to Blob and upload as multipart so backend gets a 'file' part
      if (data.startsWith('data:')) {
        try {
          const res = await fetch(data);
          const blob = await res.blob();
          return this.uploadFile(blob);
        } catch (err) {
          // fall back to JSON POST if blob conversion fails
          return this.request('/upload', {
            method: 'POST',
            body: JSON.stringify({ data_url: data }),
          });
        }
      }
      // otherwise, send as JSON payload
      return this.request('/upload', {
        method: 'POST',
        body: JSON.stringify({ data_url: data }),
      });
    }

    // File or Blob upload
    return this.uploadFile(data as File | Blob);
  }

  // Delete current account
  async deleteAccount(): Promise<any> {
    return this.request('/auth/delete', { method: 'DELETE' });
  }

  // Admin / Doctors
  async getDoctorProfiles(): Promise<any[]> {
    const data = await this.request('/doctors');
    return data.doctors || [];
  }

  async deleteDoctorProfile(doctorId: string): Promise<any> {
    return this.request(`/doctors/${doctorId}`, { method: 'DELETE' });
  }

  async updateDoctorProfile(userId: string, updates: { username: string; name: string; role?: string; specialization?: string }): Promise<any> {
    return this.request(`/doctors/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Audit logs
  async getAuditLogs(): Promise<any[]> {
    const data = await this.request('/audit-logs');
    return data.logs || [];
  }
}

export const apiService = new APIService();
