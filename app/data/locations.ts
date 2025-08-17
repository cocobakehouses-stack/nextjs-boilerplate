// data/locations.ts
export const LOCATIONS = [
  { id: 'FLAGSHIP', label: 'หน้าร้าน' },
  { id: 'SINDHORN', label: 'สินธร' },
  { id: 'CHIN3', label: 'ชินวัตร 3' },
] as const;

export type LocationId = typeof LOCATIONS[number]['id'];
