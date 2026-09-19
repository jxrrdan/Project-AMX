/** Default PDI checklist template (Feature Spec §1.4 "customisable per dealer" — this is the seed default). */
export const DEFAULT_PDI_CHECKLIST: { category: string; label: string }[] = [
  { category: 'Exterior', label: 'Paintwork condition' },
  { category: 'Exterior', label: 'Panel gaps and alignment' },
  { category: 'Exterior', label: 'Wheels and tyres (inc. spare/repair kit)' },
  { category: 'Interior', label: 'Upholstery and trim condition' },
  { category: 'Interior', label: 'Infotainment system boot and pairing' },
  { category: 'Interior', label: 'Floor mats and boot liner fitted' },
  { category: 'Mechanical', label: 'Fluid levels (oil, coolant, brake, washer)' },
  { category: 'Mechanical', label: 'Battery condition and charge' },
  { category: 'Mechanical', label: 'Brakes and handbrake operation' },
  { category: 'Documentation', label: 'Handbook, service book, spare key present' },
  { category: 'Documentation', label: 'Number plates correct and fitted' },
  { category: 'Road test', label: 'Road test completed, no warning lights' },
];
