/**
 * Standard WBS format used across all projects.
 * wbs_id is the identifier: 1, 1.1, 1.2, 5.4, etc.
 */
export const DEFAULT_WBS_TEMPLATE = [
  { wbs_id: '1', title: 'Earth Work', level: 1, parent_wbs_id: null, order_index: 0 },
  { wbs_id: '1.1', title: 'Excavation', level: 2, parent_wbs_id: '1', order_index: 1 },
  { wbs_id: '1.2', title: 'Backfilling', level: 2, parent_wbs_id: '1', order_index: 2 },
  { wbs_id: '1.3', title: 'Anti Termite treatment', level: 2, parent_wbs_id: '1', order_index: 3 },
  { wbs_id: '1.4', title: 'Rubble Soiling', level: 2, parent_wbs_id: '1', order_index: 4 },
  { wbs_id: '1.5', title: 'Piling Work', level: 2, parent_wbs_id: '1', order_index: 5 },

  { wbs_id: '2', title: 'RCC Work', level: 1, parent_wbs_id: null, order_index: 10 },
  { wbs_id: '2.1', title: 'PCC', level: 2, parent_wbs_id: '2', order_index: 11 },
  { wbs_id: '2.2', title: 'Concrete Work', level: 2, parent_wbs_id: '2', order_index: 12 },
  { wbs_id: '2.3', title: 'Reinforcement Work', level: 2, parent_wbs_id: '2', order_index: 13 },
  { wbs_id: '2.4', title: 'Shuttering', level: 2, parent_wbs_id: '2', order_index: 14 },

  { wbs_id: '3', title: 'Masonary & Plaster Work', level: 1, parent_wbs_id: null, order_index: 20 },
  { wbs_id: '3.1', title: 'Massonary Work', level: 2, parent_wbs_id: '3', order_index: 21 },
  { wbs_id: '3.2', title: 'Ceiling Plaster', level: 2, parent_wbs_id: '3', order_index: 22 },
  { wbs_id: '3.3', title: 'Internal Plaster', level: 2, parent_wbs_id: '3', order_index: 23 },
  { wbs_id: '3.4', title: 'External Plaster', level: 2, parent_wbs_id: '3', order_index: 24 },
  { wbs_id: '3.5', title: 'Gypsum Plaster', level: 2, parent_wbs_id: '3', order_index: 25 },

  { wbs_id: '4', title: 'Waterproofing Work', level: 1, parent_wbs_id: null, order_index: 30 },
  { wbs_id: '4.1', title: 'Substructure Waterproofing', level: 2, parent_wbs_id: '4', order_index: 31 },
  { wbs_id: '4.2', title: 'Superstructure Waterproofing', level: 2, parent_wbs_id: '4', order_index: 32 },
  { wbs_id: '4.3', title: 'Top Terrace Waterproofing', level: 2, parent_wbs_id: '4', order_index: 33 },
  { wbs_id: '4.4', title: 'OHWT Waterproofing', level: 2, parent_wbs_id: '4', order_index: 34 },

  { wbs_id: '5', title: 'Doors & Wooden Works', level: 1, parent_wbs_id: null, order_index: 40 },
  { wbs_id: '5.1', title: 'Doors', level: 2, parent_wbs_id: '5', order_index: 41 },
  { wbs_id: '5.2', title: 'Staircase Door', level: 2, parent_wbs_id: '5', order_index: 42 },
  { wbs_id: '5.3', title: 'Duct Doors', level: 2, parent_wbs_id: '5', order_index: 43 },

  { wbs_id: '6', title: 'Windows & Sliding Doors', level: 1, parent_wbs_id: null, order_index: 50 },
  { wbs_id: '6.1', title: 'Sliding Doors', level: 2, parent_wbs_id: '6', order_index: 51 },
  { wbs_id: '6.2', title: 'Sliding Windows', level: 2, parent_wbs_id: '6', order_index: 52 },
  { wbs_id: '6.3', title: 'Ventilators', level: 2, parent_wbs_id: '6', order_index: 53 },

  { wbs_id: '7', title: 'Flooring & Tiling works', level: 1, parent_wbs_id: null, order_index: 60 },
  { wbs_id: '7.1', title: 'Flooring', level: 2, parent_wbs_id: '7', order_index: 61 },
  { wbs_id: '7.2', title: 'Skirting', level: 2, parent_wbs_id: '7', order_index: 62 },
  { wbs_id: '7.3', title: 'Dado', level: 2, parent_wbs_id: '7', order_index: 63 },
  { wbs_id: '7.4', title: 'Granite & Stone Work', level: 2, parent_wbs_id: '7', order_index: 64 },

  { wbs_id: '8', title: 'MS & SS Works- Grills & Railings', level: 1, parent_wbs_id: null, order_index: 70 },
  { wbs_id: '8.1', title: 'MS Grill & Railing', level: 2, parent_wbs_id: '8', order_index: 71 },
  { wbs_id: '8.2', title: 'SS Railing', level: 2, parent_wbs_id: '8', order_index: 72 },
  { wbs_id: '8.3', title: 'MS Ladder & Cover', level: 2, parent_wbs_id: '8', order_index: 73 },

  { wbs_id: '9', title: 'Painting & Polishing Works', level: 1, parent_wbs_id: null, order_index: 80 },
  { wbs_id: '9.1', title: 'Internal Paint', level: 2, parent_wbs_id: '9', order_index: 81 },
  { wbs_id: '9.2', title: 'External Paint', level: 2, parent_wbs_id: '9', order_index: 82 },
  { wbs_id: '9.3', title: 'White Wash', level: 2, parent_wbs_id: '9', order_index: 83 },
  { wbs_id: '9.4', title: 'Oil Paint', level: 2, parent_wbs_id: '9', order_index: 84 },

  { wbs_id: '10', title: 'Plumbing & Drainage Work', level: 1, parent_wbs_id: null, order_index: 90 },
  { wbs_id: '10.1', title: 'Concealed Plumbing', level: 2, parent_wbs_id: '10', order_index: 91 },
  { wbs_id: '10.2', title: 'CP & Sanitary Work', level: 2, parent_wbs_id: '10', order_index: 92 },

  { wbs_id: '11', title: 'Electrical Work', level: 1, parent_wbs_id: null, order_index: 100 },
  { wbs_id: '11.1', title: 'Wiring & Fitting Work', level: 2, parent_wbs_id: '11', order_index: 101 },
  { wbs_id: '11.2', title: 'Switches Work', level: 2, parent_wbs_id: '11', order_index: 102 },

  { wbs_id: '12', title: 'Lift Work', level: 1, parent_wbs_id: null, order_index: 110 },
  { wbs_id: '12.1', title: 'Lift', level: 2, parent_wbs_id: '12', order_index: 111 },

  { wbs_id: '13', title: 'Buildings Fire Fighting Work', level: 1, parent_wbs_id: null, order_index: 120 },
  { wbs_id: '13.1', title: 'Building Firefighting', level: 2, parent_wbs_id: '13', order_index: 121 },

  { wbs_id: '14', title: 'Elevation, Glazing & Facade Work', level: 1, parent_wbs_id: null, order_index: 130 },
  { wbs_id: '14.1', title: 'MS Fins & Louvers', level: 2, parent_wbs_id: '14', order_index: 131 },
  { wbs_id: '14.2', title: 'Glazing Work', level: 2, parent_wbs_id: '14', order_index: 132 },

  { wbs_id: '15', title: 'Bldg. Amenities', level: 1, parent_wbs_id: null, order_index: 140 },
  { wbs_id: '15.1', title: 'Building Amenities', level: 2, parent_wbs_id: '15', order_index: 141 },
  { wbs_id: '15.2', title: 'False Ceiling Work', level: 2, parent_wbs_id: '15', order_index: 142 },
  { wbs_id: '15.3', title: 'HVAC Work', level: 2, parent_wbs_id: '15', order_index: 143 },

  { wbs_id: '16', title: 'Misc, Dep. Labour, Cleaning', level: 1, parent_wbs_id: null, order_index: 150 },
  { wbs_id: '16.1', title: 'Miscellaneous Work', level: 2, parent_wbs_id: '16', order_index: 151 },
];
