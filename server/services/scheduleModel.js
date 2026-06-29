import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const PARAMS_FILE = path.join(DATA_DIR, 'modelParams.json');
const RECORDS_FILE = path.join(DATA_DIR, 'trainingRecords.json');

const DEFAULT_MODEL_PARAMETERS = {
  baseDurations: {
    mobilization: 10,
    substructure: 22,
    superstructure: 16,
    envelope: 18,
    fitOut: 15,
    commissioning: 10,
    handover: 7
  },
  multipliers: {
    perFloor: 0.03,
    perSubproject: 0.06,
    siteAccess: {
      'Easy site access': 1.0,
      'Restricted site access': 1.2,
      'Urban infill / constrained site': 1.15,
      'N/A': 1.0
    },
    deliveryStrategy: {
      'Fast-track delivery': 1.18,
      'Standard delivery': 1.0,
      'Phased delivery': 1.12,
      'Design & build': 1.08,
      'N/A': 1.0
    },
    finishQuality: {
      'Standard quality': 1.0,
      'High-end finishes': 1.15,
      'Budget economy finishes': 0.95,
      'N/A': 1.0
    },
    includeMEP: {
      'Yes — full MEP': 1.3,
      'Yes — basic MEP': 1.1,
      'No': 0.75,
      'N/A': 1.0
    },
    handoverType: {
      'Full commissioning + testing': 1.2,
      'Standard handover': 1.0,
      'Phased handover': 1.12,
      'No formal handover': 0.9,
      'N/A': 1.0
    }
  },
  trainedCounts: {
    total: 0,
    floorSum: 0,
    subprojectSum: 0,
    siteAccess: {},
    deliveryStrategy: {},
    finishQuality: {}
  }
};

const ensureDir = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};

