import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, ZoomIn, ZoomOut, Play, Pause, X, Sparkles } from 'lucide-react';

interface VideoNode {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  position: [number, number, number];
  cluster: number;
  clusterName: string;
  sourcePhase?: 'shorts' | 'video' | 'playlist' | 'home_feed' | 'watch_history' | 'subscriptions' | 'search' | 'recommended';
  significanceWeight?: number;
}

interface AIClassification {
  category: string;
  color: string;
  percentage: number;
  description: string;
}

interface VideoConstellationProps {
  videos: VideoNode[];
  clusters: { id: number; name: string; color: string }[];
  similarityMatrix?: number[][];
  aiClassifications?: AIClassification[];
  onNodeClick?: (video: VideoNode) => void;
}

// Source phase colors for visual differentiation
const SOURCE_PHASE_COLORS: Record<string, string> = {
  shorts: '#EC4899',        // pink - special shorts indicator
  video: '#3B82F6',         // blue - regular video (solid ring)
  playlist: '#8B5CF6',      // violet - playlist video
  watch_history: '#3B82F6', // blue - solid ring
  home_feed: '#22C55E',     // green - dashed ring
  subscriptions: '#A855F7', // purple - dotted ring
  search: '#EAB308',        // yellow - double ring
  recommended: '#F97316',   // orange - thin ring
};

const CLUSTER_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Sky
];

