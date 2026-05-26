import { api } from './api';

export type BugReportStatus = 'unread' | 'in_progress' | 'fixed';
export type FeatureRequestStatus =
  | 'unread'
  | 'in_progress'
  | 'implemented'
  | 'under_discussion'
  | 'not_needed';

export interface BugReport {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  attachmentUrls: string[] | null;
  status: BugReportStatus;
  createdAt: string;
  updatedAt: string;
  user?: { username: string; displayName: string | null; avatarUrl: string | null };
}

export interface FeatureRequest {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  createdAt: string;
  updatedAt: string;
  user?: { username: string; displayName: string | null; avatarUrl: string | null };
}

export const BUG_STATUS_LABEL: Record<BugReportStatus, string> = {
  unread:      'Не прочитано',
  in_progress: 'В работе',
  fixed:       'Исправлено',
};

export const FEATURE_STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  unread:           'Не прочитано',
  in_progress:      'В работе',
  implemented:      'Внедрено',
  under_discussion: 'На обсуждении',
  not_needed:       'Не нуждается во внедрении',
};

export const feedbackApi = {
  createBugReport: (data: {
    title: string;
    description?: string;
    attachmentUrls?: string[];
    attachmentKeys?: string[];
  }) => api.post<BugReport>('/feedback/bugs', data).then(r => r.data),

  getMyBugReports: () =>
    api.get<BugReport[]>('/feedback/bugs/my').then(r => r.data),

  createFeatureRequest: (data: { title: string; description?: string }) =>
    api.post<FeatureRequest>('/feedback/features', data).then(r => r.data),

  getMyFeatureRequests: () =>
    api.get<FeatureRequest[]>('/feedback/features/my').then(r => r.data),
};

export const adminFeedbackApi = {
  getAllBugReports: () =>
    api.get<BugReport[]>('/admin/feedback/bugs').then(r => r.data),

  getAllFeatureRequests: () =>
    api.get<FeatureRequest[]>('/admin/feedback/features').then(r => r.data),

  updateBugStatus: (id: string, status: BugReportStatus) =>
    api.patch<BugReport>(`/admin/feedback/bugs/${id}`, { status }).then(r => r.data),

  updateFeatureStatus: (id: string, status: FeatureRequestStatus) =>
    api.patch<FeatureRequest>(`/admin/feedback/features/${id}`, { status }).then(r => r.data),
};
