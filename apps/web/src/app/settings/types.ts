export type TabId = 'profile' | 'account' | 'manager' | 'appearance' | 'tags';

export interface ProfileForm {
  displayName: string;
  username:    string;
  bio:         string;
}

export interface ManagerForm {
  location:         string;
  locationLat:      number | null;
  locationLon:      number | null;
  showGlobalEvents: boolean;
  showHolidays:     boolean;
}
