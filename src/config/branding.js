/**
 * Branding assets used across the app and MPR PDF report.
 * To replace the Planedge logo later without changing report logic:
 * 1. Replace `src/assets/logo-planedge.png` and/or `public/planedge-logo.png`, OR
 * 2. Set `VITE_PLANEDGE_LOGO_URL` (e.g. `/planedge-logo.png`) in env.
 */
import defaultPlanedgeLogo from '@/assets/logo-planedge.png';

export const BRANDING = {
  companyName: 'PLANEDGE',
  tagline: 'We Build Better',
  logoSrc: import.meta.env.VITE_PLANEDGE_LOGO_URL || defaultPlanedgeLogo,
};

export const ELEVATION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ELEVATION_IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png';
export const ELEVATION_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export function validateElevationImageFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' };

  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const extOk = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
  const typeOk = ELEVATION_IMAGE_TYPES.includes(type) || (!type && extOk);

  if (!typeOk && !extOk) {
    return { ok: false, error: 'Only JPG, JPEG, or PNG images are allowed.' };
  }
  if (file.size > ELEVATION_IMAGE_MAX_BYTES) {
    return { ok: false, error: 'Image must be 5 MB or smaller.' };
  }
  return { ok: true };
}
