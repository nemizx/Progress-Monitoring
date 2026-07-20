/** Standard project type options stored on projects.project_type */

export const PROJECT_TYPES = [
  { value: 'residential_building', label: 'Residential Building' },
  { value: 'commercial_building', label: 'Commercial Building' },
  { value: 'residential_cum_commercial', label: 'Residential Cum Commercial' },
  { value: 'multi_residential_building', label: 'Multi Residential Building' },
  { value: 'factory_building', label: 'Factory Building' },
  { value: 'educational_building', label: 'Educational Building' },
  { value: 'infrastructure_project', label: 'Infrastructure Project' },
  { value: 'road_project', label: 'Road Project' },
  { value: 'bridge_project', label: 'Bridge Project' },
  { value: 'canal_project', label: 'Canal Project' },
  { value: 'power_plant', label: 'Power Plant' },
  { value: 'steel_plant', label: 'Steel Plant' },
  { value: 'metro_project', label: 'Metro Project' },
  { value: 'accommodation_building', label: 'Accommodation Building' },
  { value: 'sra', label: 'SRA' },
  { value: 'border_check_post', label: 'Border Check Post' },
  { value: 'corporate_office', label: 'Corporate Office' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'transit_camp', label: 'Transit Camp' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'retail', label: 'Retail' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'other', label: 'Other' },
  { value: 'ugd', label: 'UGD' },
  { value: 'company', label: 'Company' },
  { value: 'guest_house', label: 'Guest House' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'individual', label: 'Individual' },
  { value: 'industrial_estate', label: 'Industrial Estate' },
  { value: 'institution', label: 'Institution' },
  { value: 'mall', label: 'Mall' },
  { value: 'society', label: 'Society' },
  { value: 'plot_properties', label: 'Plot Properties' },
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
