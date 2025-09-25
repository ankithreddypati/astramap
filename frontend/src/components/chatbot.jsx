// src/components/chatbot.jsx
import { useState, useRef, useEffect } from 'react';
import '../App.css';



// const ChatBot = ({ levaImage, onApplyImage = () => {} }) => {
  const ChatBot = ({ baseImage, onApplyImage = () => {} }) => { 
  // Vite env with sensible fallback; CRA guarded just in case
  const backendBase =
    (import.meta?.env?.VITE_BACKEND_URL) ||
    (typeof process !== 'undefined' ? process?.env?.REACT_APP_BACKEND_URL : undefined) ||
    'http://localhost:8000';

  const uploadEndpoint = `${backendBase.replace(/\/$/, '')}/generate/upload`;

  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef(null);

  // Random prompts for "Try Random"
  const randomPrompts = [
    "A majestic mountain landscape at sunset with golden light",
    "A futuristic city with flying cars and neon lights",
    "A peaceful forest with sunlight filtering through trees",
    "A cyberpunk street scene with rain and reflections",
    "A magical castle floating in the clouds",
    "A serene lake with swans and morning mist",
    "A space station orbiting a distant planet",
    "A cozy cabin in a snowy winter forest",
    "A vibrant underwater coral reef with tropical fish",
    "A steampunk airship sailing through stormy skies",
    "A mystical dragon flying over ancient ruins",
    "A bustling marketplace in a fantasy medieval town",
    "A minimalist modern house with floor-to-ceiling windows",
    "A cherry blossom garden in spring with petals falling",
    "A desert oasis with palm trees and clear blue water"
  ];

// Style presets
const stylePresets = [
  { id: 1, name: "Bauhaus Poster", 
    prompt: "Transform to Bauhaus art style while maintaining the original composition and object placement.",
    image: "/preset1.jpeg"
  },
  { id: 2, name: "Van Gogh Oil", 
    prompt: "Convert to the style of Van Gogh with thick visible brushstrokes, vibrant swirling colors, and heavy paint texture while preserving the structure of the image.",
    image: "/preset2.jpeg"
  },
  { id: 3, name: "Pencil Sketch", 
    prompt: "Convert to pencil sketch with natural graphite lines, cross-hatching, and visible paper texture while keeping the original layout and details.",
    image: "/preset3.jpeg"
  },
  { id: 4, name: "Claymation", 
    prompt: "Transform into Claymation style with sculpted clay textures, soft lighting, and slight imperfections while keeping the same characters and composition.",
    image: "/preset4.jpeg"
  }
];



  // Base prompt to preserve composition and placement for projection mapping
  const basePrompt = "Do not change the composition, layout, positioning, or placement of any items in this image. This is for projection mapping where precise alignment is critical. objects should be in their exact same positions and proportions.";

  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pushBot = (text) => setMessages(prev => [...prev, { text, isBot: true }]);
  const pushUser = (text) => setMessages(prev => [...prev, { text, isBot: false }]);

  const handleApply = (url) => {
    if (!url) return;
    onApplyImage(url); // apply to canvas + projector via parent callback
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!currentPrompt.trim()) return pushBot("Please enter a description for the image you'd like to generate.");
    // if (!levaImage) return pushBot("Please upload an image in the Projection Controls panel first.");
    if (!baseImage) return pushBot("Please upload an image (or apply one) first.");
    // combine base prompt + style preset + user prompt
    
    let fullPrompt = `${basePrompt}. ${currentPrompt}`;
    if (selectedStyle?.prompt) fullPrompt = `${basePrompt}. ${selectedStyle.prompt}. ${currentPrompt}`;

    pushUser(currentPrompt);
    pushBot("Generating your image…");
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('prompt', fullPrompt);

      // Optional knobs
      formData.append('output_format', 'jpeg');
      formData.append('resolution_mode', 'match_input');
      formData.append('num_inference_steps', '28');
      formData.append('guidance_scale', '2.5');
      formData.append('num_images', '1');
      formData.append('enable_safety_checker', 'true');

      // match backend field name: image_file
      // if (typeof levaImage === 'string') {
      //   const res = await fetch(levaImage);
       if (typeof baseImage === 'string') {
         const res = await fetch(baseImage);
        const blob = await res.blob();
        formData.append('image_file', new File([blob], 'input.png', { type: blob.type || 'image/png' }));
      // } else if (levaImage instanceof File) {
      //   formData.append('image_file', levaImage);
      // } else if (levaImage instanceof Blob) {
      //   formData.append('image_file', new File([levaImage], 'input.png', { type: levaImage.type || 'image/png' }));
      // } else if (levaImage?.src) {
      //   const res = await fetch(levaImage.src);
      } else if (baseImage instanceof File) {
           formData.append('image_file', baseImage);
         } else if (baseImage instanceof Blob) {
           formData.append('image_file', new File([baseImage], 'input.png', { type: baseImage.type || 'image/png' }));
         } else if (baseImage?.src) {
           const res = await fetch(baseImage.src);
        const blob = await res.blob();
        formData.append('image_file', new File([blob], 'input.png', { type: blob.type || 'image/png' }));
      } else {
        throw new Error("Unsupported image input from Leva.");
      }

      const resp = await fetch(uploadEndpoint, { method: 'POST', body: formData });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Backend error ${resp.status}: ${text}`);
      }

      // Handle both JSON and Base64
      const ct = resp.headers.get('content-type') || '';
      let imageUrl;

      if (ct.includes('application/json')) {
        const data = await resp.json();
        const first = data?.images?.[0]?.url;
        if (!first) throw new Error("No image URL in JSON response.");
        imageUrl = first;
      } else {
        const text = (await resp.text()).trim();
        imageUrl = `data:image/jpeg;base64,${text}`;
      }

      // Replace the "Generating…" line with an image-only bot message (no extra text)
      setMessages(prev => [
        ...prev.slice(0, -1),
        { isBot: true, imageUrl, prompt: fullPrompt }
      ]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { text: "Sorry, there was an error generating your image. Please try again.", isBot: true }]);
    } finally {
      setIsGenerating(false);
      setCurrentPrompt('');
    }
  };

  const handleTryRandom = () => {
    const randomPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
    setCurrentPrompt(randomPrompt);
  };

  const onMouseDown = (e) => {
    setDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (dragging) setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onMouseUp = () => {
      setDragging(false);
      document.body.style.userSelect = '';
    };
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  return (
    <div
      className={`chatbot-container ${isOpen ? 'open' : ''}`}
      style={isOpen ? { left: position.x, top: position.y, position: 'fixed' } : { position: 'fixed', bottom: 20, right: 20 }}
    >
      {!isOpen && (
        <button className="chatbot-toggle" onClick={() => setIsOpen(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="chatbot-window chatbot-style">
          <div className="chatbot-header" onMouseDown={onMouseDown} style={{ cursor: 'grab' }}>
            <div className="chatbot-drag-handle">
              <span className="chatbot-dot" /><span className="chatbot-dot" /><span className="chatbot-dot" />
            </div>
            <h3>Astramap</h3>
            <button className="close-button" onClick={() => setIsOpen(false)}>×</button>
          </div>

          {/* Style Presets */}
          <div className="style-presets">
            <div className="style-presets-header">Choose style:</div>
            <div className="style-presets-grid">
              {stylePresets.map((style) => (
                <div
                  key={style.id}
                  className={`style-preset ${selectedStyle?.id === style.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStyle(selectedStyle?.id === style.id ? null : style)}
                  title={style.name}
                >
                  <div className="style-image-container">
                    <img src={style.image} alt={style.name} className="style-image" />
                    <div className="style-name-overlay">{style.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="input-container">
            <textarea
              placeholder="Describe the edit you want (e.g., 'Replace the background with a beach, keep camera angle')."
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              disabled={isGenerating}
              rows={4}
              className="prompt-textarea"
            />
            <div className="button-container">
              <button type="button" onClick={handleTryRandom} className="try-random-btn" disabled={isGenerating}>
                try random
              </button>
              <button type="submit" disabled={!currentPrompt.trim() || isGenerating}>
                {isGenerating ? <div className="loading-spinner"></div> : "generate"}
              </button>
            </div>
          </form>

          <div className="messages-container">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.isBot ? 'bot' : 'user'}`}>
                {message.imageUrl && (
                  <div className="generated-image">
                    <img
                      src={message.imageUrl}
                      alt="Generated"
                      style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '8px' }}
                    />
                    {/* APPLY BUTTON ONLY */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="apply-button"
                        onClick={() => handleApply(message.imageUrl)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #666',
                          background: '#222',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
                {message.text && <div>{message.text}</div>}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
