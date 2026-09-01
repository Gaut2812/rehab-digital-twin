import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  Play, Pause, RotateCcw, Eye, Layers, Activity, 
  Maximize2, Compass, ShieldAlert, Sparkles 
} from 'lucide-react';

export default function DigitalTwin3D({ 
  jointAngles = {}, 
  frameData = [], 
  currentFrame = 0, 
  onSeek = null, 
  isPlaying = false, 
  onTogglePlay = null,
  title = "Musculoskeletal Digital Twin (3D Avatar)",
  subtitle = "Real-time Kinematic & Strain Simulation"
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const jointMeshesRef = useRef({});
  const boneMeshesRef = useRef([]);
  const animFrameIdRef = useRef(null);

  const [cameraView, setCameraView] = useState('isometric');
  const [showMuscles, setShowMuscles] = useState(true);
  const [showAnglesHUD, setShowAnglesHUD] = useState(true);
  const [activeJoint, setActiveJoint] = useState(null);

  // Extract real or default angles
  const lKnee = jointAngles.left_knee_angle ?? 170;
  const rKnee = jointAngles.right_knee_angle ?? 170;
  const lHip = jointAngles.left_hip_angle ?? 170;
  const rHip = jointAngles.right_hip_angle ?? 170;
  const symmetryPct = jointAngles.symmetry_pct ?? (100 - Math.abs(lKnee - rKnee));

  // Determine strain color based on knee flexion
  const getJointColor = (angleDeg) => {
    if (angleDeg < 80) return 0xf43f5e; // Deep / heavy strain
    if (angleDeg <= 125) return 0x10b981; // Optimal rehab flexion zone
    if (angleDeg <= 150) return 0x06b6d4; // Moderate descent
    return 0x3b82f6; // Standing / extended
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.04);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.2, 4.2);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x06b6d4, 1.8);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x8b5cf6, 1.2);
    backLight.position.set(-3, 3, -3);
    scene.add(backLight);

    // Circular Bio-Grid Floor
    const gridHelper = new THREE.GridHelper(10, 20, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // Avatar Root Group
    const avatarGroup = new THREE.Group();
    avatarGroup.position.y = -0.3;
    scene.add(avatarGroup);

    // Materials
    const jointGeo = new THREE.SphereGeometry(0.065, 24, 24);
    const headGeo = new THREE.SphereGeometry(0.16, 24, 24);

    const jointList = [
      'head', 'neck', 'spine', 'pelvis',
      'left_shoulder', 'left_elbow', 'left_wrist',
      'right_shoulder', 'right_elbow', 'right_wrist',
      'left_hip', 'left_knee', 'left_ankle', 'left_foot',
      'right_hip', 'right_knee', 'right_ankle', 'right_foot'
    ];

    jointList.forEach(name => {
      const isHead = name === 'head';
      const isKnee = name.includes('knee');
      const mat = new THREE.MeshStandardMaterial({
        color: isKnee ? 0x10b981 : 0x06b6d4,
        roughness: 0.2,
        metalness: 0.7,
        emissive: isKnee ? 0x10b981 : 0x06b6d4,
        emissiveIntensity: 0.4
      });
      const mesh = new THREE.Mesh(isHead ? headGeo : jointGeo, mat);
      mesh.castShadow = true;
      mesh.name = name;
      avatarGroup.add(mesh);
      jointMeshesRef.current[name] = mesh;
    });

    // Bone definition pairs
    const bonePairs = [
      ['head', 'neck'],
      ['neck', 'spine'],
      ['spine', 'pelvis'],
      ['neck', 'left_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['neck', 'right_shoulder'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['pelvis', 'left_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['left_ankle', 'left_foot'],
      ['pelvis', 'right_hip'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
      ['right_ankle', 'right_foot']
    ];

    const boneMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.95
    });

    const bones = bonePairs.map(([start, end]) => {
      const geom = new THREE.CylinderGeometry(0.028, 0.028, 1, 16);
      const mesh = new THREE.Mesh(geom, boneMaterial);
      avatarGroup.add(mesh);
      return { mesh, start, end };
    });
    boneMeshesRef.current = bones;

    // Mouse rotation interaction
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      avatarGroup.rotation.y += deltaX * 0.008;
      camera.position.y = Math.max(-0.5, Math.min(3, camera.position.y + deltaY * 0.006));

      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => { isDragging = false; };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update 3D skeleton pose whenever joint angles change
  useEffect(() => {
    const joints = jointMeshesRef.current;
    const bones = boneMeshesRef.current;
    if (!joints.head || !bones.length) return;

    // Kinematic model: compute 3D coordinates based on left and right knee/hip flexion
    const lKneeRad = THREE.MathUtils.degToRad(180 - lKnee);
    const rKneeRad = THREE.MathUtils.degToRad(180 - rKnee);
    const lHipRad = THREE.MathUtils.degToRad(180 - lHip);
    const rHipRad = THREE.MathUtils.degToRad(180 - rHip);

    // Height offset during squat (pelvis lowers)
    const squatDepth = (Math.sin(lKneeRad * 0.5) + Math.sin(rKneeRad * 0.5)) * 0.5 * 0.35;
    const pelvisY = 0.1 - squatDepth;

    // Positions in 3D
    const pos = {
      head: new THREE.Vector3(0, pelvisY + 1.25, 0),
      neck: new THREE.Vector3(0, pelvisY + 0.95, 0),
      spine: new THREE.Vector3(0, pelvisY + 0.5, -0.02 * (squatDepth / 0.35)),
      pelvis: new THREE.Vector3(0, pelvisY, 0),

      left_shoulder: new THREE.Vector3(-0.32, pelvisY + 0.92, 0),
      left_elbow: new THREE.Vector3(-0.42, pelvisY + 0.55, 0.15),
      left_wrist: new THREE.Vector3(-0.35, pelvisY + 0.3, 0.3),

      right_shoulder: new THREE.Vector3(0.32, pelvisY + 0.92, 0),
      right_elbow: new THREE.Vector3(0.42, pelvisY + 0.55, 0.15),
      right_wrist: new THREE.Vector3(0.35, pelvisY + 0.3, 0.3),

      left_hip: new THREE.Vector3(-0.18, pelvisY, 0),
      left_knee: new THREE.Vector3(
        -0.18, 
        pelvisY - 0.45 * Math.cos(lHipRad * 0.5), 
        0.45 * Math.sin(lHipRad * 0.6)
      ),
      left_ankle: new THREE.Vector3(
        -0.18, 
        -0.95, 
        0.05
      ),
      left_foot: new THREE.Vector3(-0.18, -1.02, 0.2),

      right_hip: new THREE.Vector3(0.18, pelvisY, 0),
      right_knee: new THREE.Vector3(
        0.18, 
        pelvisY - 0.45 * Math.cos(rHipRad * 0.5), 
        0.45 * Math.sin(rHipRad * 0.6)
      ),
      right_ankle: new THREE.Vector3(
        0.18, 
        -0.95, 
        0.05
      ),
      right_foot: new THREE.Vector3(0.18, -1.02, 0.2),
    };

    // Update joint spheres
    Object.entries(pos).forEach(([name, p]) => {
      if (joints[name]) {
        joints[name].position.copy(p);
      }
    });

    // Update Knee Colors based on strain / target
    const lColor = getJointColor(lKnee);
    const rColor = getJointColor(rKnee);

    if (joints.left_knee) {
      joints.left_knee.material.color.setHex(lColor);
      joints.left_knee.material.emissive.setHex(lColor);
    }
    if (joints.right_knee) {
      joints.right_knee.material.color.setHex(rColor);
      joints.right_knee.material.emissive.setHex(rColor);
    }

    // Update Bone cylinders (position, rotation, scale between joint pairs)
    bones.forEach(({ mesh, start, end }) => {
      const p1 = pos[start];
      const p2 = pos[end];
      if (!p1 || !p2) return;

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);

      mesh.position.copy(mid);
      mesh.scale.set(1, dist, 1);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3().subVectors(p2, p1).normalize()
      );
    });
  }, [lKnee, rKnee, lHip, rHip]);

  // Camera preset handler
  const setViewPreset = (view) => {
    setCameraView(view);
    const camera = cameraRef.current;
    if (!camera) return;

    if (view === 'front') {
      camera.position.set(0, 0.2, 4.0);
    } else if (view === 'side') {
      camera.position.set(4.0, 0.2, 0);
    } else if (view === 'isometric') {
      camera.position.set(2.5, 1.8, 3.2);
    }
    camera.lookAt(0, -0.1, 0);
  };

  return (
    <div className="glass-panel p-4 flex flex-col h-full relative overflow-hidden" style={{ minHeight: '520px' }}>
      {/* Header with Title & HUD Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="live-dot"></span>
            <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
          </div>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View angle buttons */}
          <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setViewPreset('isometric')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${cameraView === 'isometric' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              3D Iso
            </button>
            <button
              onClick={() => setViewPreset('front')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${cameraView === 'front' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Coronal (Front)
            </button>
            <button
              onClick={() => setViewPreset('side')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${cameraView === 'side' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Sagittal (Side)
            </button>
          </div>

          <button
            onClick={() => setShowAnglesHUD(!showAnglesHUD)}
            className={`btn btn-secondary text-xs px-2.5 py-1.5 ${showAnglesHUD ? 'text-cyan-400 border-cyan-500/40' : ''}`}
            title="Toggle Biomechanical Angles Overlay"
          >
            <Layers size={14} /> HUD
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div className="relative flex-1 w-full my-2 rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/90 border border-slate-800/80">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Live HUD Floating Badges on 3D viewport */}
        {showAnglesHUD && (
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
            {/* Left Knee HUD */}
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl shadow-xl flex items-center gap-3">
              <div 
                className="w-3.5 h-3.5 rounded-full" 
                style={{ backgroundColor: lKnee <= 125 ? '#10b981' : '#06b6d4', boxShadow: '0 0 8px currentColor' }}
              />
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400">Left Knee Flexion</div>
                <div className="text-base font-extrabold text-white font-mono flex items-baseline gap-1">
                  {lKnee.toFixed(1)}°
                  <span className="text-[10px] text-slate-400">
                    {lKnee <= 125 ? 'Target ROM' : 'Descent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Knee HUD */}
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl shadow-xl flex items-center gap-3">
              <div 
                className="w-3.5 h-3.5 rounded-full" 
                style={{ backgroundColor: rKnee <= 125 ? '#10b981' : '#06b6d4', boxShadow: '0 0 8px currentColor' }}
              />
              <div>
                <div className="text-[11px] uppercase font-bold text-slate-400">Right Knee Flexion</div>
                <div className="text-base font-extrabold text-white font-mono flex items-baseline gap-1">
                  {rKnee.toFixed(1)}°
                  <span className="text-[10px] text-slate-400">
                    {rKnee <= 125 ? 'Target ROM' : 'Descent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bilateral Symmetry */}
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
              <Activity size={14} className={symmetryPct >= 90 ? 'text-emerald-400' : 'text-amber-400'} />
              <span className="text-xs text-slate-300 font-semibold">Symmetry:</span>
              <span className="text-xs font-mono font-bold text-white">{symmetryPct.toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* 3D Legend & Interaction Hint */}
        <div className="absolute bottom-3 right-3 text-right pointer-events-none z-10">
          <div className="flex items-center gap-2 justify-end mb-1 text-[11px] font-semibold text-slate-300">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 90-125° Rehab Target
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500 ml-2"></span> 130-180° Range
          </div>
          <p className="text-[10px] text-slate-400">Click & Drag to rotate • Scroll to zoom</p>
        </div>
      </div>

      {/* Frame Timeline / Scrubber if frameData is provided */}
      {frameData.length > 0 && (
        <div className="pt-2 border-t border-slate-800 flex items-center gap-3 z-10">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className="btn btn-primary p-2 rounded-lg"
              title={isPlaying ? "Pause" : "Play Animation"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
          )}

          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Frame {currentFrame} / {frameData.length - 1}</span>
              <span>{((currentFrame / 30)).toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, frameData.length - 1)}
              value={currentFrame}
              onChange={(e) => onSeek && onSeek(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
