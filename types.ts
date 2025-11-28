

export interface DesignParams {
  bladeLength: number; // meters
  bladeChord: number; // meters
  bladePitch: number; // degrees
  rotorMass: number; // kg
  lineTension: number; // Newtons (initial)
  lineAngle: number; // degrees relative to ground
  windSpeed: number; // m/s
  hubDiameter: number; // meters (the hole for the line)
  rotorTilt: number; // degrees, misalignment relative to line (spherical bearing control)
}

export interface AnchorAnalysis {
  anchorTension: number;
  anchorAngle: number;
  lowerLineTensionX: number;
  lowerLineTensionY: number;
}

export interface BladeAerodynamics {
  advancingVelocity: number; // m/s at 75% span
  retreatingVelocity: number; // m/s at 75% span
  inflowVelocity: number; // m/s (Vertical component of wind through disk)
  advancingAoA: number; // degrees
  retreatingAoA: number; // degrees
  advanceRatio: number; // mu
  reynoldsNumber: number;
}

export interface SimulationResult {
  rpm: number;
  generatedThrust: number; // Newtons (axial to line - effective tension)
  totalRotorThrust: number; // Newtons (total aerodynamic force along rotor axis)
  lift: number; // Newtons (vertical)
  drag: number; // Newtons (horizontal)
  gravity: number; // Newtons (weight of rotor)
  tipSpeed: number; // m/s
  tipSpeedRatio: number;
  stabilityScore: number; // 0-100
  powerOutput: number; // Watts (theoretical extraction)
  angleOfAttack: number; // degrees (The effective angle between wind and rotor disk)
  anchorAnalysis: AnchorAnalysis;
  bladeAerodynamics: BladeAerodynamics;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export enum Tab {
  DESIGN = 'design',
  ANALYSIS = 'analysis',
  ASSISTANT = 'assistant'
}