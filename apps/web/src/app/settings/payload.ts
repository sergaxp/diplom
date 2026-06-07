import { UpdateProfilePayload } from '../../lib/profile';
import { ProfileForm, ManagerForm } from './types';

export function isProfileDirty(form: ProfileForm, initial: ProfileForm): boolean {
  return (
    form.displayName.trim() !== initial.displayName ||
    form.username.trim()    !== initial.username    ||
    form.bio.trim()         !== initial.bio
  );
}

export function buildProfilePayload(form: ProfileForm, initial: ProfileForm): UpdateProfilePayload {
  const payload: UpdateProfilePayload = {};
  if (form.displayName.trim() !== initial.displayName) payload.displayName = form.displayName.trim() || undefined;
  if (form.username.trim()    !== initial.username)    payload.username    = form.username.trim() || undefined;
  if (form.bio.trim()         !== initial.bio)         payload.bio         = form.bio.trim() || undefined;
  return payload;
}

export function buildManagerPayload(form: ManagerForm, initial: ManagerForm): UpdateProfilePayload {
  const payload: UpdateProfilePayload = {};
  if (form.location.trim() !== initial.location) {
    payload.location    = form.location.trim() || undefined;
    payload.locationLat = form.locationLat ?? undefined;
    payload.locationLon = form.locationLon ?? undefined;
  }
  if (form.showGlobalEvents !== initial.showGlobalEvents) payload.showGlobalEvents = form.showGlobalEvents;
  if (form.showHolidays     !== initial.showHolidays)     payload.showHolidays     = form.showHolidays;
  return payload;
}
