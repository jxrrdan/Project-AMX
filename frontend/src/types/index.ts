export interface ManufacturerRef {
  brand_id: string
  manufacturer_customer_id: string
  system_id: string
}

export interface Customer {
  id: string
  dealer_group_id: string
  outlet_id: string
  title?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  mobile?: string
  company_name?: string
  is_business: boolean
  address_line_1?: string
  address_line_2?: string
  town?: string
  county?: string
  postcode?: string
  country: string
  manufacturer_refs: ManufacturerRef[]
  source: string
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  dealer_group_id: string
  outlet_id: string
  vin?: string
  registration?: string
  make: string
  model: string
  derivative?: string
  colour?: string
  fuel_type?: string
  transmission?: string
  year?: number
  mileage?: number
  brand_id?: string
  manufacturer_vehicle_id?: string
  source: string
  created_at: string
}

export interface AccessoryLine {
  part_number: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  fitted: boolean
}

export interface Order {
  id: string
  dealer_group_id: string
  outlet_id: string
  oem_order_id: string
  oem_order_ref?: string
  brand_id?: string
  customer_id?: string
  ordered_model: string
  ordered_derivative?: string
  ordered_colour?: string
  ordered_vin?: string
  accessory_lines: AccessoryLine[]
  accessories_total: number
  accessories_invoiced: boolean
  accessories_invoice_date?: string
  pdi_planned: boolean
  pdi_planned_date?: string
  pdi_wip_id?: string
  order_date: string
  expected_delivery_date?: string
  actual_delivery_date?: string
  status: string
  received_at: string
}

export interface LabourLine {
  op_code: string
  description: string
  hours: number
  rate: number
  total: number
  technician_id?: string
  completed: boolean
}

export interface PartsLine {
  part_number: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  status: string
}

export interface WIP {
  id: string
  dealer_group_id: string
  outlet_id: string
  oem_wip_id: string
  oem_wip_ref?: string
  brand_id?: string
  customer_id?: string
  vehicle_vin?: string
  vehicle_registration?: string
  vehicle_make?: string
  vehicle_model?: string
  vehicle_mileage_in?: number
  job_type: string
  labour_lines: LabourLine[]
  parts_lines: PartsLine[]
  allocated_technician_id?: string
  allocated_technician_name?: string
  labour_total: number
  parts_total: number
  total: number
  status: string
  booking_date?: string
  promised_date?: string
  started_at?: string
  completed_at?: string
  vhc_id?: string
  vhc_required: boolean
  created_at: string
  updated_at: string
}

export interface VHCItem {
  category: string
  item: string
  description: string
  condition: 'pass' | 'advisory' | 'fail' | 'not_checked'
  notes?: string
  image_urls: string[]
  measurement?: string
}

export interface VHC {
  id: string
  dealer_group_id: string
  outlet_id: string
  wip_id?: string
  customer_id?: string
  vehicle_id?: string
  technician_id?: string
  technician_name?: string
  vehicle_registration?: string
  vehicle_mileage?: number
  items: VHCItem[]
  pass_count: number
  advisory_count: number
  fail_count: number
  requires_authorisation: boolean
  status: string
  authorised_at?: string
  authorised_by?: string
  created_at: string
}

export interface Part {
  id: string
  dealer_group_id: string
  part_number: string
  description: string
  brand_id?: string
  category?: string
  unit_cost: number
  unit_sell: number
  is_active: boolean
}

export interface StockLevel {
  id: string
  outlet_id: string
  part_number: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number
  bin_location?: string
}

export interface DashboardSummary {
  orders: Record<string, number>
  wips: Record<string, number>
  vhcs_awaiting_authorisation: number
}

export type WIPStatus = 'open' | 'in_progress' | 'awaiting_parts' | 'awaiting_authorisation' | 'ready' | 'invoiced'
export type OrderStatus = 'received' | 'accessories_invoiced' | 'pdi_booked' | 'pdi_complete' | 'ready' | 'delivered'
export type VHCStatus = 'draft' | 'in_progress' | 'awaiting_authorisation' | 'authorised' | 'declined' | 'complete'
