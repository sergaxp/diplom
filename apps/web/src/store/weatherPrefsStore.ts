import { create } from 'zustand';

export type TempUnit = 'c' | 'f';
export type WindUnit = 'kmh' | 'ms';
export type PressureUnit = 'hpa' | 'mmhg';

// Критерии (метрики), которые можно показать/скрыть в карточке дня.
export type WeatherMetric = 'precip' | 'wind' | 'gusts' | 'humidity' | 'pressure' | 'uv' | 'sun';

export const WEATHER_METRIC_LABELS: Record<WeatherMetric, string> = {
  precip: 'Осадки',
  wind: 'Ветер',
  gusts: 'Порывы ветра',
  humidity: 'Влажность',
  pressure: 'Давление',
  uv: 'УФ-индекс',
  sun: 'Восход / закат',
};

export interface WeatherUnits {
  temp: TempUnit;
  wind: WindUnit;
  pressure: PressureUnit;
}

export interface WeatherPrefs {
  units: WeatherUnits;
  metrics: Record<WeatherMetric, boolean>;
}

const DEFAULTS: WeatherPrefs = {
  units: { temp: 'c', wind: 'kmh', pressure: 'hpa' },
  // По умолчанию компактный набор — чтобы модалка на телефоне влезала без скролла.
  metrics: { precip: true, wind: true, gusts: false, humidity: true, pressure: false, uv: true, sun: true },
};

const KEY = 'weatherPrefs';

// localStorage трогаем только на клиенте (в init/мутациях), не в инициализаторе
// стора — иначе SSR упадёт (как сделано в themeStore).
function load(): WeatherPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<WeatherPrefs>;
    return {
      units: { ...DEFAULTS.units, ...p.units },
      metrics: { ...DEFAULTS.metrics, ...p.metrics },
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(prefs: WeatherPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* приватный режим и т.п. */ }
}

interface State extends WeatherPrefs {
  init: () => void;
  setUnit: <K extends keyof WeatherUnits>(key: K, value: WeatherUnits[K]) => void;
  toggleMetric: (m: WeatherMetric) => void;
}

export const useWeatherPrefs = create<State>((set, get) => ({
  ...DEFAULTS,
  init() {
    set(load());
  },
  setUnit(key, value) {
    const units = { ...get().units, [key]: value };
    set({ units });
    persist({ units, metrics: get().metrics });
  },
  toggleMetric(m) {
    const metrics = { ...get().metrics, [m]: !get().metrics[m] };
    set({ metrics });
    persist({ units: get().units, metrics });
  },
}));
