// src/components/canvas.jsx
import React, { useEffect, useRef, useState } from "react";
import "../App.css";

/**
 * Layers (centered, stacked):
 *  z=1  boardRef   -> checkerboard underlay (hidden in 'solid' mode)
 *  z=2  glCanvas   -> WebGL image (transparent OR solid clear depending on background mode)
 *  z=3  overlayRef -> blue corner handles
 *
 * Coordinates:
 *  corners are in CANVAS pixels relative to the GL canvas center (same as before).
 *  CSS scaling is applied uniformly; dragging divides deltas by scale.
 */

const Canvas = ({
  image,                // URL
  zoom = 0,             // -50 .. 150
  resolution: propResolution, // "WxH" - defines the BOARD size
  corners,              // [{x,y},{x,y},{x,y},{x,y}] in CANVAS px, relative to center
  onCornersChange = () => {},

  // Background control
  background = "checker", // "checker" | "solid"
  bgColor = "#000000",    // used when background === "solid"

  // Visual knobs
  canvasScale = 0.2,  // CSS scale of both board and GL canvas
  bleed = 3.0         // GL canvas size = board * bleed (>=1) so image can bleed past board
}) => {
  const glCanvasRef = useRef(null); // draws the image
  const boardRef = useRef(null);    // checkerboard underlay
  const overlayRef = useRef(null);  // handles

  const [resolution, setResolution] = useState("1920x1080");
  const [ready, setReady] = useState(false);

  const glRef = useRef(null);
  const programRef = useRef(null);
  const buffersRef = useRef(null);
  const textureRef = useRef(null);
  const autoCornersRef = useRef(true);

  const isPowerOf2 = (v) => (v & (v - 1)) === 0;
  const parseResolution = (resString) => {
    if (!resString) return [1920, 1080];
    const parts = resString.split("x");
    if (parts.length !== 2) return [1920, 1080];
    const width = parseInt(parts[0]) || 1920;
    const height = parseInt(parts[1]) || 1080;
    return [
      Math.max(640, Math.min(width, 7680)),
      Math.max(360, Math.min(height, 4320)),
    ];
  };

  // init resolution
  useEffect(() => {
    if (window.screen) {
      setResolution(`${window.screen.width}x${window.screen.height}`);
    }
  }, []);
  useEffect(() => {
    if (propResolution) setResolution(propResolution);
  }, [propResolution]);

  // init GL
  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    const vs = `
      attribute vec2 a_position;
      attribute vec2 a_texcoord;
      varying vec2 v_texcoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texcoord = a_texcoord;
      }
    `;
    const fs = `
      precision mediump float;
      varying vec2 v_texcoord;
      uniform sampler2D u_tex;
      void main() {
        gl_FragColor = texture2D(u_tex, v_texcoord);
      }
    `;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    programRef.current = {
      program: prog,
      attribs: {
        a_position: gl.getAttribLocation(prog, "a_position"),
        a_texcoord: gl.getAttribLocation(prog, "a_texcoord"),
      },
      uniforms: {
        u_tex: gl.getUniformLocation(prog, "u_tex"),
      },
    };

    const posBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    const uvs = new Float32Array([
      0, 0,  0, 1,  1, 0,
      1, 0,  0, 1,  1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    buffersRef.current = { posBuf, uvBuf };
  }, []);

  // size board & GL canvas
  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    const board = boardRef.current;
    if (!glCanvas || !board) return;

    const [baseW, baseH] = parseResolution(resolution);
    const boardW = Math.round(baseW);
    const boardH = Math.round(baseH);
    const canvasW = Math.round(boardW * Math.max(1, bleed));
    const canvasH = Math.round(boardH * Math.max(1, bleed));

    // logical sizes
    glCanvas.width = canvasW;
    glCanvas.height = canvasH;

    // CSS sizes
    glCanvas.style.width = `${canvasW * canvasScale}px`;
    glCanvas.style.height = `${canvasH * canvasScale}px`;

    board.style.width = `${boardW * canvasScale}px`;
    board.style.height = `${boardH * canvasScale}px`;

    // checkerboard only if background === "checker"
    if (background === "checker") {
      const size = Math.round(20 * Math.min(boardW / 1920, boardH / 1080));
      board.style.backgroundImage =
        `linear-gradient(45deg, #e0e0e0 25%, transparent 25%), ` +
        `linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), ` +
        `linear-gradient(45deg, transparent 75%, #e0e0e0 75%), ` +
        `linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)`;
      board.style.backgroundSize = `${size}px ${size}px`;
      board.style.backgroundPosition = `0 0, 0 ${size / 2}px, ${size / 2}px -${size / 2}px, -${size / 2}px 0px`;
      board.style.display = "block";
    } else {
      board.style.display = "none";
    }

    // GL canvas visual background
    if (background === "solid") {
      glCanvas.style.backgroundColor = bgColor;
    } else {
      glCanvas.style.backgroundColor = "transparent";
    }
  }, [resolution, canvasScale, bleed, background, bgColor]);

  // (re)load image — with proper CLEAR when image is removed
  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;

    // If there's NO image: clear GL, delete old texture, stop here
    if (!image) {
      setReady(false);

      if (textureRef.current) {
        gl.deleteTexture(textureRef.current);
        textureRef.current = null;
      }

      // CLEAR the WebGL canvas so the old image disappears
      const canvas = glCanvasRef.current;
      if (canvas) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.DEPTH_TEST);
        if (background === "solid") {
          const hex = bgColor.replace("#", "");
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          gl.clearColor(r, g, b, 1); // opaque color
        } else {
          gl.clearColor(0, 0, 0, 0); // transparent over checkerboard
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      return; // IMPORTANT: bail out since there's no image to load
    }

    // If there IS an image: load as texture then draw
    setReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;
    img.onload = () => {
      const zoomFactor = 1 + zoom / 100;
      const baseW = 1200;
      const scaledW = baseW * zoomFactor;
      const aspect = img.height / img.width;
      const scaledH = scaledW * aspect;

      // auto-init the rect ONLY once after mount
      if (!corners || corners.length !== 4 || autoCornersRef.current) {
        const init = [
          { x: -scaledW / 2, y: -scaledH / 2 }, // TL
          { x: -scaledW / 2, y: +scaledH / 2 }, // BL
          { x: +scaledW / 2, y: -scaledH / 2 }, // TR
          { x: +scaledW / 2, y: +scaledH / 2 }, // BR
        ];
        // after the first auto init, stop re-initting on subsequent images
        autoCornersRef.current = false;
        onCornersChange(init);
      }

      const glTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, glTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      const potW = isPowerOf2(img.width);
      const potH = isPowerOf2(img.height);
      if (potW && potH) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      textureRef.current = glTex;
      setReady(true);
      draw(); // first draw
    };
    img.onerror = () => setReady(false);

    // include bg deps so the clear color matches mode when image becomes null
  }, [image, zoom, background, bgColor, corners, onCornersChange]);

  // redraw on corners/background changes
  useEffect(() => {
    if (!ready || !image || !corners || corners.length !== 4) return;
    draw();
  }, [corners, ready, image, background, bgColor]);

  const draw = () => {
    const gl = glRef.current;
    const prog = programRef.current;
    const bufs = buffersRef.current;
    const tex = textureRef.current;
    const canvas = glCanvasRef.current;
    if (!gl || !prog || !bufs || !tex || !canvas) return;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);

    // solid vs transparent clear
    if (background === "solid") {
      const hex = bgColor.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      gl.clearColor(r, g, b, 1); // opaque
    } else {
      gl.clearColor(0, 0, 0, 0);   // transparent so checker shows
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    const [TL, BL, TR, BR] = corners;
    const toNDC = (pt) => {
      const x = pt.x / (canvas.width / 2);
      const y = -pt.y / (canvas.height / 2);
      return [x, y];
    };
    const [tlx, tly] = toNDC(TL);
    const [blx, bly] = toNDC(BL);
    const [trx, try_] = toNDC(TR);
    const [brx, bry] = toNDC(BR);

    const positions = new Float32Array([
      tlx, tly,   blx, bly,   trx, try_,
      trx, try_,  blx, bly,   brx, bry,
    ]);

    gl.useProgram(prog.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(prog.attribs.a_position);
    gl.vertexAttribPointer(prog.attribs.a_position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.uvBuf);
    gl.enableVertexAttribArray(prog.attribs.a_texcoord);
    gl.vertexAttribPointer(prog.attribs.a_texcoord, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.uniforms.u_tex, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // drag a corner
  const startCornerDrag = (idx, startClient) => {
    if (!corners || corners.length !== 4) return;
    autoCornersRef.current = false;
    const start = { x: startClient.x, y: startClient.y };
    const startCorners = corners.map((p) => ({ ...p }));

    const move = (e) => {
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;

      // convert CSS pixel delta -> CANVAS pixel delta
      const dx = (clientX - start.x) / canvasScale;
      const dy = (clientY - start.y) / canvasScale;

      const next = startCorners.map((p, i) =>
        i === idx ? { x: p.x + dx, y: p.y + dy } : p
      );
      onCornersChange(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
  };

  const handleStyleAt = (p) => ({
    position: "absolute",
    left: `calc(50% + ${p.x * canvasScale - 6}px)`,
    top: `calc(50% + ${p.y * canvasScale - 6}px)`,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#007aff",
    boxShadow: "0 0 6px rgba(0,0,0,0.35)",
    cursor: "pointer",
    zIndex: 30,
  });

  // center & stack layers
  useEffect(() => {
    const center = (el, z) => {
      if (!el) return;
      el.style.position = "absolute";
      el.style.top = "50%";
      el.style.left = "50%";
      el.style.transform = "translate(-50%, -50%)";
      el.style.zIndex = z;
    };
    center(boardRef.current, 10);
    center(glCanvasRef.current, 20);
    center(overlayRef.current, 30);
    if (overlayRef.current) overlayRef.current.style.pointerEvents = "none";
  }, []);

  return (
    <div className="canvas-container">
      <div className="canvas-wrapper" style={{ position: "relative" }}>
        {/* Underlay checkerboard or hidden for solid */}
        <div ref={boardRef} />
        {/* WebGL canvas (image) */}
        <canvas ref={glCanvasRef} className="main-canvas" />
        {/* Handles */}
        <div ref={overlayRef} />
        {ready &&
          image &&
          corners &&
          corners.length === 4 &&
          corners.map((p, i) => (
            <div
              key={i}
              style={handleStyleAt(p)}
              onMouseDown={(e) => {
                e.stopPropagation();
                (e.currentTarget.parentElement || document.body).style.pointerEvents =
                  "auto";
                startCornerDrag(i, { x: e.clientX, y: e.clientY });
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                (e.currentTarget.parentElement || document.body).style.pointerEvents =
                  "auto";
                const t = e.touches?.[0];
                if (t) startCornerDrag(i, { x: t.clientX, y: t.clientY });
              }}
            />
          ))}
      </div>
    </div>
  );
};

export default Canvas;
