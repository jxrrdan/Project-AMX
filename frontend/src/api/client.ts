import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('amx_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('amx_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// --- Auth ---
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then((r) => r.data)

// --- Dashboard ---
export const getDashboardSummary = () =>
  api.get('/dashboard/summary').then((r) => r.data)

// --- Customers ---
export const listCustomers = (params?: Record<string, string | number>) =>
  api.get('/customers', { params }).then((r) => r.data)

export const getCustomer = (id: string) =>
  api.get(`/customers/${id}`).then((r) => r.data)

export const createCustomer = (data: object) =>
  api.post('/customers', data).then((r) => r.data)

export const updateCustomer = (id: string, data: object) =>
  api.patch(`/customers/${id}`, data).then((r) => r.data)

export const getFuzzyMatches = (id: string) =>
  api.get(`/customers/${id}/fuzzy-matches`).then((r) => r.data)

// --- Vehicles ---
export const listVehicles = (params?: Record<string, string | number>) =>
  api.get('/vehicles', { params }).then((r) => r.data)

export const getVehicle = (id: string) =>
  api.get(`/vehicles/${id}`).then((r) => r.data)

export const createVehicle = (data: object) =>
  api.post('/vehicles', data).then((r) => r.data)

// --- Orders ---
export const listOrders = (params?: Record<string, string | number>) =>
  api.get('/orders', { params }).then((r) => r.data)

export const getOrder = (id: string) =>
  api.get(`/orders/${id}`).then((r) => r.data)

export const planPDI = (id: string, planned_date: string) =>
  api.post(`/orders/${id}/plan-pdi`, { planned_date }).then((r) => r.data)

export const markAccessoriesInvoiced = (id: string, invoice_ref?: string) =>
  api.post(`/orders/${id}/mark-accessories-invoiced`, null, {
    params: invoice_ref ? { invoice_ref } : undefined,
  }).then((r) => r.data)

// --- WIPs ---
export const listWIPs = (params?: Record<string, string | number>) =>
  api.get('/wips', { params }).then((r) => r.data)

export const getWIP = (id: string) =>
  api.get(`/wips/${id}`).then((r) => r.data)

export const updateWIPStatus = (id: string, status: string) =>
  api.patch(`/wips/${id}/status`, null, { params: { new_status: status } }).then((r) => r.data)

export const allocateTechnician = (id: string, technician_id: string, technician_name?: string) =>
  api.patch(`/wips/${id}/allocate-technician`, null, {
    params: { technician_id, technician_name },
  }).then((r) => r.data)

export const allocateParts = (id: string) =>
  api.post(`/wips/${id}/allocate-parts`).then((r) => r.data)

// --- Parts ---
export const listParts = (params?: Record<string, string | number>) =>
  api.get('/parts', { params }).then((r) => r.data)

export const listStock = (params?: Record<string, string | boolean>) =>
  api.get('/parts/stock', { params }).then((r) => r.data)

export const adjustStock = (part_number: string, data: object) =>
  api.post(`/parts/stock/${part_number}/adjust`, data).then((r) => r.data)

// --- VHCs ---
export const listVHCs = (params?: Record<string, string>) =>
  api.get('/vhcs', { params }).then((r) => r.data)

export const getVHC = (id: string) =>
  api.get(`/vhcs/${id}`).then((r) => r.data)

export const createVHC = (data: object) =>
  api.post('/vhcs', data).then((r) => r.data)

export const updateVHCItems = (id: string, items: object[]) =>
  api.patch(`/vhcs/${id}/items`, items).then((r) => r.data)

export const requestVHCAuthorisation = (id: string, method: string) =>
  api.post(`/vhcs/${id}/request-authorisation`, null, { params: { method } }).then((r) => r.data)

export const authoriseVHC = (id: string, authorised_by: string) =>
  api.post(`/vhcs/${id}/authorise`, null, { params: { authorised_by } }).then((r) => r.data)
