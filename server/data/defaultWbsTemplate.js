/**
 * Standard WBS format used across all projects.
 * Heads only (L1). Sub-heads are added per project via upload / manual entry.
 * wbs_id is the identifier: 1, 2, 3, etc.
 */
export const DEFAULT_WBS_TEMPLATE = [
  { wbs_id: '1', title: 'Earth Work', level: 1, parent_wbs_id: null, order_index: 0 },
  { wbs_id: '2', title: 'RCC Work', level: 1, parent_wbs_id: null, order_index: 10 },
  { wbs_id: '3', title: 'Masonary & Plaster Work', level: 1, parent_wbs_id: null, order_index: 20 },
  { wbs_id: '4', title: 'Waterproofing Work', level: 1, parent_wbs_id: null, order_index: 30 },
  { wbs_id: '5', title: 'Doors & Wooden Works', level: 1, parent_wbs_id: null, order_index: 40 },
  { wbs_id: '6', title: 'Windows & Sliding Doors', level: 1, parent_wbs_id: null, order_index: 50 },
  { wbs_id: '7', title: 'Flooring & Tiling works', level: 1, parent_wbs_id: null, order_index: 60 },
  { wbs_id: '8', title: 'MS & SS Works- Grills & Railings', level: 1, parent_wbs_id: null, order_index: 70 },
  { wbs_id: '9', title: 'Painting & Polishing Works', level: 1, parent_wbs_id: null, order_index: 80 },
  { wbs_id: '10', title: 'Plumbing & Drainage Work', level: 1, parent_wbs_id: null, order_index: 90 },
  { wbs_id: '11', title: 'Electrical Work', level: 1, parent_wbs_id: null, order_index: 100 },
  { wbs_id: '12', title: 'Lift Work', level: 1, parent_wbs_id: null, order_index: 110 },
  { wbs_id: '13', title: 'Buildings Fire Fighting Work', level: 1, parent_wbs_id: null, order_index: 120 },
  { wbs_id: '14', title: 'Elevation, Glazing & Facade Work', level: 1, parent_wbs_id: null, order_index: 130 },
  { wbs_id: '15', title: 'Bldg. Amenities', level: 1, parent_wbs_id: null, order_index: 140 },
  { wbs_id: '16', title: 'Misc, Dep. Labour, Cleaning', level: 1, parent_wbs_id: null, order_index: 150 },
];
