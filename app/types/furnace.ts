export type ModelKey = 'svm' | 'iforest' | 'ae'

export interface ModelOption {
  key: ModelKey
  label: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  { key: 'svm', label: 'One-Class SVM' },
  { key: 'iforest', label: 'Isolation Forest' },
  { key: 'ae', label: 'Autoencoder' }
]

export type Phase = 'HEATING' | 'HOLD' | 'COOLING'

export interface PhaseOption {
  key: Phase
  label: string
}

export const PHASE_OPTIONS: PhaseOption[] = [
  { key: 'HEATING', label: 'Heating' },
  { key: 'HOLD', label: 'Hold' },
  { key: 'COOLING', label: 'Cooling' }
]

export type Zone = 1 | 2 | 3 | 4 | 5 | 6

export interface ZoneOption {
  key: Zone
  label: string
}

export const ZONE_OPTIONS: ZoneOption[] = [1, 2, 3, 4, 5, 6].map(zone => ({
  key: zone as Zone,
  label: `Zone ${zone}`
}))

export interface SignalDef {
  /** Column key as it appears in the uploaded CSV header. */
  key: string
  /** Human readable label shown in the signal selector and chart legend. */
  label: string
}

/**
 * Per-zone signal template, mirroring the column naming convention used by
 * the IBA export / STO_ML_Project data pipeline (`zone {n} <signal>`).
 */
const ZONE_SIGNAL_TEMPLATES: { suffix: string, label: string }[] = [
  { suffix: 'heating controller setpoint', label: 'Heating controller setpoint' },
  { suffix: 'heating controller process value', label: 'Heating controller process value' },
  { suffix: 'heating controller controller manipulated variable', label: 'Heating controller manipulated variable' },
  { suffix: 'temperature detection wind ahead of charge SP', label: 'Temp. detection wind ahead of charge SP' },
  { suffix: 'temperature detection wind ahead of charge PV', label: 'Temp. detection wind ahead of charge PV' },
  { suffix: 'temperature detection wind beyond of charge SP', label: 'Temp. detection wind beyond of charge SP' },
  { suffix: 'temperature detection wind beyond charge', label: 'Temp. detection wind beyond charge' },
  { suffix: 'control error temperature wind ahead of charge', label: 'Control error temp. wind ahead of charge' },
  { suffix: 'control error temperature wind beyond of charge', label: 'Control error temp. wind beyond of charge' },
  { suffix: 'combustion air controller setpoint', label: 'Combustion air controller setpoint' },
  { suffix: 'combustion air controller process value', label: 'Combustion air controller process value' },
  { suffix: 'combustion air controller controller manipulated variable', label: 'Combustion air controller manipulated variable' },
  { suffix: 'combustion air control flow metering', label: 'Combustion air control flow metering' },
  { suffix: 'fuel gas controller setpoint', label: 'Fuel gas controller setpoint' },
  { suffix: 'fuel gas controller process value', label: 'Fuel gas controller process value' },
  { suffix: 'fuel gas controller controller manipulated variable', label: 'Fuel gas controller manipulated variable' },
  { suffix: 'fuel gas control flow metering', label: 'Fuel gas control flow metering' },
  { suffix: 'combustion air/ fuel gas ratio', label: 'Combustion air / fuel gas ratio' }
]

export function getZoneSignals(zone: Zone): SignalDef[] {
  return ZONE_SIGNAL_TEMPLATES.map(({ suffix, label }) => ({
    key: `zone ${zone} ${suffix}`,
    label
  }))
}