const loadModelParameters = async () => {
  await ensureDir(DATA_DIR);
  try {
    const data = await fs.readFile(PARAMS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    await fs.writeFile(PARAMS_FILE, JSON.stringify(DEFAULT_MODEL_PARAMETERS, null, 2));
    return DEFAULT_MODEL_PARAMETERS;
  }
};

const saveModelParameters = async (params) => {
  await ensureDir(DATA_DIR);
  await fs.writeFile(PARAMS_FILE, JSON.stringify(params, null, 2));
};

const loadTrainingRecords = async () => {
  await ensureDir(DATA_DIR);
  try {
    const data = await fs.readFile(RECORDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const saveTrainingRecords = async (records) => {
  await ensureDir(DATA_DIR);
  await fs.writeFile(RECORDS_FILE, JSON.stringify(records, null, 2));
};

const formatDate = (date) => date.toISOString().split('T')[0];

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const normalizeNumeric = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const deriveDuration = ({ base, floors, subprojects, multipliers, standardAnswers }) => {
  const floorCount = normalizeNumeric(floors, 5);
  const floorFactor = 1 + Math.max(0, floorCount - 5) * multipliers.perFloor;
  const subprojectFactor = 1 + Math.max(0, subprojects - 1) * multipliers.perSubproject;

  const siteAccessFactor = multipliers.siteAccess[standardAnswers.site_access] || multipliers.siteAccess['N/A'];
  const deliveryFactor = multipliers.deliveryStrategy[standardAnswers.delivery_strategy] || multipliers.deliveryStrategy['N/A'];
  const finishQualityFactor = multipliers.finishQuality[standardAnswers.finish_quality] || multipliers.finishQuality['N/A'];
  const mepFactor = multipliers.includeMEP[standardAnswers.include_mep] || multipliers.includeMEP['N/A'];
  const handoverFactor = multipliers.handoverType[standardAnswers.handover_type] || multipliers.handoverType['N/A'];

  const raw = base * floorFactor * subprojectFactor * siteAccessFactor * deliveryFactor * finishQualityFactor * mepFactor * handoverFactor;
  return Math.max(1, Math.round(raw));
};

const buildMilestoneTemplates = ({ projectType, floors, numSubprojects, includeMep, handoverType, standardAnswers, modelParams }) => {
  const base = modelParams.baseDurations;
  const isMepIncluded = includeMep !== 'No';
  const standardAnswersNormalized = {
    site_access: standardAnswers.site_access || 'N/A',
    delivery_strategy: standardAnswers.delivery_strategy || 'N/A',
    finish_quality: standardAnswers.finish_quality || 'N/A'
  };

  const milestones = [
    {
      activity_id: 'A1000',
      name: 'Site Mobilization & Access Setup',
      phase: 'foundation',
      baseDuration: base.mobilization,
      is_milestone: false,
      assigned_crew: 'Site Establishment Team',
      predecessors: []
    },
    {
      activity_id: 'A1010',
      name: 'Substructure & Foundation Construction',
      phase: 'foundation',
      baseDuration: base.substructure,
      is_milestone: false,
      assigned_crew: 'Foundation Crew',
      predecessors: ['A1000']
    },
    {
      activity_id: 'A1020',
      name: `Superstructure for ${floors} Floors`,
      phase: 'structure',
      baseDuration: base.superstructure,
      is_milestone: false,
      assigned_crew: 'Structural Works Team',
      predecessors: ['A1010']
    },
    {
      activity_id: 'A1030',
      name: 'Weather Envelope & Building Shell',
      phase: 'finishing',
      baseDuration: base.envelope,
      is_milestone: false,
      assigned_crew: 'Envelope Specialists',
      predecessors: ['A1020']
    },
    {
      activity_id: 'A1040',
      name: 'Interior Fit-out & Quality Finishes',
      phase: 'finishing',
      baseDuration: base.fitOut,
      is_milestone: false,
      assigned_crew: 'Finishings Crew',
      predecessors: ['A1030']
    }
  ];

  if (isMepIncluded) {
    milestones.splice(3, 0, {
      activity_id: 'A1025',
      name: 'MEP Core Installation & Dry-in',
      phase: 'mep',
      baseDuration: Math.round(base.fitOut * 0.9),
      is_milestone: false,
      assigned_crew: 'MEP Team',
      predecessors: ['A1020']
    });
  }

  if (numSubprojects > 1) {
    milestones.push({
      activity_id: 'A1045',
      name: `Subproject Coordination & Integration (${numSubprojects} packages)`,
      phase: 'other',
      baseDuration: 6,
      is_milestone: false,
      assigned_crew: 'Project Coordination Office',
      predecessors: ['A1040']
    });
  }

  milestones.push({
    activity_id: 'A1050',
    name: 'Handover Readiness & Commissioning',
    phase: 'handover',
    baseDuration: base.commissioning,
    is_milestone: false,
    assigned_crew: 'Commissioning Engineers',
    predecessors: [isMepIncluded ? 'A1025' : 'A1030', numSubprojects > 1 ? 'A1045' : 'A1040'].filter(Boolean)
  });

  milestones.push({
    activity_id: 'A1060',
    name: 'Client Handover & Sign-off',
    phase: 'handover',
    baseDuration: base.handover,
    is_milestone: true,
    assigned_crew: 'Project Management',
    predecessors: ['A1050']
  });

  return milestones.map((item, index) => ({
    ...item,
    duration_days: deriveDuration({
      base: item.baseDuration,
      floors,
      subprojects: numSubprojects,
      multipliers: modelParams.multipliers,
      standardAnswers: { ...standardAnswersNormalized, include_mep: includeMep, handover_type: handoverType }
    }),
    float_days: item.is_milestone ? 0 : Math.max(1, Math.round(item.baseDuration * 0.12)),
    status: 'not_started',
    progress: 0,
    order_index: index
  }));
};

const computeScheduleDates = (templates, startDate) => {
  const start = new Date(startDate);
  const taskEndDates = {};

  return templates.map((tpl) => {
    let earliest = new Date(start);

    if (tpl.predecessors && tpl.predecessors.length > 0) {
      tpl.predecessors.forEach(pred => {
        const predEnd = taskEndDates[pred];
        if (predEnd) {
          const predDate = new Date(predEnd);
          if (predDate > earliest) {
            earliest = addDays(predDate, 1);
          }
        }
      });
    }

    const plannedStart = formatDate(earliest);
    const plannedEnd = formatDate(addDays(earliest, tpl.duration_days - 1));
    taskEndDates[tpl.activity_id] = plannedEnd;

    return {
      ...tpl,
      planned_start: plannedStart,
      planned_end: plannedEnd
    };
  });
};

export const getModelParameters = async () => {
  return await loadModelParameters();
};

export const generateSchedule = async ({ projectId, subProjectId, projectType, startDate, durationMonths, floors, numSubprojects, includeMep, handoverType, standardAnswers = {}, keyConstraints }) => {
  const modelParams = await loadModelParameters();
  const templates = buildMilestoneTemplates({ projectType, floors, numSubprojects, includeMep, handoverType, standardAnswers, modelParams });
  const schedule = computeScheduleDates(templates, startDate).map((item) => ({
    ...item,
    project_id: projectId,
    description: item.name,
    predecessors: item.predecessors || [],
    successors: [],
    is_critical_path: item.phase !== 'other',
    assigned_crew: item.assigned_crew,
    priority: 'medium'
  }));

  return {
    schedule,
    features: {
      projectType: projectType || 'Standard',
      subProjectId: subProjectId || null,
      durationMonths: normalizeNumeric(durationMonths, 12),
      floors: normalizeNumeric(floors, 5),
      numSubprojects: normalizeNumeric(numSubprojects, 1),
      includeMep,
      handoverType,
      standardAnswers: {
        site_access: standardAnswers.site_access || 'N/A',
        delivery_strategy: standardAnswers.delivery_strategy || 'N/A',
        finish_quality: standardAnswers.finish_quality || 'N/A'
      },
      keyConstraints: keyConstraints || 'None'
    }
  };
};

export const finalizeSchedule = async ({ projectId, subProjectId, features, schedule }) => {
  const records = await loadTrainingRecords();
  const modelParams = await loadModelParameters();
  const normalizedFeatures = {
    ...features,
    subProjectId: subProjectId || features?.subProjectId || null,
    floors: normalizeNumeric(features.floors, 5),
    numSubprojects: normalizeNumeric(features.numSubprojects, 1)
  };

  const record = {
    id: `train_${Math.random().toString(36).substring(2, 11)}`,
    projectId,
    subProjectId: normalizedFeatures.subProjectId,
    created_at: new Date().toISOString(),
    features: normalizedFeatures,
    schedule: schedule.map(item => ({ ...item }))
  };

  records.push(record);
  await saveTrainingRecords(records);

  modelParams.trainedCounts.total += 1;
  modelParams.trainedCounts.floorSum += normalizedFeatures.floors;
  modelParams.trainedCounts.subprojectSum += normalizedFeatures.numSubprojects;

  const trackCategory = (category, key) => {
    modelParams.trainedCounts[category][key] = (modelParams.trainedCounts[category][key] || 0) + 1;
  };

  trackCategory('siteAccess', normalizedFeatures.standardAnswers.site_access);
  trackCategory('deliveryStrategy', normalizedFeatures.standardAnswers.delivery_strategy);
  trackCategory('finishQuality', normalizedFeatures.standardAnswers.finish_quality);

  const averageFloors = modelParams.trainedCounts.floorSum / Math.max(1, modelParams.trainedCounts.total);
  modelParams.multipliers.perFloor = 0.03 + Math.min(0.03, (averageFloors - 5) * 0.01);
  modelParams.multipliers.perSubproject = 0.06 + Math.min(0.1, modelParams.trainedCounts.subprojectSum / Math.max(1, modelParams.trainedCounts.total) * 0.01);

  const updateCategoryFactors = (source, target) => {
    Object.keys(modelParams.multipliers[target]).forEach(key => {
      const count = modelParams.trainedCounts[source][key] || 0;
      const baseValue = DEFAULT_MODEL_PARAMETERS.multipliers[target][key] || 1.0;
      const adjustment = Math.min(0.18, count * 0.015);
      modelParams.multipliers[target][key] = baseValue + adjustment;
    });
  };

  updateCategoryFactors('siteAccess', 'siteAccess');
  updateCategoryFactors('deliveryStrategy', 'deliveryStrategy');
  updateCategoryFactors('finishQuality', 'finishQuality');

  await saveModelParameters(modelParams);
  return { record, modelParams };
};

export default {
  generateSchedule,
  finalizeSchedule,
  getModelParameters,
};
