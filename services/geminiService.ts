import { GoogleGenAI } from "@google/genai";
import { DesignParams, SimulationResult } from '../types';

let genAI: GoogleGenAI | null = null;

try {
  if (process.env.API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI", e);
}

const SYSTEM_INSTRUCTION = `
You are a senior Aerospace Engineer specializing in rotary-wing aerodynamics, specifically autogyros and gyro-kites.
The user is designing a 2-bladed, teetering autogyro rotor that mounts coaxially on a tensioned kite line.
Your goal is to assist them in optimizing the design for stability and thrust generation (adding tension to the line).

Key Physics Concepts to Apply:
1. **Autorotation:** Explain how the wind passing through the rotor disc drives rotation.
2. **Teetering Hinge:** Explain how this manages asymmetry of lift (advancing vs retreating blade) to prevent roll moments on the line.
3. **Coaxial Mounting:** Discuss friction, bearings, and how the rotor must spin freely around the static line.
4. **Safety:** Mention blade strikes, material stress, and line abrasion.

Context provided in prompts will include current design parameters (blade length, chord, pitch, etc.) and simulation results.
Keep answers concise, technical but accessible, and practical.
`;

export const sendMessageToGemini = async (
  message: string,
  context: { params: DesignParams; results: SimulationResult },
  history: { role: string; text: string }[] = []
): Promise<string> => {
  if (!genAI) {
    return "API Key not configured. Please check your environment variables.";
  }

  const contextString = `
    Current Design Configuration:
    - Blade Length: ${context.params.bladeLength} m
    - Blade Chord: ${context.params.bladeChord} m
    - Pitch: ${context.params.bladePitch} deg
    - Line Angle: ${context.params.lineAngle} deg
    - Wind Speed: ${context.params.windSpeed} m/s
    
    Simulation Results:
    - RPM: ${context.results.rpm}
    - Generated Tension (Thrust): ${context.results.generatedThrust} N
    - Stability Score: ${context.results.stabilityScore}/100
  `;

  try {
    const model = genAI.models;
    
    // Construct the conversation history for context, but we will just send a single prompt with context for simplicity in this stateless wrapper
    // or use chat session. Here we interpret the request to just answer the specific question with the context.
    
    const prompt = `
      ${contextString}

      User Question: ${message}
    `;

    const result = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return result.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Error: ${error.message || "Something went wrong with the AI service."}`;
  }
};
