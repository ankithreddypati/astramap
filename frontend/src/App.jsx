// src/App.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useControls, button } from "leva";
import ChatBot from "./components/chatbot";
import Canvas from "./components/canvas";
import "./App.css";

function App() {
  const [currentResolution, setCurrentResolution] = useState(
    `${window.screen?.width || 1920}x${window.screen?.height || 1080}`
  );

  const projectorWindowRef = useRef(null);
  const [processedImage, setProcessedImage] = useState(null);

  // homography corners (TL, BL, TR, BR) in canvas px relative to center
  const [corners, setCorners] = useState(null);

  const sendToProjector = useCallback((data) => {
    if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
      projectorWindowRef.current.postMessage(data, "*");
    }
  }, []);

  const openOnProjector = useCallback(async (whiteoutEnabled = false) => {
    let details;
    try {
      await navigator?.permissions?.query?.({ name: "window-management" });
      details = await window?.getScreenDetails?.();
    } catch {}

    let features = "popup=yes";
    let projectorRes = "1280x720";

    if (details) {
      const s =
        details.screens.find((scr) => !scr.isPrimary) ?? details.currentScreen;
      const { availLeft, availTop, availWidth, availHeight } = s;
      features += `,left=${availLeft},top=${availTop},width=${availWidth},height=${availHeight}`;
      projectorRes = `${availWidth}x${availHeight}`;
    } else {
      features += `,width=1280,height=720`;
    }

    setCurrentResolution(projectorRes);

    const projectorUrl = whiteoutEnabled
      ? "/projector.html?whiteout=true"
      : "/projector.html";
    const win = window.open(projectorUrl, "projector", features);
    if (!win) {
      alert("Popup blocked. Please allow popups for this site and try again.");
      return;
    }
    projectorWindowRef.current = win;
    win.focus();
  }, []);

  const { whiteout, image } = useControls("Main Controls", {
    "send to projector": button((get) => {
      const w = get("Main Controls.whiteout");
      openOnProjector(!!w);
    }),
    whiteout: {
      value: false,
      onChange: (value) => sendToProjector({ type: "whiteout", value }),
    },
    image: {
      image: undefined,
      transient: false,
    },
  });

  const { zoom } = useControls("", {
    zoom: {
      value: 0,
      min: -50,
      max: 150,
      step: 1,
      onChange: (value) => sendToProjector({ type: "zoom", value }),
    },
  });

  // reflect image + reset corners on new image
  useEffect(() => {
    if (image) {
      let imageUrl;
      if (image.src) imageUrl = image.src;
      else if (image instanceof File) imageUrl = URL.createObjectURL(image);
      else if (typeof image === "string") imageUrl = image;

      if (imageUrl) {
        setProcessedImage(imageUrl);
        // setCorners(null);
        sendToProjector({ type: "image", value: imageUrl });
      }
    } else {
      setProcessedImage(null);
      // setCorners(null);
      sendToProjector({ type: "image", value: null });
    }
  }, [image, sendToProjector]);

  // keep projector in sync with resolution
  useEffect(() => {
    sendToProjector({ type: "resolution", value: currentResolution });
  }, [currentResolution, sendToProjector]);

  // 🔥 NEW: mirror homography corners to projector on every change
  useEffect(() => {
    if (corners && corners.length === 4) {
      sendToProjector({ type: "corners", value: corners });
    }
  }, [corners, sendToProjector]);

  // handshake
  useEffect(() => {
    const onMessage = (e) => {
      if (!e?.data || typeof e.data !== "object") return;
      if (e.data.type === "projector-ready") {
        sendToProjector({ type: "resolution", value: currentResolution });
        sendToProjector({ type: "zoom", value: zoom });
        sendToProjector({ type: "whiteout", value: whiteout });
        sendToProjector({ type: "image", value: processedImage || null });
        if (corners && corners.length === 4) {
          sendToProjector({ type: "corners", value: corners });
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentResolution, zoom, whiteout, processedImage, corners, sendToProjector]);

  const handleApplyImage = useCallback(
    (url) => {
      if (!url) return;
      setProcessedImage(url);
      // setCorners(null);
      sendToProjector({ type: "image", value: url });
    },
    [sendToProjector]
  );

  return (
    <div className="app-container">
      <Canvas
        image={processedImage}
        zoom={zoom}
        corners={corners}
        onCornersChange={setCorners}
      />
      {/* <ChatBot levaImage={image} onApplyImage={handleApplyImage} /> */}
      <ChatBot baseImage={processedImage || image} onApplyImage={handleApplyImage} />
    </div>
  );
}

export default App;
