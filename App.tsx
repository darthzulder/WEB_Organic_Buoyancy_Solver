import React, { useState } from 'react';
import { Scene } from './components/Scene';
import { ExternalWeight, SolverResult } from './types';
import * as THREE from 'three';
import { Plus, Trash2, Upload, AlertCircle, Ruler, Edit3, Box, Rotate3d } from 'lucide-react';

// Default Densities
const DEFAULT_MATERIAL_DENSITY = 200; // Light wood/foam approx (kg/m3)
const DEFAULT_WATER_DENSITY = 1025; // Seawater (kg/m3)

// Scale Options
const SCALE_OPTIONS = [
  { label: 'Meters (1:1)', value: 1.0 },
  { label: 'Millimeters (mm)', value: 0.001 },
  { label: 'Centimeters (cm)', value: 0.01 },
  { label: 'Inches (in)', value: 0.0254 },
  { label: 'Feet (ft)', value: 0.3048 },
];

function App() {
  const [stlFile, setStlFile] = useState<File | null>(null);
  const [importScale, setImportScale] = useState<number>(1.0);
  
  const [baseDensity, setBaseDensity] = useState(DEFAULT_MATERIAL_DENSITY);
  const [waterDensity, setWaterDensity] = useState(DEFAULT_WATER_DENSITY);
  const [weights, setWeights] = useState<ExternalWeight[]>([]);
  const [stats, setStats] = useState<SolverResult | null>(null);

  // Selection & Editing State
  const [selectedWeightId, setSelectedWeightId] = useState<string | null>(null);

  // Form State (Used for both New and Edit)
  const [formMass, setFormMass] = useState(100);
  
  // Position
  const [formX, setFormX] = useState(0);
  const [formY, setFormY] = useState(0);
  const [formZ, setFormZ] = useState(1); // Default slightly up

  // Rotation (Degrees for UI)
  const [formRotX, setFormRotX] = useState(0);
  const [formRotY, setFormRotY] = useState(0);
  const [formRotZ, setFormRotZ] = useState(0);

  const [formWeightFile, setFormWeightFile] = useState<File | null>(null);
  const [formWeightScale, setFormWeightScale] = useState(1.0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStlFile(e.target.files[0]);
      setStats(null); // Clear previous stats
    }
  };

  // Select a weight to edit
  const selectWeight = (id: string) => {
    const w = weights.find(item => item.id === id);
    if (w) {
      setSelectedWeightId(id);
      setFormMass(w.mass);
      setFormX(w.position.x);
      setFormY(w.position.y);
      setFormZ(w.position.z);
      
      // Convert stored Radians to Degrees for UI
      const rX = w.rotation ? THREE.MathUtils.radToDeg(w.rotation.x) : 0;
      const rY = w.rotation ? THREE.MathUtils.radToDeg(w.rotation.y) : 0;
      const rZ = w.rotation ? THREE.MathUtils.radToDeg(w.rotation.z) : 0;
      setFormRotX(rX);
      setFormRotY(rY);
      setFormRotZ(rZ);

      setFormWeightScale(w.scale || 1.0);
      setFormWeightFile(null); // Can't easily restore file object
    }
  };

  // Deselect to go back to "Add New" mode
  const deselectWeight = () => {
    setSelectedWeightId(null);
    // Reset to defaults
    setFormMass(100);
    setFormX(0);
    setFormY(0);
    setFormZ(1);
    setFormRotX(0);
    setFormRotY(0);
    setFormRotZ(0);
    setFormWeightFile(null);
    setFormWeightScale(1.0);
  };

  const handleInputChange = (field: 'mass' | 'x' | 'y' | 'z' | 'scale' | 'rotX' | 'rotY' | 'rotZ', value: number) => {
    // 1. Update Form UI
    if (field === 'mass') setFormMass(value);
    if (field === 'x') setFormX(value);
    if (field === 'y') setFormY(value);
    if (field === 'z') setFormZ(value);
    if (field === 'scale') setFormWeightScale(value);
    if (field === 'rotX') setFormRotX(value);
    if (field === 'rotY') setFormRotY(value);
    if (field === 'rotZ') setFormRotZ(value);

    // 2. If in Edit Mode, update the actual weight object immediately
    if (selectedWeightId) {
      setWeights(prevWeights => prevWeights.map(w => {
        if (w.id === selectedWeightId) {
          const newPos = w.position.clone();
          if (field === 'x') newPos.x = value;
          if (field === 'y') newPos.y = value;
          if (field === 'z') newPos.z = value;
          
          // Rotation logic: Convert current form state (plus the changed field) to Vector3 (Radians)
          const currentRotX = field === 'rotX' ? value : formRotX;
          const currentRotY = field === 'rotY' ? value : formRotY;
          const currentRotZ = field === 'rotZ' ? value : formRotZ;

          const newRot = new THREE.Vector3(
            THREE.MathUtils.degToRad(currentRotX),
            THREE.MathUtils.degToRad(currentRotY),
            THREE.MathUtils.degToRad(currentRotZ)
          );

          return {
            ...w,
            mass: field === 'mass' ? value : w.mass,
            scale: field === 'scale' ? value : w.scale,
            position: newPos,
            rotation: newRot
          };
        }
        return w;
      }));
    }
  };

  const handleWeightFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setFormWeightFile(file);

        // Immediate update if editing
        if (selectedWeightId) {
            const url = URL.createObjectURL(file);
            setWeights(prevWeights => prevWeights.map(w => {
                if (w.id === selectedWeightId) {
                    // Revoke old URL to avoid leaks
                    if (w.stlUrl) URL.revokeObjectURL(w.stlUrl);
                    return { ...w, stlUrl: url };
                }
                return w;
            }));
        }
    }
  };

  const addWeight = () => {
    let url = null;
    if (formWeightFile) {
        url = URL.createObjectURL(formWeightFile);
    }

    const newWeight: ExternalWeight = {
      id: crypto.randomUUID(),
      mass: formMass,
      position: new THREE.Vector3(formX, formY, formZ),
      rotation: new THREE.Vector3(
          THREE.MathUtils.degToRad(formRotX),
          THREE.MathUtils.degToRad(formRotY),
          THREE.MathUtils.degToRad(formRotZ)
      ),
      color: '#ef4444', // Red
      stlUrl: url,
      scale: formWeightScale
    };
    setWeights([...weights, newWeight]);
    
    // Reset form but keep selection on the new item for fine tuning
    setFormWeightFile(null);
    selectWeight(newWeight.id);
  };

  const removeWeight = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection when clicking delete
    
    // Cleanup URL
    const w = weights.find(item => item.id === id);
    if (w?.stlUrl) URL.revokeObjectURL(w.stlUrl);

    setWeights(weights.filter(w => w.id !== id));
    if (selectedWeightId === id) {
      deselectWeight();
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden font-sans">
      {/* Sidebar Controls */}
      <div className="w-96 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col h-full overflow-y-auto z-10 shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white mb-2">Organic Buoyancy Solver</h1>
          <p className="text-slate-400 text-xs">Real-time hydrostatic equilibrium solver for arbitrary 3D meshes.</p>
        </div>

        {/* 1. Model & Density */}
        <div className="p-6 border-b border-slate-700 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">1. Configuration</h2>
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Import STL Mesh</label>
            <div className="flex flex-col gap-2">
               <div className="flex items-center gap-2">
                 <label className="flex-1 cursor-pointer bg-slate-700 hover:bg-slate-600 transition p-2 rounded text-sm text-center border border-slate-600">
                    <span className="flex items-center justify-center gap-2 text-white">
                      <Upload size={14} /> {stlFile ? stlFile.name : "Select .stl file"}
                    </span>
                    <input 
                      type="file" 
                      accept=".stl" 
                      className="hidden" 
                      onChange={handleFileChange}
                      value="" 
                    />
                 </label>
                 {stlFile && (
                   <button onClick={() => { setStlFile(null); setStats(null); }} className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                      <Trash2 size={14} />
                   </button>
                 )}
               </div>
               
               {/* Scale Selector */}
               <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                  <Ruler size={14} className="text-slate-500" />
                  <select 
                    value={importScale} 
                    onChange={(e) => setImportScale(Number(e.target.value))}
                    className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                  >
                    {SCALE_OPTIONS.map(opt => (
                      <option key={opt.label} value={opt.value} className="bg-slate-800">
                        Source: {opt.label}
                      </option>
                    ))}
                  </select>
               </div>
            </div>
            {!stlFile && <p className="text-[10px] text-slate-500 mt-1">Using default Torus Knot if no file selected.</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Material Density (kg/m³)</label>
              <input 
                type="number" 
                value={baseDensity} 
                onChange={(e) => setBaseDensity(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Water Density (kg/m³)</label>
              <input 
                type="number" 
                value={waterDensity} 
                onChange={(e) => setWaterDensity(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 2. External Weights */}
        <div className="p-6 border-b border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">2. External Loads</h2>
            {selectedWeightId && (
              <button 
                onClick={deselectWeight}
                className="text-[10px] flex items-center gap-1 text-blue-400 hover:text-blue-300"
              >
                <Plus size={10} /> New
              </button>
            )}
          </div>
          
          <div className={`p-3 rounded border transition-colors ${selectedWeightId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-700/50'}`}>
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {selectedWeightId ? 'Editing Weight' : 'New Weight'}
                </span>
                {selectedWeightId && <Edit3 size={12} className="text-blue-400" />}
             </div>

             {/* Mesh Upload for Weight */}
             <div className="mb-3 p-2 bg-slate-800 rounded border border-slate-700">
                <label className="block text-[10px] font-medium text-slate-400 mb-1">Custom Mesh (Optional)</label>
                <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] py-1 rounded border border-slate-600">
                        <Upload size={10} />
                        {formWeightFile ? formWeightFile.name : (selectedWeightId && weights.find(w => w.id === selectedWeightId)?.stlUrl ? "Replace Mesh" : "Load STL")}
                        <input type="file" accept=".stl" className="hidden" onChange={handleWeightFileChange} value="" />
                    </label>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">Scale:</span>
                        <input 
                            type="number"
                            step={0.1}
                            value={formWeightScale}
                            onChange={(e) => handleInputChange('scale', Number(e.target.value))}
                            className="w-16 bg-slate-700 text-[10px] text-white rounded border border-slate-600 px-1 py-1 focus:outline-none"
                        />
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                   <label className="text-[10px] text-slate-500">Mass (kg)</label>
                   <input 
                      type="number" 
                      value={formMass} 
                      onChange={e => handleInputChange('mass', Number(e.target.value))} 
                      className="w-full bg-slate-800 text-xs p-1 rounded border border-slate-700 focus:border-blue-500 focus:outline-none" 
                   />
                </div>
             </div>
             
             {/* Position Inputs */}
             <div className="mb-2">
                 <label className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                     <Box size={10} /> Position (x, y, z)
                 </label>
                 <div className="grid grid-cols-3 gap-2">
                    <input 
                       type="number" 
                       value={formX} 
                       step={0.1} 
                       onChange={e => handleInputChange('x', Number(e.target.value))} 
                       className="w-full bg-slate-800 text-xs p-1 rounded border border-slate-700 focus:border-blue-500 focus:outline-none" 
                       placeholder="X"
                    />
                    <input 
                       type="number" 
                       value={formY} 
                       step={0.1} 
                       onChange={e => handleInputChange('y', Number(e.target.value))} 
                       className="w-full bg-slate-800 text-xs p-1 rounded border border-slate-700 focus:border-blue-500 focus:outline-none" 
                       placeholder="Y"
                    />
                    <input 
                       type="number" 
                       value={formZ} 
                       step={0.1} 
                       onChange={e => handleInputChange('z', Number(e.target.value))} 
                       className="w-full bg-slate-800 text-xs p-1 rounded border border-slate-700 focus:border-blue-500 focus:outline-none" 
                       placeholder="Z"
                    />
                 </div>
             </div>

             {/* Rotation Inputs */}
             <div className="mb-3">
                 <label className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                     <Rotate3d size={10} /> Rotation (deg)
                 </label>
                 <div className="grid grid-cols-3 gap-2">
                    <input 
                       type="number" 
                       value={formRotX} 
                       step={15} 
                       onChange={e => handleInputChange('rotX', Number(e.target.value))} 
                       className="w-full bg-slate-800 text-xs p-1 rounded border border-slate-700 focus:border-blue-500 focus:outline-none" 
                       placeholder="X°"
                    />
                    <input 
                       type="number" 
                       value={formRotY} 
                       step={15} 
                       onChange={e => handleInputChange('rotY', Number(e.target.value))} 
                       className="w-full bg-slate-800 text-xs p-1 rounded border border-slate-700 focus:border-blue-500 focus:outline-none" 
                       placeholder="Y°"
                    />
                    <input 
                       type="number" 
                       value={formRotZ} 
                       step={15} 
                       onChange={e => handleInputChange('rotZ', Number(e.target.value))} 
                       className="w-full bg-slate-800 text-xs p-1 rounded border border-slate-700 focus:border-blue-500 focus:outline-none" 
                       placeholder="Z°"
                    />
                 </div>
             </div>
             
             {!selectedWeightId && (
               <button onClick={addWeight} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-xs font-semibold transition">
                  <Plus size={14} /> Add Weight
               </button>
             )}
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
             {weights.length === 0 && <p className="text-xs text-slate-500 italic">No external weights added.</p>}
             {weights.map(w => (
               <div 
                  key={w.id} 
                  onClick={() => selectWeight(w.id)}
                  className={`flex items-center justify-between p-2 rounded text-xs border cursor-pointer transition-all ${
                    selectedWeightId === w.id 
                    ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/50' 
                    : 'bg-slate-700/50 border-slate-700 hover:bg-slate-700'
                  }`}
               >
                  <div className="flex items-center gap-2">
                    {w.stlUrl ? <Box size={12} className="text-blue-400" /> : <div className="w-2 h-2 rounded-sm bg-red-400"></div>}
                    <div>
                        <span className={`font-bold ${selectedWeightId === w.id ? 'text-blue-200' : 'text-slate-300'}`}>{w.mass}kg</span>
                        <span className="text-slate-500 ml-2">@{`[${w.position.x.toFixed(1)}, ${w.position.y.toFixed(1)}, ${w.position.z.toFixed(1)}]`}</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => removeWeight(w.id, e)} 
                    className="text-slate-400 hover:text-red-400 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
               </div>
             ))}
          </div>
        </div>

        {/* 3. Live Stats */}
        <div className="p-6 flex-1">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">3. Solver Status</h2>
          
          {stats ? (
             <div className="space-y-3">
               <div className="bg-slate-900 p-3 rounded border border-slate-700">
                 <div className="text-xs text-slate-500 mb-1">Net Forces</div>
                 <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[10px] uppercase text-slate-500">Weight</div>
                        <div className="text-red-400 font-mono">{(stats.totalMass * 9.81 / 1000).toFixed(2)} kN</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase text-slate-500">Buoyancy</div>
                        <div className="text-blue-400 font-mono">{(stats.submergedVolume * waterDensity * 9.81 / 1000).toFixed(2)} kN</div>
                    </div>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                     <div className="text-[10px] uppercase text-slate-500">Draft (Z)</div>
                     <div className="font-mono text-white">{-stats.displacement.toFixed(3)} m</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                     <div className="text-[10px] uppercase text-slate-500">Heel (Roll)</div>
                     <div className="font-mono text-white">{(stats.rotationY * 180 / Math.PI).toFixed(1)}°</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                     <div className="text-[10px] uppercase text-slate-500">Trim (Pitch)</div>
                     <div className="font-mono text-white">{(stats.rotationX * 180 / Math.PI).toFixed(1)}°</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                     <div className="text-[10px] uppercase text-slate-500">Submerged Vol</div>
                     <div className="font-mono text-white">{stats.submergedVolume.toFixed(2)} m³</div>
                  </div>
               </div>
               
               {Math.abs(stats.submergedVolume * waterDensity - stats.totalMass) > stats.totalMass * 0.1 && (
                 <div className="flex items-start gap-2 text-yellow-500 text-xs bg-yellow-500/10 p-2 rounded">
                    <AlertCircle size={14} className="mt-0.5" />
                    <span>Unstable / Sinking. Check mass vs density.</span>
                 </div>
               )}
             </div>
          ) : (
             <div className="text-slate-500 text-xs animate-pulse">Initializing physics engine...</div>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 h-full relative bg-black">
        <Scene 
          stlFile={stlFile}
          importScale={importScale}
          weights={weights}
          baseDensity={baseDensity}
          waterDensity={waterDensity}
          onStatsUpdate={setStats}
          selectedWeightId={selectedWeightId}
        />
      </div>
    </div>
  );
}

export default App;