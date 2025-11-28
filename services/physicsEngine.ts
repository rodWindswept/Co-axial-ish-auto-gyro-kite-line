

import { DesignParams, SimulationResult } from '../types';

// Empirical Data from PCA-2 Autogyro Tests (NASA TM 20080022367, Page 45)
// X: Hub Plane Angle of Attack (Degrees)
// Y: Coefficient (based on Disk Area)
const PCA2_DATA = [
  { alpha: 0,  cl: 0.00, cd: 0.01 }, // Extrapolated start
  { alpha: 5,  cl: 0.15, cd: 0.03 },
  { alpha: 10, cl: 0.30, cd: 0.06 },
  { alpha: 15, cl: 0.45, cd: 0.10 },
  { alpha: 20, cl: 0.60, cd: 0.16 },
  { alpha: 25, cl: 0.75, cd: 0.24 },
  { alpha: 30, cl: 0.85, cd: 0.35 },
  { alpha: 35, cl: 0.92, cd: 0.48 },
  { alpha: 40, cl: 0.95, cd: 0.62 }, // Peak Lift
  { alpha: 45, cl: 0.90, cd: 0.75 },
  { alpha: 50, cl: 0.82, cd: 0.86 }, // Intersection roughly here
  { alpha: 60, cl: 0.65, cd: 0.96 },
  { alpha: 70, cl: 0.45, cd: 1.05 },
  { alpha: 80, cl: 0.25, cd: 1.15 },
  { alpha: 90, cl: 0.00, cd: 1.25 }  // Pure Bluff Body Drag
];

function interpolateCoefficients(alpha: number): { cl: number, cd: number } {
  // Clamp alpha
  const a = Math.max(0, Math.min(90, Math.abs(alpha)));

  // Find segment
  for (let i = 0; i < PCA2_DATA.length - 1; i++) {
    const p1 = PCA2_DATA[i];
    const p2 = PCA2_DATA[i+1];
    
    if (a >= p1.alpha && a <= p2.alpha) {
      const t = (a - p1.alpha) / (p2.alpha - p1.alpha);
      return {
        cl: p1.cl + t * (p2.cl - p1.cl),
        cd: p1.cd + t * (p2.cd - p1.cd)
      };
    }
  }
  return { cl: 0, cd: 0 };
}

/**
 * A simplified Blade Element Momentum Theory (BEMT) approximation 
 * for a kite-mounted autogyro.
 */
