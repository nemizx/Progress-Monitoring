/** Standard project type options stored on projects.project_type */

export const PROJECT_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'residential_commercial', label: 'Residential + Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'infrastructure', label: 'Infrastructure / Civil' },
  { value: 'renovation', label: 'Renovation / Fit-out' },
];

/** Labels used by the schedule generation model / AI wizard */
const SCHEDULE_TYPE_LABELS = {
  residential: 'Residential Building',
  commercial: 'Commercial Tower',
  residential_commercial: 'Residential + Commercial (Mixed Use)',
  industrial: 'Industrial Facility',
  infrastructure: 'Infrastructure / Civil',
  renovation: 'Renovation / Fit-out',
};

export function getProjectTypeLabel(value) {
  if (!value) return null;
  return PROJECT_TYPES.find((t) => t.value === value)?.label || value.replace(/_/g, ' ');
}

export function mapProjectTypeToScheduleLabel(value) {
  if (!value) return null;
  return SCHEDULE_TYPE_LABELS[value] || getProjectTypeLabel(value);
}
