
import { DesignParams, SimulationResult } from '../types';

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
  const bladeArea = bladeCount * bladeLength * bladeChord;
  const solidity = bladeArea / rotorDiskArea;
  
  // --- Geometric Calculations ---
  // lineAngle is 'Elevation' from ground (0 = horizontal, 90 = vertical).
  // Rotor Axis is aligned with Line.
  // Disk Plane is perpendicular to Rotor Axis.
  // Wind is Horizontal.
  //
  // If Line is Vertical (90), Disk Plane is Horizontal. Wind is parallel to Disk. AoA = 0.
  // If Line is Horizontal (0), Disk Plane is Vertical. Wind is Perpendicular. AoA = 90.
  // Base Alpha = 90 - lineAngle.
  // Rotor Tilt modifies this: Positive tilt tips the disk BACK (increasing AoA).
  
  let effectiveAlphaDeg = (90 - lineAngle) + rotorTilt;
  
  // Clamp geometry for sanity
  if (effectiveAlphaDeg < -90) effectiveAlphaDeg = -90;
  if (effectiveAlphaDeg > 90) effectiveAlphaDeg = 90;

  const alphaRad = effectiveAlphaDeg * (Math.PI / 180);
  const absAlpha = Math.abs(effectiveAlphaDeg);

  // --- Aerodynamic Simulation ---

  // 1. Tip Speed Ratio (TSR) Calculation
  // Real autogyros have a complex relationship between Alpha and TSR.
  // - Alpha ~ 0 deg: No driving force. TSR = 0.
  // - Alpha ~ 10-15 deg: Peak efficiency region (High speed forward flight). TSR is high (~6-10).
  // - Alpha ~ 90 deg: Windmill/Parachute mode. Unloaded rotors spin fast here too.
  // - Negative Alpha: Rotor spins down or reverse (simplified to 0 here).

  let expectedTipSpeedRatio = 0;

  if (effectiveAlphaDeg <= 1.5) {
    // Dead zone / No Inflow
    expectedTipSpeedRatio = 0;
  } else {
    // A simplified curve that peaks around 12 degrees and decays towards 90
    const peakAlpha = 15; 
    const peakTSR = 8.5; // High efficiency rotor in autorotation
    const windmillTSR = 4.0; // High drag windmill state (unloaded)
    
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
  // Heavy rotors take more energy to spin up.
  // Friction heuristic
  const minWindToSpin = (rotorMass * 0.5) + 2; 
  if (windSpeed < minWindToSpin) {
     expectedTipSpeedRatio *= Math.max(0, (windSpeed / minWindToSpin));
  }

  const tipSpeed = windSpeed * expectedTipSpeedRatio;
  const radsPerSecond = tipSpeed / rotorRadius;
  const rpm = (radsPerSecond * 60) / (2 * Math.PI);

  // --- Force Calculation ---
  
  let liftForce = 0; // Blade Element Lift
  let dragForce = 0; // Blade Element Drag
  let totalRotorThrust = 0; // Axial Force along rotor shaft
  let lift = 0; // Global Vertical
  let drag = 0; // Global Horizontal
  let gravity = rotorMass * 9.81;

  if (rpm > 10) {
      // 1. Blade Element Aerodynamics
      // Mean effective velocity at 75% span
      // Inflow velocity component perpendicular to disk
      const v_inflow = windSpeed * Math.sin(alphaRad);
      // Tangential velocity at 75% span
      const v_tangential = tipSpeed * 0.75;
      
      const v_effective = Math.sqrt(Math.pow(v_inflow, 2) + Math.pow(v_tangential, 2));
      
      // Calculate Local Inflow Angle (phi)
      // phi = atan(inflow / tangential)
      const phi = Math.atan2(v_inflow, v_tangential);
      
      // Local Angle of Attack (alpha_local)
      // For a windmill/autogyro (flow from bottom), alpha = phi + pitch (roughly)
      // Actually, standard convention: alpha = pitch - phi (for prop). 
      // For autogyro: alpha = phi - pitch (if pitch is defined relative to plane of rotation).
      // Let's assume params.bladePitch is geometric pitch.
      const effPitchRad = params.bladePitch * (Math.PI / 180);
      const alphaLocal = phi + effPitchRad; // Simplified for flow-through
      
      // Lift Coefficient (Cl)
      // Simple linear model with stall
      let cl = 0.1 + 5.5 * alphaLocal; // Linear slope 2*pi roughly
      if (alphaLocal > 0.25) cl = 1.0; // Soft stall clamp
      if (alphaLocal > 0.4) cl = 0.6; // Deep stall

      liftForce = 0.5 * airDensity * Math.pow(v_effective, 2) * bladeArea * cl;
      
      // Drag (Profile + Induced)
      const cd_profile = 0.015 + 0.05 * Math.pow(cl, 2);
      dragForce = 0.5 * airDensity * Math.pow(v_effective, 2) * bladeArea * cd_profile;
      
      // 2. Bluff Body / Plate Drag
      // At high alphas (near 90), the rotor acts like a porous plate.
      // Standard blade theory underestimates this "Windmill Brake" force.
      const plateDragCoeff = 1.2; // Drag coeff for a flat plate
      // We scale this by how much of the disk is blocked by blades (solidity) and sine of angle
      const bluffBodyDrag = 0.5 * airDensity * Math.pow(windSpeed, 2) * (rotorDiskArea * solidity) * plateDragCoeff * Math.sin(alphaRad);

      // Total Axial Thrust (Force along the line/shaft)
      // BEMT Lift contributes to Thrust. Bluff Drag contributes to Thrust.
      // We blend them or sum them depending on regime.
      // At low alpha, bluff drag is 0. At high alpha, it dominates.
      totalRotorThrust = liftForce + bluffBodyDrag;

      // --- World Frame Resolution ---
      // Re-adjust for World Frame based on Disk Angle (Alpha)
      // Lift_World = Component of Thrust opposing Gravity (Vertical)
      // Drag_World = Component of Thrust along Wind (Horizontal) + Parasitic
      
      // Note: Rotor Thrust vector is Normal to Disk.
      // Vertical Component = Thrust * cos(Alpha)
      // Horizontal Component = Thrust * sin(Alpha)
      
      lift = totalRotorThrust * Math.cos(alphaRad);
      drag = totalRotorThrust * Math.sin(alphaRad) + (dragForce * 0.2); // Add some parasitic blade drag
      
  } else {
      // Stationary Drag (Bluff Body only)
      const stationaryDrag = 0.5 * airDensity * Math.pow(windSpeed, 2) * bladeArea * 1.2 * Math.sin(alphaRad);
      drag = stationaryDrag;
      lift = 0;
      totalRotorThrust = stationaryDrag;
  }

  // Project Thrust onto Kite Line Axis
  // The Rotor Axis is tilted by `rotorTilt` relative to the Line Axis.
  const tiltRad = rotorTilt * (Math.PI / 180);
  // Generated Thrust is the component of Total Rotor Thrust acting ALONG the kite line.
  const generatedThrust = totalRotorThrust * Math.cos(tiltRad);
  
  // Stability
  const stabilityScore = Math.min(100, Math.max(0, 100 - (expectedTipSpeedRatio * 3) - Math.abs(rotorTilt) * 2));

  // Power
  const powerOutput = generatedThrust * windSpeed * 0.3;

  // --- Vector Resolution for System Deformation ---
  // Calculates the 'dogleg' in the line caused by forces on the rotor node.
  
  // 1. Force from Kite (Upper Line) pulling UP and DOWNWIND on the Hub
  // We treat params.lineTension as the force at the kite.
  const kiteAngleRad = params.lineAngle * (Math.PI / 180);
  const f_kite_y = params.lineTension * Math.sin(kiteAngleRad); // Vertical Pull
  const f_kite_x = params.lineTension * Math.cos(kiteAngleRad); // Horizontal Pull (Downwind)

  // 2. Forces from Rotor acting on the Hub
  // Lift is +Y, Gravity is -Y, Drag is +X (Downwind)
  const f_rotor_y = lift - gravity;
  const f_rotor_x = drag;

  // 3. Resultant Force (What the Ground Anchor must resist)
  // The Anchor pulls back/down to balance these.
  // The Tension IN the lower line is the magnitude of this resultant.
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
    }
  };
};