export const calculatePhysics = (params: DesignParams): SimulationResult => {
  const {
    bladeLength,
    bladeChord,
    bladePitch,
    windSpeed,
    lineAngle,
    rotorMass,
    rotorTilt = 0
  } = params;

  // Constants
  const airDensity = 1.225; // kg/m^3
  const bladeCount = 2;
  const rotorRadius = bladeLength;
  const rotorDiskArea = Math.PI * Math.pow(rotorRadius, 2);
  // Solidity is mostly for reference in this empirical model, 
  // but could scale the base PCA-2 coeffs if design deviates significantly from standard solidity (~0.05-0.1)
  const bladeArea = bladeCount * bladeLength * bladeChord;
  const solidity = bladeArea / rotorDiskArea; 
  
  // --- Geometric Calculations ---
  // lineAngle is 'Elevation' from ground (0 = horizontal, 90 = vertical).
  // Rotor Axis is aligned with Line.
  // Disk Plane is perpendicular to Rotor Axis.
  // Wind is Horizontal.
  // Base Alpha = 90 - lineAngle.
  // Rotor Tilt modifies this: Positive tilt tips the disk BACK (increasing AoA).
  
  let effectiveAlphaDeg = (90 - lineAngle) + rotorTilt;
  
  // Clamp geometry for sanity
  if (effectiveAlphaDeg < -90) effectiveAlphaDeg = -90;
  if (effectiveAlphaDeg > 90) effectiveAlphaDeg = 90;

  const alphaRad = effectiveAlphaDeg * (Math.PI / 180);

  // --- Aerodynamic Simulation ---

  // 1. Tip Speed Ratio (TSR) Calculation
  let expectedTipSpeedRatio = 0;

  if (effectiveAlphaDeg <= 1.5) {
    // Dead zone / No Inflow
    expectedTipSpeedRatio = 0;
  } else {
    // A simplified curve that peaks around 12 degrees and decays towards 90
    // Based on typical autogyro performance curves (e.g. PCA-2 data trends)
    const peakAlpha = 15; 
    const peakTSR = 8.5; // High efficiency rotor in autorotation
    const windmillTSR = 3.5; // High drag windmill state
    
    if (effectiveAlphaDeg < peakAlpha) {
       // Ramp up from 0 to Peak
       expectedTipSpeedRatio = (effectiveAlphaDeg / peakAlpha) * peakTSR; 
    } else {
       // Decay from Peak to Windmill State
       // At 90 degrees, we are a windmill.
       const t = (effectiveAlphaDeg - peakAlpha) / (90 - peakAlpha);
       expectedTipSpeedRatio = peakTSR * (1 - t) + windmillTSR * t;
    }
  }

  // --- Mass / Inertia Damping ---
  const minWindToSpin = (rotorMass * 0.5) + 1; 
  if (windSpeed < minWindToSpin) {
     expectedTipSpeedRatio *= Math.max(0, (windSpeed / minWindToSpin));
  }

  const tipSpeed = windSpeed * expectedTipSpeedRatio;
  const radsPerSecond = tipSpeed / rotorRadius;
  const rpm = (radsPerSecond * 60) / (2 * Math.PI);

  // --- Force Calculation using PCA-2 Empirical Curves ---
  
  let liftForce = 0; 
  let dragForce = 0; 
  let totalRotorThrust = 0; 
  let lift = 0; 
  let drag = 0; 
  let gravity = rotorMass * 9.81;

  // Variables for Blade Aerodynamics Analysis
  let advVel = 0;
  let retVel = 0;
  let v_inflow = 0;
  let advAoA = 0;
  let retAoA = 0;
  let advanceRatio = 0;
  const kinematicViscosity = 1.48e-5; // Air at 15C
  let reynolds = 0;

  if (rpm > 10) {
      
      // 1. Get Coefficients from Curve
      // The PCA-2 data gives us Global Cl and Cd based on Hub Plane Angle of Attack
      const { cl, cd } = interpolateCoefficients(effectiveAlphaDeg);

      // 2. Calculate Dynamic Pressure
      // Note: Rotor coefficients are typically applied to Disk Area and Free Stream Velocity
      const q = 0.5 * airDensity * Math.pow(windSpeed, 2);

      // 3. Calculate Global Forces (Wind Frame)
      // Lift is perpendicular to wind, Drag is parallel to wind
      lift = cl * q * rotorDiskArea;
      drag = cd * q * rotorDiskArea;

      // 4. Resolve into Rotor Axis Thrust
      // Thrust is the component of the Total Aerodynamic Force aligned with the Rotor Axis
      // Rotor Axis is tilted 'alphaRad' back from vertical (perpendicular to wind)??
      // No, Rotor Axis is tilted 'alphaRad' back from the vertical-to-wind plane.
      // Let's use vector projection.
      // Lift Vector: [0, 1] (Up)
      // Drag Vector: [1, 0] (Downwind)
      // Rotor Axis Vector (tilted back by alpha): [sin(alpha), cos(alpha)]
      
      // Total Thrust = Lift * cos(alpha) + Drag * sin(alpha)
      totalRotorThrust = lift * Math.cos(alphaRad) + drag * Math.sin(alphaRad);

      // --- Detailed Blade Aerodynamics (Advancing vs Retreating) ---
      // This section is kept for the Analysis Tab visualization, using the BEMT logic
      // just to derive local velocities and angles, even though global force comes from PCA-2 curves.
      
      const v_tan_75 = tipSpeed * 0.75;
      v_inflow = windSpeed * Math.sin(alphaRad);

      const v_parallel = windSpeed * Math.cos(alphaRad);
      advanceRatio = v_parallel / tipSpeed;

      // Velocities at 75% Span
      advVel = v_tan_75 + v_parallel;
      retVel = v_tan_75 - v_parallel;

      // Local Angles of Attack
      const effPitchRad = params.bladePitch * (Math.PI / 180);
      const phi_adv = Math.atan2(v_inflow, advVel);
      const phi_ret = Math.atan2(v_inflow, retVel);

      advAoA = (phi_adv + effPitchRad) * (180/Math.PI);
      retAoA = (phi_ret + effPitchRad) * (180/Math.PI);
      
      reynolds = (v_tan_75 * bladeChord) / kinematicViscosity;

  } else {
      // Stationary / Bluff Body
      // Fallback to simple drag plate if not spinning
      const stationaryDrag = 0.5 * airDensity * Math.pow(windSpeed, 2) * bladeArea * 1.2 * Math.sin(alphaRad);
      drag = stationaryDrag;
      lift = 0;
      totalRotorThrust = stationaryDrag;
  }

  // Project Thrust onto Kite Line Axis
  // The Rotor Axis itself is misaligned from the Kite Line by 'rotorTilt'
  // But wait, 'effectiveAlpha' ALREADY includes 'rotorTilt'. 
  // 'totalRotorThrust' is along the Rotor Axis.
  // We want the component along the KITE LINE.
  // The angle between Rotor Axis and Kite Line is simply 'rotorTilt'.
  
  const tiltRad = rotorTilt * (Math.PI / 180);
  const generatedThrust = totalRotorThrust * Math.cos(tiltRad);
  
  // Stability
  const stabilityScore = Math.min(100, Math.max(0, 100 - (expectedTipSpeedRatio * 3) - Math.abs(rotorTilt) * 2));

  // Power
  const powerOutput = generatedThrust * windSpeed * 0.3;

  // --- Vector Resolution for System Deformation ---
  const kiteAngleRad = params.lineAngle * (Math.PI / 180);
  const f_kite_y = params.lineTension * Math.sin(kiteAngleRad); 
  const f_kite_x = params.lineTension * Math.cos(kiteAngleRad); 

  const f_rotor_y = lift - gravity;
  const f_rotor_x = drag;

  const f_anchor_total_x = f_kite_x + f_rotor_x;
  const f_anchor_total_y = f_kite_y + f_rotor_y;

  const anchorTension = Math.sqrt(Math.pow(f_anchor_total_x, 2) + Math.pow(f_anchor_total_y, 2));
  const anchorAngleRad = Math.atan2(f_anchor_total_y, f_anchor_total_x);
  const anchorAngleDeg = anchorAngleRad * (180 / Math.PI);


  return {
    rpm: Math.round(rpm),
    generatedThrust: parseFloat(generatedThrust.toFixed(2)),
    totalRotorThrust: parseFloat(totalRotorThrust.toFixed(2)),
    lift: parseFloat(lift.toFixed(2)),
    drag: parseFloat(drag.toFixed(2)),
    gravity: parseFloat(gravity.toFixed(2)),
    tipSpeed: parseFloat(tipSpeed.toFixed(2)),
    tipSpeedRatio: parseFloat(expectedTipSpeedRatio.toFixed(2)),
    stabilityScore: Math.round(stabilityScore),
    powerOutput: parseFloat(powerOutput.toFixed(2)),
    angleOfAttack: parseFloat(effectiveAlphaDeg.toFixed(1)),
    anchorAnalysis: {
        anchorTension: parseFloat(anchorTension.toFixed(2)),
        anchorAngle: parseFloat(anchorAngleDeg.toFixed(1)),
        lowerLineTensionX: parseFloat(f_anchor_total_x.toFixed(2)),
        lowerLineTensionY: parseFloat(f_anchor_total_y.toFixed(2))
    },
    bladeAerodynamics: {
      advancingVelocity: parseFloat(advVel.toFixed(1)),
      retreatingVelocity: parseFloat(retVel.toFixed(1)),
      inflowVelocity: parseFloat(v_inflow.toFixed(2)),
      advancingAoA: parseFloat(advAoA.toFixed(1)),
      retreatingAoA: parseFloat(retAoA.toFixed(1)),
      advanceRatio: parseFloat(advanceRatio.toFixed(2)),
      reynoldsNumber: Math.round(reynolds)
    }
  };
};
