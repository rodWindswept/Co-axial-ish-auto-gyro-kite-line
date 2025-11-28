

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

  // --- Force Calculation ---
  
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
      // 1. Blade Element Aerodynamics
      
      // Velocity Integration Correction (Based on PCA-2 feedback):
      // V_squared_mean = (V_tip^2) / 3
      const v_tangential_sq_mean = (Math.pow(tipSpeed, 2)) / 3;
      
      // Inflow component 
      v_inflow = windSpeed * Math.sin(alphaRad);
      
      // Effective dynamic pressure acting on the blade area
      const dynamicPressure = 0.5 * airDensity * (v_tangential_sq_mean + Math.pow(v_inflow, 2));

      // Calculate Local Inflow Angle (phi) at 75% span for Angle of Attack check
      const v_tan_75 = tipSpeed * 0.75;
      const phi = Math.atan2(v_inflow, v_tan_75);
      
      // Local Angle of Attack (Mean)
      const effPitchRad = params.bladePitch * (Math.PI / 180);
      const alphaLocal = phi + effPitchRad; 
      
      // Lift Coefficient (Cl)
      // Finite wing correction (Aspect Ratio effects reduce slope)
      let cl = 5.5 * alphaLocal;

      // Stall characteristics
      if (alphaLocal > 0.22) cl = 1.0; // Soft stall around 12 deg
      if (alphaLocal > 0.35) cl = 0.8; // Deep stall drop off

      // Calculate Lift (Perpendicular to Blade Motion -> Axial Thrust)
      liftForce = dynamicPressure * bladeArea * cl;
      
      // Drag (Profile + Induced)
      const cd_profile = 0.012 + 0.05 * Math.pow(cl, 2);
      dragForce = dynamicPressure * bladeArea * cd_profile;
      
      // 2. Regime Blending / Thrust Calculation
      totalRotorThrust = liftForce * Math.cos(phi) + dragForce * Math.sin(phi);

      // --- Upper Bound Clamp (PCA-2 max Ct) ---
      const q_disk = 0.5 * airDensity * Math.pow(windSpeed, 2);
      const maxCt = 1.3; 
      const maxThrust = q_disk * rotorDiskArea * maxCt;
      
      if (totalRotorThrust > maxThrust) {
          totalRotorThrust = maxThrust;
      }

      // --- World Frame Resolution ---
      lift = totalRotorThrust * Math.cos(alphaRad);
      drag = totalRotorThrust * Math.sin(alphaRad) + (dragForce * 0.5); 
      
      // --- Detailed Blade Aerodynamics (Advancing vs Retreating) ---
      // Advance Ratio (mu) = Forward Speed parallel to disk / Tip Speed
      const v_parallel = windSpeed * Math.cos(alphaRad);
      advanceRatio = v_parallel / tipSpeed;

      // Velocities at 75% Span
      // Advancing: TipSpeed*0.75 + Parallel Wind Component
      // Retreating: TipSpeed*0.75 - Parallel Wind Component
      advVel = v_tan_75 + v_parallel;
      retVel = v_tan_75 - v_parallel;

      // Local Angles of Attack
      // Phi = atan(Inflow / Tangential)
      const phi_adv = Math.atan2(v_inflow, advVel);
      const phi_ret = Math.atan2(v_inflow, retVel);

      advAoA = (phi_adv + effPitchRad) * (180/Math.PI);
      retAoA = (phi_ret + effPitchRad) * (180/Math.PI);
      
      // Reynolds Number at 75% span (Mean)
      reynolds = (v_tan_75 * bladeChord) / kinematicViscosity;

  } else {
      // Stationary / Bluff Body
      const stationaryDrag = 0.5 * airDensity * Math.pow(windSpeed, 2) * bladeArea * 1.2 * Math.sin(alphaRad);
      drag = stationaryDrag;
      lift = 0;
      totalRotorThrust = stationaryDrag;
  }

  // Project Thrust onto Kite Line Axis
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