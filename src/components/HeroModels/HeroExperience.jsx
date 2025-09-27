import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import React, { useRef, useState, useEffect } from 'react'
import { useMediaQuery } from 'react-responsive'
import { Bridge } from './Bridge'
import HeroLights from './HeroLights'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

const RESUME_DELAY_MS = 500 // resume follow .5s after last user movement

// Mouse-following model controller
const MouseFollowModel = ({ modelRef, isFollowingMouse, mousePosition, isVisible }) => {
  const lastTimeRef = useRef(0)
  
  useFrame((state, delta) => {
    if (!modelRef.current || !isFollowingMouse || !isVisible) return

    // Cap delta to prevent huge jumps after tab switching
    const cappedDelta = Math.min(delta, 1/30) // Max 30fps equivalent

    // Convert mouse position to 3D rotation (inverted)
    const targetRotationY = mousePosition.x * 0.15 // left/right
    const targetRotationX = -mousePosition.y * 0.10 // up/down

    // Smoothly interpolate to target rotation
    const rot = modelRef.current.rotation
    rot.y = THREE.MathUtils.lerp(rot.y, -Math.PI / 4 + targetRotationY, cappedDelta * 2)
    rot.x = THREE.MathUtils.lerp(rot.x, 0.5 + targetRotationX, cappedDelta * 2)
  })
  return null
}

const HeroExperience = () => {
  const isTablet = useMediaQuery({ query: 'max-width: 1024px' })
  const isMobile = useMediaQuery({ query: 'max-width: 768px' })

  const controlsRef = useRef()
  const modelRef = useRef()
  const canvasRef = useRef()

  const [isFollowingMouse, setIsFollowingMouse] = useState(true)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(true)

  const resumeTimerRef = useRef(null)
  const scheduleResume = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      setIsFollowingMouse(true)
    }, RESUME_DELAY_MS)
  }
  const pauseFollow = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    setIsFollowingMouse(false)
  }

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden
      setIsVisible(visible)
      
      if (!visible) {
        // Tab became hidden - pause everything
        pauseFollow()
      } else {
        // Tab became visible - always schedule resume (user isn't actively interacting)
        scheduleResume()
        
        // Reset OrbitControls damping to prevent jumps
        if (controlsRef.current) {
          controlsRef.current.update()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Handle window focus/blur as backup
  useEffect(() => {
    const handleFocus = () => {
      setIsVisible(true)
      if (controlsRef.current) {
        controlsRef.current.update()
      }
    }
    
    const handleBlur = () => {
      setIsVisible(false)
      pauseFollow()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Track mouse position over the canvas (always, so resume uses fresh coords)
  useEffect(() => {
    const handlePointerMove = (event) => {
      const canvas = canvasRef.current
      if (!canvas || !isVisible) return
      const rect = canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      setMousePosition({ x, y })
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [isVisible])

  // Hook OrbitControls events to pause and schedule resume after inactivity
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const onStart = () => {
      // user begins interacting
      pauseFollow()
    }
    const onChange = () => {
      // fires continuously while moving; push back the resume timer
      pauseFollow()
      scheduleResume()
    }
    const onEnd = () => {
      // ensure resume scheduled when interaction ends
      scheduleResume()
    }

    controls.addEventListener('start', onStart)
    controls.addEventListener('change', onChange)
    controls.addEventListener('end', onEnd)

    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('change', onChange)
      controls.removeEventListener('end', onEnd)
    }
  }, [])

  // Also consider wheel and touch as interactions (in case controls events don't catch all)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = () => { pauseFollow(); scheduleResume() }
    const onTouchStart = () => { pauseFollow(); scheduleResume() }
    canvas.addEventListener('wheel', onWheel, { passive: true })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
    }
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    }
  }, [])

  return (
    <Canvas
      ref={canvasRef}
      shadows
      camera={{ position: [0, 0, 15], fov: 45 }}
    >
      {/* Follow the mouse, but auto-resume 1s after the user stops moving */}
      <MouseFollowModel
        modelRef={modelRef}
        isFollowingMouse={isFollowingMouse}
        mousePosition={mousePosition}
        isVisible={isVisible}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={!isTablet}
        maxDistance={20}
        minDistance={5}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2}
        enabled // keep enabled; we never block the first drag
        enableDamping
        dampingFactor={0.05}
      />

      <HeroLights />

      <group
        ref={modelRef}
        scale={isMobile ? 0.390 : 0.460} // 465
        position={isMobile ? [.12, -1, 0] : [.12, -1, 0]} //0.5, -1, 0
        rotation={[0.5, -Math.PI / 4, 0]}
      >
        <Bridge />
      </group>

      <EffectComposer>
        <Bloom
          intensity={0.3}
          luminanceThreshold={0}
          luminanceSaturation={1}
          mipmapBlur
          radius={0.5}
        />
      </EffectComposer>
    </Canvas>
  )
}

export default HeroExperience