// Bubble shader with fisheye distortion for thumbnail
const bubbleVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const bubbleFragmentShader = `
  uniform sampler2D thumbnailTexture;
  uniform vec3 outlineColor;
  uniform float time;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  void main() {
    // Calculate view direction for fresnel
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.5);
    
    // Fisheye distortion for thumbnail - map sphere UV to circular distortion
    vec2 centeredUv = vUv * 2.0 - 1.0;
    float dist = length(centeredUv);
    
    // Only show thumbnail in the center area with fisheye effect
    vec4 thumbnailColor = vec4(0.0);
    if (dist < 0.85) {
      // Fisheye distortion
      float distortion = 1.0 - pow(dist, 1.5) * 0.3;
      vec2 distortedUv = centeredUv * distortion;
      vec2 finalUv = (distortedUv + 1.0) * 0.5;
      
      // Sample thumbnail with slight blur at edges
      thumbnailColor = texture2D(thumbnailTexture, finalUv);
      
      // Fade thumbnail at edges for bubble effect
      float edgeFade = smoothstep(0.85, 0.5, dist);
      thumbnailColor.a *= edgeFade;
    }
    
    // Iridescent soap bubble effect
    float iridescence = sin(fresnel * 6.28 + time) * 0.5 + 0.5;
    vec3 bubbleSheen = mix(
      outlineColor,
      vec3(1.0, 1.0, 1.0),
      iridescence * 0.3
    );
    
    // Outline glow at edges (fresnel effect)
    vec3 outlineGlow = outlineColor * fresnel * 1.5;
    
    // Combine: thumbnail in center, bubble sheen overlay, outline at edges
    vec3 finalColor = thumbnailColor.rgb * (1.0 - fresnel * 0.5);
    finalColor += outlineGlow;
    finalColor += bubbleSheen * fresnel * 0.4;
    
    // Transparency: more opaque in center (thumbnail), transparent at edges
    float alpha = mix(0.95, 0.3, fresnel);
    alpha = max(alpha, thumbnailColor.a * 0.9);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function VideoConstellation({ videos, clusters, similarityMatrix, aiClassifications, onNodeClick }: VideoConstellationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const outlineRingsRef = useRef<THREE.Line[]>([]);
  const linesRef = useRef<THREE.Line[]>([]);
  const animationRef = useRef<number>(0);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const timeRef = useRef<number>(0);
  const videoIndexMapRef = useRef<Map<string, number>>(new Map());
  
  const [selectedNode, setSelectedNode] = useState<VideoNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<VideoNode | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  
  // Build video index map for similarity lookup
  useEffect(() => {
    const map = new Map<string, number>();
    videos.forEach((v, i) => map.set(v.id, i));
    videoIndexMapRef.current = map;
  }, [videos]);

  // Create bubble material with thumbnail texture
  const createBubbleMaterial = useCallback((thumbnailUrl: string, clusterColor: string) => {
    const loader = textureLoaderRef.current || new THREE.TextureLoader();
    textureLoaderRef.current = loader;
    
    // Load thumbnail texture
    const texture = loader.load(thumbnailUrl, (tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    });
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        thumbnailTexture: { value: texture },
        outlineColor: { value: new THREE.Color(clusterColor) },
        time: { value: 0 },
      },
      vertexShader: bubbleVertexShader,
      fragmentShader: bubbleFragmentShader,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    
    materialsRef.current.push(material);
    return material;
  }, []);

  // Create outline ring with source phase differentiation
  const createOutlineRing = useCallback((color: string, radius: number, sourcePhase?: string) => {
    const segments = 64;
    const points: THREE.Vector3[] = [];
    
    // Different ring patterns based on source phase
    const skipPattern = (() => {
      switch (sourcePhase) {
        case 'shorts': return { skip: 1, draw: 2 }; // short dashes for shorts
        case 'video': return { skip: 0, draw: 8 }; // solid for regular video
        case 'playlist': return { skip: 2, draw: 4 }; // medium dashed for playlist
        case 'home_feed': return { skip: 2, draw: 6 }; // dashed
        case 'subscriptions': return { skip: 1, draw: 3 }; // dotted
        case 'search': return { skip: 0, draw: 8 }; // double (will add inner ring)
        case 'recommended': return { skip: 0, draw: 8 }; // thin
        case 'watch_history': 
        default: return { skip: 0, draw: 8 }; // solid
      }
    })();
    
    for (let i = 0; i <= segments; i++) {
      const segmentIndex = Math.floor(i / 8);
      const inSkip = (segmentIndex % (skipPattern.skip + skipPattern.draw)) < skipPattern.skip;
      
      // Skip segments for dashed/dotted patterns
      if (skipPattern.skip > 0 && inSkip) {
        if (points.length > 0) {
          // Break the line
        }
        continue;
      }
      
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius,
        0
      ));
    }
    
    // Use source phase color if available, otherwise cluster color
    const ringColor = sourcePhase ? SOURCE_PHASE_COLORS[sourcePhase] || color : color;
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(ringColor),
      transparent: true,
      opacity: sourcePhase === 'recommended' ? 0.5 : 0.9,
      linewidth: sourcePhase === 'recommended' ? 1 : 2,
    });
    
    return new THREE.Line(geometry, material);
  }, []);
  
  // Create secondary inner ring for search phase (double ring effect)
  const createInnerRing = useCallback((color: string, radius: number) => {
    const segments = 64;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius,
        0
      ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.6,
      linewidth: 1,
    });
    
    return new THREE.Line(geometry, material);
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene - clean dark background, no stars
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 50);
    cameraRef.current = camera;

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (error) {
      console.warn('WebGL not available:', error);
      setWebglError('WebGL is not available in this environment');
      return;
    }
    
    if (!renderer.getContext()) {
      console.warn('WebGL context could not be created');
      setWebglError('WebGL context could not be created');
      return;
    }
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 15;
    controls.maxDistance = 120;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.2;
    controlsRef.current = controls;

    // Soft ambient lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

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
      
      timeRef.current += 0.01;
      
      // Update shader uniforms for iridescence animation
      materialsRef.current.forEach(material => {
        if (material.uniforms.time) {
          material.uniforms.time.value = timeRef.current;
        }
      });
      
      // Gentle floating animation for bubbles
      nodesRef.current.forEach((mesh, id) => {
        const offset = parseInt(id.replace(/\D/g, '') || '0', 10) % 10;
        mesh.position.y += Math.sin(timeRef.current * 0.5 + offset) * 0.002;
        
        // Make outline rings face camera
        const ring = outlineRingsRef.current.find(r => r.userData.nodeId === id);
        if (ring) {
          ring.position.copy(mesh.position);
          ring.lookAt(camera.position);
        }
      });
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Raycaster for interaction
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
      
      controls.dispose();
      
      // Dispose outline rings
      outlineRingsRef.current.forEach(ring => {
        ring.geometry.dispose();
        if (ring.material instanceof THREE.Material) {
          ring.material.dispose();
        }
      });
      outlineRingsRef.current = [];
      
      // Dispose lines
      linesRef.current.forEach(line => {
        line.geometry.dispose();
        if (line.material instanceof THREE.Material) {
          line.material.dispose();
        }
      });
      linesRef.current = [];
      
      // Dispose nodes and materials
      nodesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.ShaderMaterial) {
          if (mesh.material.uniforms.thumbnailTexture?.value) {
            mesh.material.uniforms.thumbnailTexture.value.dispose();
          }
          mesh.material.dispose();
        }
      });
      nodesRef.current.clear();
      materialsRef.current = [];
      
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [onNodeClick]);

  // Add bubble nodes to scene
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clear existing
    nodesRef.current.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.ShaderMaterial) {
        if (mesh.material.uniforms.thumbnailTexture?.value) {
          mesh.material.uniforms.thumbnailTexture.value.dispose();
        }
        mesh.material.dispose();
      }
    });
    nodesRef.current.clear();
    materialsRef.current = [];

    outlineRingsRef.current.forEach(ring => {
      scene.remove(ring);
      ring.geometry.dispose();
      if (ring.material instanceof THREE.Material) {
        ring.material.dispose();
      }
    });
    outlineRingsRef.current = [];

    linesRef.current.forEach(line => {
      scene.remove(line);
      line.geometry.dispose();
      if (line.material instanceof THREE.Material) {
        line.material.dispose();
      }
    });
    linesRef.current = [];

    // Add bubble nodes
    videos.forEach((video) => {
      const clusterColor = CLUSTER_COLORS[video.cluster % CLUSTER_COLORS.length];
      
      // Scale bubble size based on significance weight (30-80 maps to 1.5-2.5)
      const baseSize = 2;
      const sizeMultiplier = video.significanceWeight 
        ? 0.75 + (video.significanceWeight / 100) * 0.75
        : 1;
      const bubbleSize = baseSize * sizeMultiplier;
      
      // Main bubble sphere with thumbnail
      const geometry = new THREE.SphereGeometry(bubbleSize, 64, 64);
      const material = createBubbleMaterial(video.thumbnailUrl, clusterColor);
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(...video.position);
      mesh.userData = video;
      
      scene.add(mesh);
      nodesRef.current.set(video.id, mesh);

      // Colored outline ring with source phase differentiation
      const outlineRing = createOutlineRing(clusterColor, bubbleSize + 0.1, video.sourcePhase);
      outlineRing.position.copy(mesh.position);
      outlineRing.userData = { nodeId: video.id, sourcePhase: video.sourcePhase };
      scene.add(outlineRing);
      outlineRingsRef.current.push(outlineRing);
      
      // Add inner ring for search phase (double ring effect)
      if (video.sourcePhase === 'search') {
        const innerRing = createInnerRing(SOURCE_PHASE_COLORS.search, bubbleSize * 0.85);
        innerRing.position.copy(mesh.position);
        innerRing.userData = { nodeId: video.id, isInner: true };
        scene.add(innerRing);
        outlineRingsRef.current.push(innerRing);
      }
    });

    // Connection lines between same-cluster or nearby videos
    videos.forEach((video) => {
      const clusterColor = CLUSTER_COLORS[video.cluster % CLUSTER_COLORS.length];
      
      videos.forEach((otherVideo) => {
        if (video.id >= otherVideo.id) return;
        
        const distance = Math.sqrt(
          Math.pow(video.position[0] - otherVideo.position[0], 2) +
          Math.pow(video.position[1] - otherVideo.position[1], 2) +
          Math.pow(video.position[2] - otherVideo.position[2], 2)
        );
        
        // Connect if same cluster or very close
        if (video.cluster === otherVideo.cluster || distance < 12) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...video.position),
            new THREE.Vector3(...otherVideo.position),
          ]);
          
          const lineMaterial = new THREE.LineBasicMaterial({
            color: new THREE.Color(clusterColor),
            transparent: true,
            opacity: 0.4,
          });
          
          const line = new THREE.Line(lineGeometry, lineMaterial);
          scene.add(line);
          linesRef.current.push(line);
        }
      });
    });
  }, [videos, createBubbleMaterial, createOutlineRing, createInnerRing]);

  // Similarity-based hover highlighting effect
  useEffect(() => {
    if (!hoveredNode || !similarityMatrix) {
      // Reset all nodes to full opacity when not hovering
      nodesRef.current.forEach((mesh) => {
        if (mesh.material instanceof THREE.ShaderMaterial) {
          mesh.material.opacity = 1.0;
          mesh.material.needsUpdate = true;
        }
      });
      outlineRingsRef.current.forEach((ring) => {
        if (ring.material instanceof THREE.LineBasicMaterial) {
          ring.material.opacity = ring.userData.isInner ? 0.6 : 0.9;
          ring.material.needsUpdate = true;
        }
      });
      return;
    }

    const hoveredIndex = videoIndexMapRef.current.get(hoveredNode.id);
    if (hoveredIndex === undefined) return;

    // Update opacity based on similarity
    nodesRef.current.forEach((mesh, nodeId) => {
      const nodeIndex = videoIndexMapRef.current.get(nodeId);
      if (nodeIndex === undefined) return;

      const similarity = similarityMatrix[hoveredIndex]?.[nodeIndex] ?? 0;
      
      // Map similarity to opacity: 0.2 (dissimilar) to 1.0 (similar)
      const opacity = Math.max(0.2, similarity);
      
      if (mesh.material instanceof THREE.ShaderMaterial) {
        mesh.material.opacity = opacity;
        mesh.material.needsUpdate = true;
      }
    });

    // Update outline rings similarly
    outlineRingsRef.current.forEach((ring) => {
      const nodeId = ring.userData.nodeId;
      const nodeIndex = videoIndexMapRef.current.get(nodeId);
      if (nodeIndex === undefined) return;

      const similarity = similarityMatrix[hoveredIndex]?.[nodeIndex] ?? 0;
      const baseOpacity = ring.userData.isInner ? 0.6 : 0.9;
      const opacity = Math.max(0.15, similarity * baseOpacity);

      if (ring.material instanceof THREE.LineBasicMaterial) {
        ring.material.opacity = opacity;
        ring.material.needsUpdate = true;
      }
    });
  }, [hoveredNode, similarityMatrix]);

  // Controls
  const toggleAutoRotate = () => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !isPlaying;
      setIsPlaying(!isPlaying);
    }
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0, 50);
      controlsRef.current.reset();
    }
  };

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

  // WebGL fallback
  if (webglError) {
    return (
      <div className="relative w-full h-full min-h-[500px] rounded-lg overflow-hidden bg-[#0d1117] flex flex-col items-center justify-center text-center p-8">
        <Sparkles className="h-16 w-16 text-white/30 mb-4" />
        <p className="text-white/60 text-lg mb-2">3D Filter Bubble Unavailable</p>
        <p className="text-white/40 text-sm max-w-md">
          WebGL is required for the filter bubble visualization.
        </p>
        <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-white/60 mb-3">Video Categories ({videos.length} videos)</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {clusters.map((cluster, index) => {
              const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
              return (
                <div key={cluster.id} className="flex items-center gap-2" data-testid={`cluster-legend-${cluster.id}`}>
                  <div
                    className="w-3 h-3 rounded-full bg-transparent"
                    style={{ 
                      border: `2px solid ${color}`,
                      boxShadow: `0 0 4px ${color}40`,
                    }}
                  />
                  <span className="text-xs text-white/80">{cluster.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-lg overflow-hidden bg-[#0d1117]">
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full h-full" data-testid="canvas-constellation" />
      
      {/* Controls */}
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
        <p className="text-xs text-white/60 mb-2">Filter Bubbles</p>
        <div className="flex flex-col gap-1.5">
          {clusters.map((cluster, index) => {
            const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
            return (
              <div key={cluster.id} className="flex items-center gap-2" data-testid={`legend-${cluster.id}`}>
                <div
                  className="w-3 h-3 rounded-full bg-transparent"
                  style={{ 
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 4px ${color}40`,
                  }}
                />
                <span className="text-xs text-white/80">{cluster.name}</span>
              </div>
            );
          })}
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
                variant="outline"
                className="mt-2 text-[10px] bg-transparent"
                style={{ 
                  borderColor: CLUSTER_COLORS[hoveredNode.cluster % CLUSTER_COLORS.length],
                  color: CLUSTER_COLORS[hoveredNode.cluster % CLUSTER_COLORS.length],
                }}
              >
                {hoveredNode.clusterName}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Selected node panel */}
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
                variant="outline"
                className="mt-2 text-xs bg-transparent"
                style={{ 
                  borderColor: CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length],
                  color: CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length],
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
        Drag to rotate | Scroll to zoom | Click bubble for details
      </div>
    </div>
  );
}
