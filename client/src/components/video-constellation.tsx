import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, ZoomIn, ZoomOut, Play, Pause, Maximize2, X } from 'lucide-react';

interface VideoNode {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  position: [number, number, number];
  cluster: number;
  clusterName: string;
}

interface VideoConstellationProps {
  videos: VideoNode[];
  clusters: { id: number; name: string; color: string }[];
  onNodeClick?: (video: VideoNode) => void;
}

const CLUSTER_COLORS = [
  '#FF6B6B', // Red - Politics Left
  '#4ECDC4', // Teal - Tech
  '#45B7D1', // Blue - Education
  '#96CEB4', // Green - Nature
  '#FFEAA7', // Yellow - Entertainment
  '#DDA0DD', // Plum - Music
  '#98D8C8', // Mint - Lifestyle
  '#F7DC6F', // Gold - Business
  '#BB8FCE', // Purple - Gaming
  '#85C1E9', // Sky - Science
];

export function VideoConstellation({ videos, clusters, onNodeClick }: VideoConstellationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const glowMeshesRef = useRef<THREE.Mesh[]>([]);
  const linesRef = useRef<THREE.Line[]>([]);
  const starsRef = useRef<THREE.Points | null>(null);
  const animationRef = useRef<number>(0);
  
  const [selectedNode, setSelectedNode] = useState<VideoNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<VideoNode | null>(null);

  // Create glass bubble material
  const createGlassMaterial = useCallback((color: string, isHovered: boolean = false) => {
    const baseColor = new THREE.Color(color);
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.1,
      roughness: 0.05,
      transmission: isHovered ? 0.7 : 0.85,
      thickness: 0.5,
      envMapIntensity: 1.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      ior: 1.5,
      transparent: true,
      opacity: isHovered ? 0.95 : 0.8,
      side: THREE.DoubleSide,
    });
  }, []);

  // Create glow effect
  const createGlowMaterial = useCallback((color: string) => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(color) },
        viewVector: { value: new THREE.Vector3() },
      },
      vertexShader: `
        uniform vec3 viewVector;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormel = normalize(normalMatrix * viewVector);
          intensity = pow(0.7 - dot(vNormal, vNormel), 2.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          vec3 glow = glowColor * intensity;
          gl_FragColor = vec4(glow, intensity * 0.6);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 50);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 10;
    controls.maxDistance = 150;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404080, 0.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x6366f1, 2, 100);
    pointLight1.position.set(30, 30, 30);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x22d3ee, 1.5, 100);
    pointLight2.position.set(-30, -20, 20);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xf472b6, 1, 80);
    pointLight3.position.set(0, 40, -30);
    scene.add(pointLight3);

    // Stars background
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 2000;
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);
    
    for (let i = 0; i < starsCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 300;
      positions[i3 + 1] = (Math.random() - 0.5) * 300;
      positions[i3 + 2] = (Math.random() - 0.5) * 300;
      
      const brightness = 0.5 + Math.random() * 0.5;
      colors[i3] = brightness;
      colors[i3 + 1] = brightness;
      colors[i3 + 2] = brightness + Math.random() * 0.2;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    starsRef.current = stars;

    // Nebula effect (subtle fog)
    scene.fog = new THREE.FogExp2(0x0a0a2a, 0.008);

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      // Rotate stars slowly
      stars.rotation.y += 0.0001;
      stars.rotation.x += 0.00005;
      
      // Pulse effect for nodes
      const time = Date.now() * 0.001;
      nodesRef.current.forEach((mesh, id) => {
        const scale = 1 + Math.sin(time * 2 + parseInt(id, 36) % 10) * 0.05;
        mesh.scale.setScalar(scale);
      });
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(nodesRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);
      
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const videoData = mesh.userData as VideoNode;
        setHoveredNode(videoData);
        container.style.cursor = 'pointer';
      } else {
        setHoveredNode(null);
        container.style.cursor = 'grab';
      }
    };

    const onClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(nodesRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);
      
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const videoData = mesh.userData as VideoNode;
        setSelectedNode(videoData);
        onNodeClick?.(videoData);
      }
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('click', onClick);
      cancelAnimationFrame(animationRef.current);
      
      // Dispose OrbitControls
      controls.dispose();
      
      // Dispose stars
      if (starsRef.current) {
        starsRef.current.geometry.dispose();
        if (starsRef.current.material instanceof THREE.Material) {
          starsRef.current.material.dispose();
        }
      }
      
      // Dispose all glow meshes
      glowMeshesRef.current.forEach(mesh => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
      });
      glowMeshesRef.current = [];
      
      // Dispose all lines
      linesRef.current.forEach(line => {
        line.geometry.dispose();
        if (line.material instanceof THREE.Material) {
          line.material.dispose();
        }
      });
      linesRef.current = [];
      
      // Dispose all node meshes
      nodesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      });
      nodesRef.current.clear();
      
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [onNodeClick]);

  // Add video nodes to scene
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clear existing nodes
    nodesRef.current.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    nodesRef.current.clear();

    // Clear existing glow meshes
    glowMeshesRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });
    glowMeshesRef.current = [];

    // Clear existing lines
    linesRef.current.forEach(line => {
      scene.remove(line);
      line.geometry.dispose();
      if (line.material instanceof THREE.Material) {
        line.material.dispose();
      }
    });
    linesRef.current = [];

    // Create connection lines between nearby nodes
    const linesMaterial = new THREE.LineBasicMaterial({
      color: 0x3b4a6b,
      transparent: true,
      opacity: 0.3,
    });

    // Add nodes
    videos.forEach((video) => {
      const clusterColor = CLUSTER_COLORS[video.cluster % CLUSTER_COLORS.length];
      
      // Main bubble
      const geometry = new THREE.SphereGeometry(1.5, 32, 32);
      const material = createGlassMaterial(clusterColor);
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(...video.position);
      mesh.userData = video;
      
      scene.add(mesh);
      nodesRef.current.set(video.id, mesh);

      // Inner glow sphere
      const glowGeometry = new THREE.SphereGeometry(1.8, 16, 16);
      const glowMaterial = createGlowMaterial(clusterColor);
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      glowMesh.position.copy(mesh.position);
      scene.add(glowMesh);
      glowMeshesRef.current.push(glowMesh);

      // Connection lines to nearby nodes
      videos.forEach((otherVideo) => {
        if (video.id >= otherVideo.id) return;
        
        const distance = Math.sqrt(
          Math.pow(video.position[0] - otherVideo.position[0], 2) +
          Math.pow(video.position[1] - otherVideo.position[1], 2) +
          Math.pow(video.position[2] - otherVideo.position[2], 2)
        );
        
        // Connect if same cluster or very close
        if (video.cluster === otherVideo.cluster || distance < 10) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...video.position),
            new THREE.Vector3(...otherVideo.position),
          ]);
          const line = new THREE.Line(lineGeometry, linesMaterial);
          scene.add(line);
          linesRef.current.push(line);
        }
      });
    });
  }, [videos, createGlassMaterial, createGlowMaterial]);

  // Toggle auto-rotate
  const toggleAutoRotate = () => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !isPlaying;
      setIsPlaying(!isPlaying);
    }
  };

  // Reset camera
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0, 50);
      controlsRef.current.reset();
    }
  };

  // Zoom controls
  const zoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.8);
    }
  };

  const zoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.2);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-lg overflow-hidden bg-[#0a0a1a]">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Controls overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Button
          size="icon"
          variant="outline"
          className="bg-black/50 border-white/20 text-white backdrop-blur-sm"
          onClick={toggleAutoRotate}
          data-testid="button-toggle-rotation"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="bg-black/50 border-white/20 text-white backdrop-blur-sm"
          onClick={resetCamera}
          data-testid="button-reset-camera"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="bg-black/50 border-white/20 text-white backdrop-blur-sm"
          onClick={zoomIn}
          data-testid="button-zoom-in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="bg-black/50 border-white/20 text-white backdrop-blur-sm"
          onClick={zoomOut}
          data-testid="button-zoom-out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Cluster legend */}
      <div className="absolute top-4 right-4 p-3 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
        <p className="text-xs text-white/60 mb-2">Categories</p>
        <div className="flex flex-col gap-1.5">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: CLUSTER_COLORS[cluster.id % CLUSTER_COLORS.length] }}
              />
              <span className="text-xs text-white/80">{cluster.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && !selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-auto md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 p-4 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 max-w-xs">
          <div className="flex items-start gap-3">
            <img
              src={hoveredNode.thumbnailUrl}
              alt={hoveredNode.title}
              className="w-20 h-12 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium line-clamp-2">{hoveredNode.title}</p>
              <p className="text-xs text-white/60 mt-1">{hoveredNode.channelName}</p>
              <Badge
                className="mt-2 text-[10px]"
                style={{ 
                  backgroundColor: CLUSTER_COLORS[hoveredNode.cluster % CLUSTER_COLORS.length] + '40',
                  color: CLUSTER_COLORS[hoveredNode.cluster % CLUSTER_COLORS.length],
                  borderColor: CLUSTER_COLORS[hoveredNode.cluster % CLUSTER_COLORS.length],
                }}
              >
                {hoveredNode.clusterName}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Selected node detail panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 md:bottom-4 md:left-4 md:right-auto p-4 rounded-lg bg-black/90 backdrop-blur-md border border-white/20 max-w-sm">
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-2 right-2 text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col gap-3">
            <img
              src={selectedNode.thumbnailUrl}
              alt={selectedNode.title}
              className="w-full aspect-video object-cover rounded"
            />
            <div>
              <p className="text-sm text-white font-medium">{selectedNode.title}</p>
              <p className="text-xs text-white/60 mt-1">{selectedNode.channelName}</p>
              <Badge
                className="mt-2 text-xs"
                style={{ 
                  backgroundColor: CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length] + '40',
                  color: CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length],
                  borderColor: CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length],
                }}
              >
                {selectedNode.clusterName}
              </Badge>
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${selectedNode.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2"
            >
              <Button className="w-full" size="sm">
                Watch on YouTube
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 text-xs text-white/40">
        Drag to rotate | Scroll to zoom | Click node for details
      </div>
    </div>
  );
}
