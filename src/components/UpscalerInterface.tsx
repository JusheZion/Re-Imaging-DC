import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import * as piexif from 'piexifjs';
import { changeDpiDataUrl } from 'dpi-tools';
import { ReactCompareSlider } from 'react-compare-slider';
import { Sparkles, Upload, Download, Cpu, ImagePlus, Info, Loader2, ZoomIn, ZoomOut, Maximize, Columns, Image as ImageIcon, AlertTriangle, X, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import Tooltip from './Tooltip';
import { cn } from '../lib/utils';

const getClosestAspectRatio = (width: number, height: number) => {
  const ratio = width / height;
  const supported = [
    { name: "1:1", val: 1 },
    { name: "4:3", val: 4 / 3 },
    { name: "3:4", val: 3 / 4 },
    { name: "16:9", val: 16 / 9 },
    { name: "9:16", val: 9 / 16 },
    { name: "4:1", val: 4 / 1 },
    { name: "1:4", val: 1 / 4 },
    { name: "8:1", val: 8 / 1 },
    { name: "1:8", val: 1 / 8 },
  ];
  let closest = supported[0];
  let minDiff = Math.abs(ratio - closest.val);
  for (const s of supported) {
    const diff = Math.abs(ratio - s.val);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  return closest.name;
};

const convertImageFormat = (dataUrl: string, format: string, targetWidth?: number, targetHeight?: number, ppi: number = 72, colorProfile: string = 'sRGB'): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const finalWidth = targetWidth && targetWidth > 0 ? targetWidth : img.width;
      const finalHeight = targetHeight && targetHeight > 0 ? targetHeight : img.height;
      
      if (format === 'SVG') {
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${finalWidth}" height="${finalHeight}">
          <image href="${dataUrl}" width="${finalWidth}" height="${finalHeight}" preserveAspectRatio="none" />
        </svg>`;
        const svgBase64 = btoa(svgString);
        return resolve(`data:image/svg+xml;base64,${svgBase64}`);
      }
      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("No canvas context");
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
      let mime = 'image/png';
      if (format === 'JPEG') mime = 'image/jpeg';
      if (format === 'WEBP') mime = 'image/webp';
      
      let result = canvas.toDataURL(mime, 0.95);
      
      if (format === 'JPEG') {
         try {
           const exifObj = {
             '0th': { 
               [piexif.ImageIFD.XResolution]: [ppi, 1], 
               [piexif.ImageIFD.YResolution]: [ppi, 1], 
               [piexif.ImageIFD.ResolutionUnit]: 2
             }, 
             'Exif': { 
               [piexif.ExifIFD.ColorSpace]: colorProfile === 'sRGB' ? 1 : 65535 
             }
           }; 
           const exifStr = piexif.dump(exifObj);
           result = piexif.insert(exifStr, result);
         } catch(e) { console.error('Failed to embed EXIF:', e) }
      }
      resolve(result);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const Select = ({ options, value, onChange }: { options: string[], value: string, onChange: (v: string) => void }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(opt => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
          value === opt
            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
        )}
      >
        {opt}
      </button>
    ))}
  </div>
);

const Toggle = ({ checked, onChange, label }: { checked: boolean, onChange: (v: boolean) => void, label: string }) => (
  <label className="flex items-center justify-between cursor-pointer group">
    <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">{label}</span>
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={cn(
        "block w-10 h-6 rounded-full transition-colors duration-300",
        checked ? "bg-cyan-600" : "bg-slate-700"
      )}></div>
      <div className={cn(
        "absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300",
        checked ? "translate-x-4" : "translate-x-0"
      )}></div>
    </div>
  </label>
);

const ControlSection = ({ title, tooltip, children }: { title: string, tooltip: string, children: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-200 tracking-wide uppercase">{title}</span>
      <Tooltip content={tooltip}>
        <Info className="w-4 h-4 text-slate-500 hover:text-cyan-400 transition-colors cursor-help" />
      </Tooltip>
    </div>
    {children}
  </div>
);

const Dropzone = ({ onDrop }: { onDrop: (files: File[]) => void }) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onDrop(Array.from(e.dataTransfer.files));
        }
      }}
      className={cn(
        "w-full max-w-md aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all duration-300 cursor-pointer",
        isDragging ? "border-cyan-400 bg-cyan-400/10 scale-105" : "border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50"
      )}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <input
        id="file-upload"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onDrop(Array.from(e.target.files));
        }}
      />
      <div className="w-20 h-20 mb-6 rounded-2xl bg-slate-800 flex items-center justify-center shadow-inner">
        <ImagePlus className="w-10 h-10 text-cyan-400" />
      </div>
      <h3 className="text-xl font-semibold text-slate-200 mb-2">Initialize Image Matrix</h3>
      <p className="text-slate-400 text-sm">Drag and drop your images here, paste from clipboard, or click to browse files.</p>
    </div>
  );
};

interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  resultUrl: string | null;
  quickPreviewUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  progress: number;
  statusText: string;
}

export default function UpscalerInterface() {
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [batchSummary, setBatchSummary] = useState<{ total: number; completed: number; failed: number } | null>(null);

  const activeItem = batch[activeIndex] || null;
  const image = activeItem?.file || null;
  const previewUrl = activeItem?.previewUrl || null;
  const resultUrl = activeItem?.resultUrl || null;
  const quickPreviewUrl = activeItem?.quickPreviewUrl || null;
  const processingStatus = activeItem?.statusText || '';
  const processingProgress = activeItem?.progress || 0;
  const error = activeItem?.error || null;

  const [presetStyle, setPresetStyle] = useState('Custom');
  const [resolution, setResolution] = useState('2K');
  const [retouching, setRetouching] = useState('None');
  const [grain, setGrain] = useState('None');
  const [colorTint, setColorTint] = useState('Neutral');
  const [colorProfile, setColorProfile] = useState('sRGB');
  const [aspectRatio, setAspectRatio] = useState('Original');
  const [outputFormat, setOutputFormat] = useState('PNG');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [orientation, setOrientation] = useState('Original');
  const [ppi, setPpi] = useState(300);
  const [bitDepth, setBitDepth] = useState('8-bit');
  const [transparency, setTransparency] = useState(100);
  const [compression, setCompression] = useState('Lossless');
  const [standardizeMetadata, setStandardizeMetadata] = useState(true);
  const [targetAge, setTargetAge] = useState<number>(30);
  const [enableAgeMod, setEnableAgeMod] = useState<boolean>(false);
  const [isAutoAdjusting, setIsAutoAdjusting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'slider' | 'toggle'>('slider');
  const [toggleState, setToggleState] = useState<'original' | 'upscaled'>('upscaled');

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleAutoAdjust = async () => {
    if (!image) return;
    setIsAutoAdjusting(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(image);
      await new Promise((resolve) => { reader.onload = resolve; });
      const base64Data = (reader.result as string).split(',')[1];
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: image.type } },
            { text: "Analyze this image and provide optimal upscaling settings in JSON format. Only return the JSON. The JSON should have these keys: 'resolution' (1K, 2K, 4K), 'retouching' (None, Light, Heavy), 'grain' (None, Low, High), 'colorTint' (Neutral, Warm, Cool, Sepia)." }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      const text = response.text;
      if (text) {
        const settings = JSON.parse(text);
        if (settings.resolution) setResolution(settings.resolution);
        if (settings.retouching) setRetouching(settings.retouching);
        if (settings.grain) setGrain(settings.grain);
        if (settings.colorTint) setColorTint(settings.colorTint);
        setPresetStyle('Custom');
      }
    } catch (e) {
      console.error("Auto-adjust error", e);
    } finally {
      setIsAutoAdjusting(false);
    }
  };

  const handlePresetChange = (preset: string) => {
    setPresetStyle(preset);
    if (preset === 'Vintage') {
      setResolution('2K');
      setRetouching('Light');
      setGrain('High');
      setColorTint('Sepia');
    } else if (preset === 'Cinematic') {
      setResolution('4K');
      setRetouching('Heavy');
      setGrain('Low');
      setColorTint('Cool');
    } else if (preset === 'Anime') {
      setResolution('2K');
      setRetouching('Heavy');
      setGrain('None');
      setColorTint('Neutral');
    }
  };

  const handleManualChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPresetStyle('Custom');
  };

  useEffect(() => {
    if ((previewUrl || resultUrl || quickPreviewUrl) && previewContainerRef.current) {
      previewContainerRef.current.focus({ preventScroll: true });
      previewContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [previewUrl, resultUrl, quickPreviewUrl]);

  useEffect(() => {
    setBatch(prev => prev.map((item, idx) => idx === activeIndex ? { ...item, quickPreviewUrl: null } : item));
  }, [presetStyle, retouching, grain, colorTint, aspectRatio]);

  const handleDrop = useCallback((files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      alert('Please upload image files.');
      return;
    }
    
    const newBatchItems: BatchItem[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      resultUrl: null,
      quickPreviewUrl: null,
      status: 'pending',
      progress: 0,
      statusText: ''
    }));

    setBatch(prev => {
      if (prev.length === 0) {
        setActiveIndex(0);
      }
      return [...prev, ...newBatchItems];
    });
    
    setZoom(1);
    setViewMode('slider');
    setToggleState('upscaled');
    setBatchSummary(null);
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          e.preventDefault();
          handleDrop(imageFiles);
        }
      }
    };
    
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    
    const handleGlobalDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          e.preventDefault();
          handleDrop(imageFiles);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, [handleDrop]);


  const handleQuickPreview = async () => {
    if (!image || !previewUrl) return;
    setIsPreviewing(true);
    setBatch(prev => prev.map((item, idx) => idx === activeIndex ? { ...item, error: undefined } : item));
    
    try {
      const img = new Image();
      img.src = previewUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      let targetAspectRatio = aspectRatio;
      if (targetAspectRatio === 'Original' || targetAspectRatio === 'Custom') {
        let w = img.width;
        let h = img.height;
        if (targetAspectRatio === 'Custom' && dimensions.width > 0 && dimensions.height > 0) {
           w = dimensions.width;
           h = dimensions.height;
        }
        targetAspectRatio = getClosestAspectRatio(w, h);
      }

      const reader = new FileReader();
      reader.readAsDataURL(image);
      await new Promise((resolve) => { reader.onload = resolve; });
      const base64Data = (reader.result as string).split(',')[1];
      const mimeType = image.type;

      let promptText = "Enhance, upscale, and improve the overall quality of this image. Make it highly detailed, sharp, and high resolution.";
      
      if (presetStyle === 'Vintage') promptText += " Apply a vintage, retro aesthetic, like an old film photograph.";
      if (presetStyle === 'Cinematic') promptText += " Apply a cinematic, dramatic movie-like aesthetic with moody lighting.";
      if (presetStyle === 'Anime') promptText += " Convert the image into a high-quality anime or manga art style.";

      if (retouching === 'Light') promptText += " Apply light retouching, smooth out minor imperfections, improve lighting and color balance.";
      if (retouching === 'Heavy') promptText += " Apply heavy professional retouching, make it look flawless, cinematic, and highly polished.";

      if (grain === 'Low') promptText += " Add a subtle, fine film grain.";
      if (grain === 'High') promptText += " Add a heavy, noticeable vintage film grain.";

      if (colorTint === 'Warm') promptText += " Apply a warm, golden color tint.";
      if (colorTint === 'Cool') promptText += " Apply a cool, blue/teal color tint.";
      if (colorTint === 'Sepia') promptText += " Apply a sepia tone color tint.";

      if (enableAgeMod) {
        promptText += ` Accurately modify the subject to appear exactly ${targetAge} years old, maintaining their core identity but applying realistic aging or de-aging effects for that specific age.`;
      }

      if (dimensions.width > 0 && dimensions.height > 0) promptText += ` Target exact dimensions: ${dimensions.width}px by ${dimensions.height}px.`;
      if (orientation !== 'Original') promptText += ` Change orientation to ${orientation}.`;
      if (colorProfile !== 'sRGB') promptText += ` Apply ${colorProfile} color profile.`;
      promptText += ` Ensure metadata is set to ${ppi} PPI resolution.`;
      promptText += ` Ensure output bit depth is ${bitDepth}.`;
      if (transparency < 100) promptText += ` Set image transparency/opacity to ${transparency}%.`;
      if (compression !== 'Lossless') promptText += ` Apply ${compression} compression.`;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            { text: promptText }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: targetAspectRatio,
            imageSize: '512px'
          }
        }
      });

      let outputBase64 = '';
      let outputText = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          outputBase64 = part.inlineData.data;
          break;
        }
        if (part.text) {
          outputText += part.text + ' ';
        }
      }

      if (!outputBase64) {
        throw new Error(`No image generated. Response: ${JSON.stringify(response)}`);
      }

      let finalUrl = await convertImageFormat(`data:image/jpeg;base64,${outputBase64}`, 'JPEG', aspectRatio === 'Custom' ? dimensions.width : undefined, aspectRatio === 'Custom' ? dimensions.height : undefined, ppi, colorProfile);
      if (ppi !== 72) {
        try {
          finalUrl = changeDpiDataUrl(finalUrl, ppi);
        } catch (e) {
          console.warn('Failed to apply DPI to preview:', e);
        }
      }
      
      setBatch(prev => prev.map((item, idx) => 
        idx === activeIndex ? { ...item, quickPreviewUrl: finalUrl, resultUrl: null, error: undefined } : item
      ));

    } catch (err: any) {
      console.error("Preview error:", err);
      const errorMessage = err?.message || String(err);
      let userFriendlyMessage = "An unexpected error occurred during preview generation. Please try again.";

      if (errorMessage.includes("API key not valid") || errorMessage.includes("401") || errorMessage.includes("403")) {
        userFriendlyMessage = "Authentication failed. Please check your Gemini API key in the settings.";
      } else if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        userFriendlyMessage = "You have exceeded your API quota. Please try again later or check your billing details.";
      } else if (errorMessage.includes("503") || errorMessage.includes("500") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("INTERNAL")) {
        userFriendlyMessage = "The Gemini AI service is currently experiencing high demand or instability. Please try again in a few minutes.";
      } else if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
        userFriendlyMessage = "The image was blocked by safety filters. Please try a different image.";
      } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
        userFriendlyMessage = "A network error occurred. Please check your internet connection and try again.";
      } else if (errorMessage.includes("IMAGE_OTHER")) {
        userFriendlyMessage = "The AI refused to generate this image. This often happens if the image contains people/faces, which is currently restricted, or if it violates safety guidelines.";
      } else if (errorMessage.includes("No image generated")) {
        userFriendlyMessage = "The AI successfully processed the request but returned no image data. Please try adjusting the prompt or settings.";
      }

      setBatch(prev => prev.map((item, idx) => 
        idx === activeIndex ? { ...item, error: userFriendlyMessage } : item
      ));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleProcess = async () => {
    if (batch.length === 0) return;
    setIsProcessing(true);
    setBatchSummary(null);

    let completedCount = 0;
    let failedCount = 0;

    const processItem = async (currentItem: BatchItem, i: number) => {
      if (currentItem.status === 'completed') {
        completedCount++;
        return;
      }

      const updateItem = (updates: Partial<BatchItem>) => {
        setBatch(prev => prev.map(item => item.id === currentItem.id ? { ...item, ...updates } : item));
      };

      updateItem({ status: 'processing', statusText: 'Initializing neural link...', progress: 5, error: undefined, quickPreviewUrl: null });
      
      let progressInterval: NodeJS.Timeout | null = null;

      try {
        const img = new Image();
        img.src = currentItem.previewUrl;
        await new Promise((resolve) => { img.onload = resolve; });

        let targetAspectRatio = aspectRatio;
        if (targetAspectRatio === 'Original' || targetAspectRatio === 'Custom') {
          let w = img.width;
          let h = img.height;
          if (targetAspectRatio === 'Custom' && dimensions.width > 0 && dimensions.height > 0) {
             w = dimensions.width;
             h = dimensions.height;
          }
          targetAspectRatio = getClosestAspectRatio(w, h);
        }

        updateItem({ statusText: 'Analyzing image matrix...', progress: 15 });

        const reader = new FileReader();
        reader.readAsDataURL(currentItem.file);
        await new Promise((resolve) => { reader.onload = resolve; });
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = currentItem.file.type;

        let promptText = "Enhance, upscale, and improve the overall quality of this image. Make it highly detailed, sharp, and high resolution.";
        
        if (presetStyle === 'Vintage') promptText += " Apply a vintage, retro aesthetic, like an old film photograph.";
        if (presetStyle === 'Cinematic') promptText += " Apply a cinematic, dramatic movie-like aesthetic with moody lighting.";
        if (presetStyle === 'Anime') promptText += " Convert the image into a high-quality anime or manga art style.";

        if (retouching === 'Light') promptText += " Apply light retouching, smooth out minor imperfections, improve lighting and color balance.";
        if (retouching === 'Heavy') promptText += " Apply heavy professional retouching, make it look flawless, cinematic, and highly polished.";

        if (grain === 'Low') promptText += " Add a subtle, fine film grain.";
        if (grain === 'High') promptText += " Add a heavy, noticeable vintage film grain.";

        if (colorTint === 'Warm') promptText += " Apply a warm, golden color tint.";
        if (colorTint === 'Cool') promptText += " Apply a cool, blue/teal color tint.";
        if (colorTint === 'Sepia') promptText += " Apply a sepia tone color tint.";

        if (enableAgeMod) {
          promptText += ` Accurately modify the subject to appear exactly ${targetAge} years old, maintaining their core identity but applying realistic aging or de-aging effects for that specific age.`;
        }

        if (dimensions.width > 0 && dimensions.height > 0) promptText += ` Target exact dimensions: ${dimensions.width}px by ${dimensions.height}px.`;
        if (orientation !== 'Original') promptText += ` Change orientation to ${orientation}.`;
        if (colorProfile !== 'sRGB') promptText += ` Apply ${colorProfile} color profile.`;
        promptText += ` Ensure metadata is set to ${ppi} PPI resolution.`;
        promptText += ` Ensure output bit depth is ${bitDepth}.`;
        if (transparency < 100) promptText += ` Set image transparency/opacity to ${transparency}%.`;
        if (compression !== 'Lossless') promptText += ` Apply ${compression} compression.`;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

        updateItem({ statusText: 'Transmitting to Gemini core...', progress: 30 });

        progressInterval = setInterval(() => {
          setBatch(prev => prev.map(item => {
            if (item.id === currentItem.id && item.progress < 85) {
              return { ...item, progress: item.progress + (85 - item.progress) * 0.1 };
            }
            return item;
          }));
        }, 500);

        let response;
        let retries = 0;
        const maxRetries = 3;
        let delay = 2000;

        while (true) {
          try {
            response = await ai.models.generateContent({
              model: 'gemini-3.1-flash-image-preview',
              contents: {
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: mimeType
                    }
                  },
                  { text: promptText }
                ]
              },
              config: {
                imageConfig: {
                  aspectRatio: targetAspectRatio,
                  imageSize: resolution
                }
              }
            });
            break;
          } catch (error: any) {
            const errorMessage = error?.message || String(error);
            if (retries < maxRetries && (errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('high demand') || errorMessage.includes('500') || errorMessage.includes('INTERNAL') || errorMessage.includes('429'))) {
              updateItem({ statusText: `Network instability detected. Retrying in ${delay / 1000}s...` });
              await new Promise(res => setTimeout(res, delay));
              retries++;
              delay *= 2;
              updateItem({ statusText: `Retransmitting to Gemini core (Attempt ${retries + 1})...` });
            } else {
              throw error;
            }
          }
        }

        if (progressInterval) clearInterval(progressInterval);
        updateItem({ statusText: 'Decoding enhanced visual data...', progress: 90 });

        let outputBase64 = '';
        let outputText = '';
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            outputBase64 = part.inlineData.data;
            break;
          }
          if (part.text) {
            outputText += part.text + ' ';
          }
        }

        if (!outputBase64) {
          throw new Error(`No image generated. Response: ${JSON.stringify(response)}`);
        }

        updateItem({ statusText: 'Finalizing output format...', progress: 95 });

        let finalUrl = await convertImageFormat(`data:image/jpeg;base64,${outputBase64}`, outputFormat, aspectRatio === 'Custom' ? dimensions.width : undefined, aspectRatio === 'Custom' ? dimensions.height : undefined, ppi, colorProfile);
        if (ppi !== 72 && (outputFormat === 'PNG' || outputFormat === 'JPEG')) {
          try {
            finalUrl = changeDpiDataUrl(finalUrl, ppi);
          } catch (e) {
            console.warn('Failed to apply DPI:', e);
          }
        }
        
        updateItem({ resultUrl: finalUrl, progress: 100, statusText: 'Enhancement complete', status: 'completed' });
        completedCount++;

      } catch (err: any) {
        if (progressInterval) clearInterval(progressInterval);
        console.error("Processing error:", err);
        
        const errorMessage = err?.message || String(err);
        let userFriendlyMessage = "An unexpected error occurred during processing. Please try again.";

        if (errorMessage.includes("API key not valid") || errorMessage.includes("401") || errorMessage.includes("403")) {
          userFriendlyMessage = "Authentication failed. Please check your Gemini API key in the settings.";
        } else if (errorMessage.includes("429") || errorMessage.includes("quota")) {
          userFriendlyMessage = "You have exceeded your API quota. Please try again later or check your billing details.";
        } else if (errorMessage.includes("503") || errorMessage.includes("500") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("INTERNAL")) {
          userFriendlyMessage = "The Gemini AI service is currently experiencing high demand or instability. Please try again in a few minutes.";
        } else if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
          userFriendlyMessage = "The image was blocked by safety filters. Please try a different image.";
        } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
          userFriendlyMessage = "A network error occurred. Please check your internet connection and try again.";
        } else if (errorMessage.includes("IMAGE_OTHER")) {
          userFriendlyMessage = "The AI refused to generate this image. This often happens if the image contains people/faces, which is currently restricted, or if it violates safety guidelines.";
        } else if (errorMessage.includes("No image generated")) {
          userFriendlyMessage = "The AI successfully processed the request but returned no image data. Please try adjusting the prompt or settings.";
        }

        updateItem({ error: userFriendlyMessage, status: 'error', statusText: 'Error', progress: 0 });
        failedCount++;
      }
    };

    const promises = batch.map((item, i) => processItem(item, i));
    await Promise.all(promises);

    setIsProcessing(false);
    setBatchSummary({ total: batch.length, completed: completedCount, failed: failedCount });
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `cyberscale_${Date.now()}.${outputFormat.toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col-reverse md:flex-row h-full w-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-80 shrink-0 bg-slate-900/40 backdrop-blur-2xl border-t md:border-t-0 md:border-r border-cyan-500/20 p-4 md:p-6 flex flex-col gap-6 md:gap-8 h-[45%] md:h-full overflow-y-auto custom-scrollbar z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
            CyberScale
          </h1>
        </div>

        <div className="flex flex-col gap-8">
          <ControlSection title="Preset Styles" tooltip="Quickly apply a predefined aesthetic. Automatically adjusts resolution, retouching, grain, and color tint.">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select options={['Custom', 'Vintage', 'Cinematic', 'Anime']} value={presetStyle} onChange={handlePresetChange} />
              </div>
              <Tooltip content="Intelligently analyze the image and apply optimal settings">
                <button 
                  onClick={handleAutoAdjust} 
                  disabled={!image || isAutoAdjusting} 
                  className="p-2 border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isAutoAdjusting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cpu className="w-5 h-5" />}
                </button>
              </Tooltip>
            </div>
          </ControlSection>

          <ControlSection title="Subject Age" tooltip="Adjust the apparent age of the subject. Only works on human subjects.">
            <Toggle checked={enableAgeMod} onChange={setEnableAgeMod} label="Enable Age Modification" />
            {enableAgeMod && (
              <div className="mt-3 flex items-center gap-3">
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={targetAge} 
                  onChange={(e) => setTargetAge(Number(e.target.value))}
                  className="flex-1 accent-cyan-500"
                />
                <span className="text-slate-300 font-mono text-sm w-6 text-right">{targetAge}</span>
              </div>
            )}
          </ControlSection>

          <ControlSection title="Resolution" tooltip="Higher resolutions (4K) provide maximum detail but take longer to process and result in larger file sizes.">
            <Select options={['1K', '2K', '4K']} value={resolution} onChange={handleManualChange(setResolution)} />
          </ControlSection>

          <ControlSection title="Retouching" tooltip="Light smooths minor imperfections. Heavy creates a flawless, cinematic look but may alter original facial features or details.">
            <Select options={['None', 'Light', 'Heavy']} value={retouching} onChange={handleManualChange(setRetouching)} />
          </ControlSection>

          <ControlSection title="Grain" tooltip="Adds film grain to the image for a more textured, cinematic, or vintage look.">
            <Select options={['None', 'Low', 'High']} value={grain} onChange={handleManualChange(setGrain)} />
          </ControlSection>

          <ControlSection title="Color Tint" tooltip="Applies a color grade to the image to change its mood and atmosphere.">
            <Select options={['Neutral', 'Warm', 'Cool', 'Sepia']} value={colorTint} onChange={handleManualChange(setColorTint)} />
          </ControlSection>

          <ControlSection title="Aspect Ratio" tooltip="Changes the dimensions of the output image. The AI will intelligently fill in or crop the image to match the selected ratio.">
            <Select options={['Original', 'Custom', '1:1', '16:9', '9:16', '4:3', '3:4']} value={aspectRatio} onChange={(val) => {
              setAspectRatio(val);
              if (val !== 'Custom') {
                setDimensions({ width: 0, height: 0 });
              }
            }} />
          </ControlSection>

          <ControlSection title="Orientation" tooltip="Adjust the image orientation.">
            <Select options={['Original', 'Landscape', 'Portrait', 'Square']} value={orientation} onChange={handleManualChange(setOrientation)} />
          </ControlSection>

          <ControlSection title="Dimensions (px)" tooltip="Explicit dimensions in pixels. Leave at 0 to use selected resolution.">
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={dimensions.width || ''} onChange={(e) => {
                setDimensions(d => ({ ...d, width: parseInt(e.target.value) || 0 }));
                setAspectRatio('Custom');
              }} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-cyan-500" placeholder="Width" />
              <span className="text-slate-500">x</span>
              <input type="number" min="0" value={dimensions.height || ''} onChange={(e) => {
                setDimensions(d => ({ ...d, height: parseInt(e.target.value) || 0 }));
                setAspectRatio('Custom');
              }} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-cyan-500" placeholder="Height" />
            </div>
          </ControlSection>

          <ControlSection title="Color Profile" tooltip="Select the color space for the output image.">
            <Select options={['sRGB', 'Adobe RGB', 'Display P3', 'ProPhoto RGB']} value={colorProfile} onChange={setColorProfile} />
          </ControlSection>

          <ControlSection title="Output Format" tooltip="PNG preserves maximum quality. JPEG provides smaller file sizes. WEBP offers a modern balance of quality and compression. SVG encapsulates the image.">
            <Select options={['PNG', 'JPEG', 'WEBP', 'SVG']} value={outputFormat} onChange={setOutputFormat} />
          </ControlSection>

          <ControlSection title="Compression" tooltip="Set the compression level for output formats that support it.">
            <Select options={['Lossless', 'High', 'Medium', 'Low']} value={compression} onChange={setCompression} />
          </ControlSection>

          <ControlSection title="Resolution (PPI)" tooltip="Set the PPI metadata for the output image (min 300).">
             <div className="flex items-center gap-3 mt-1">
                <input 
                  type="range" 
                  min="300" 
                  max="1200" 
                  step="1"
                  value={ppi} 
                  onChange={(e) => setPpi(parseInt(e.target.value))}
                  className="flex-1 accent-cyan-500"
                />
                <span className="text-slate-300 font-mono text-sm w-12 text-right">{ppi}</span>
              </div>
          </ControlSection>

          <ControlSection title="Bit Depth" tooltip="Set bits per channel.">
            <Select options={['8-bit', '16-bit', '32-bit']} value={bitDepth} onChange={setBitDepth} />
          </ControlSection>

          <ControlSection title="Transparency" tooltip="Adjust the image transparency percentage (0-100%).">
             <div className="flex items-center gap-3 mt-1">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="1"
                  value={transparency} 
                  onChange={(e) => setTransparency(parseInt(e.target.value))}
                  className="flex-1 accent-cyan-500"
                />
                <span className="text-slate-300 font-mono text-sm w-12 text-right">{transparency}%</span>
              </div>
          </ControlSection>

          <ControlSection title="Metadata" tooltip="Removes location data, camera settings, and other hidden EXIF metadata from the final image to protect your privacy.">
            <Toggle checked={standardizeMetadata} onChange={setStandardizeMetadata} label="Fidelity & Privacy Mode" />
          </ControlSection>
        </div>

        <div className="mt-auto pt-6 flex flex-col gap-3">
          <button
            onClick={handleQuickPreview}
            disabled={!image || isProcessing || isPreviewing}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 border border-slate-700"
          >
            {isPreviewing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Preview...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-400" />
                Quick Preview (512px)
              </>
            )}
          </button>
          <button
            onClick={handleProcess}
            disabled={!image || isProcessing || isPreviewing}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl font-medium transition-all duration-200 shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.6)] disabled:shadow-none flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing Matrix...
              </>
            ) : (
              <>
                <Cpu className="w-5 h-5" />
                Initialize Upscale
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 p-2 md:p-6 flex flex-col h-[55%] md:h-full overflow-hidden relative z-10">
        {batchSummary && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mb-4 bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-xl flex items-center justify-between"
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-200">Batch Processing Complete</h3>
              <p className="text-sm text-slate-400 mt-1">
                Processed {batchSummary.total} images. {batchSummary.completed} successful, {batchSummary.failed} failed.
              </p>
            </div>
            <button 
              onClick={() => setBatchSummary(null)}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        <div className="flex-1 bg-slate-900/30 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden relative flex items-center justify-center shadow-2xl">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/50 backdrop-blur-xl text-red-200 px-4 md:px-5 py-3 md:py-4 rounded-2xl shadow-2xl flex items-start gap-3 max-w-lg w-[calc(100%-2rem)] md:w-[calc(100%-3rem)]"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-300 mb-1">Processing Error</h4>
                <p className="text-sm leading-relaxed">{error}</p>
              </div>
              <button 
                onClick={() => setBatch(prev => prev.map((item, idx) => idx === activeIndex ? { ...item, error: undefined } : item))} 
                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors shrink-0 -mt-1 -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          
          {isProcessing && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px] p-4 pointer-events-none">
            </div>
          )}
          {batch.length === 0 ? (
            <Dropzone onDrop={handleDrop} />
          ) : (
            <div className="w-full h-full flex flex-col md:flex-row">
              {/* Batch List Sidebar */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-700/50 bg-slate-900/50 flex flex-col h-48 md:h-full shrink-0">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
                  <h3 className="text-sm font-semibold text-slate-200">Batch Queue ({batch.length})</h3>
                  <button 
                    onClick={() => document.getElementById('batch-upload')?.click()}
                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                    title="Add more images"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </button>
                  <input
                    id="batch-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) handleDrop(Array.from(e.target.files));
                    }}
                  />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2">
                  {batch.map((item, idx) => (
                    <div 
                      key={item.id}
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all duration-200 border",
                        activeIndex === idx 
                          ? "bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                          : "bg-slate-800/30 border-transparent hover:bg-slate-800/60 hover:border-slate-700"
                      )}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-900 relative">
                        <img src={item.previewUrl} alt="thumbnail" className="w-full h-full object-cover" />
                        {item.status === 'completed' && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          </div>
                        )}
                        {item.status === 'error' && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center backdrop-blur-[1px]">
                            <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow-md" />
                          </div>
                        )}
                        {item.status === 'processing' && (
                          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-[1px]">
                            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{item.file.name}</p>
                        <p className={cn(
                          "text-[10px] truncate mt-0.5",
                          item.status === 'completed' ? "text-green-400" :
                          item.status === 'error' ? "text-red-400" :
                          item.status === 'processing' ? "text-cyan-400" :
                          "text-slate-500"
                        )}>
                          {item.status === 'processing' ? `${Math.round(item.progress)}% - ${item.statusText}` : 
                           item.status === 'completed' ? 'Enhanced' : 
                           item.status === 'error' ? 'Failed' : 'Pending'}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setBatch(prev => prev.filter((_, i) => i !== idx));
                          if (activeIndex >= idx && activeIndex > 0) setActiveIndex(activeIndex - 1);
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                        title="Remove from batch"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {batch.length > 0 && (
                  <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                    <button 
                      onClick={() => { setBatch([]); setActiveIndex(0); setBatchSummary(null); }}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-3 h-3" />
                      Clear Batch
                    </button>
                  </div>
                )}
              </div>

              {/* Active Image Preview */}
              <div 
                ref={previewContainerRef}
                tabIndex={-1}
                className="flex-1 flex items-center justify-center p-4 relative outline-none min-h-0"
              >
                {resultUrl || quickPreviewUrl ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full overflow-auto custom-scrollbar rounded-lg relative">
                    <div 
                      className="transition-all duration-300 flex items-center justify-center"
                      style={{ 
                        width: `${zoom * 100}%`, 
                        height: `${zoom * 100}%`,
                        minWidth: '100%',
                        minHeight: '100%'
                      }}
                    >
                      {viewMode === 'slider' ? (
                        <ReactCompareSlider
                          itemOne={<img src={previewUrl!} alt="Original" className="w-full h-full object-contain pointer-events-none" />}
                          itemTwo={<img src={(resultUrl || quickPreviewUrl)!} alt="Upscaled" className="w-full h-full object-contain pointer-events-none" />}
                          className="w-full h-full"
                        />
                      ) : (
                        <img 
                          src={toggleState === 'original' ? previewUrl! : (resultUrl || quickPreviewUrl)!} 
                          alt={toggleState === 'original' ? "Original" : "Upscaled"} 
                          className="w-full h-full object-contain pointer-events-none" 
                        />
                      )}
                    </div>
                    {quickPreviewUrl && !resultUrl && (
                      <div className="absolute top-4 right-4 bg-amber-500/20 border border-amber-500/50 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md z-10 shadow-lg flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        Low-Res Preview
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.img
                    key={activeItem?.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={previewUrl!}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                )}

                {/* Floating Action Bar */}
                <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 md:gap-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700 p-1.5 md:p-2 rounded-2xl shadow-2xl z-50 w-max max-w-[95vw] overflow-x-auto custom-scrollbar">
                  {(resultUrl || quickPreviewUrl) && (
                    <>
                      {/* View Mode Controls */}
                      <div className="flex items-center bg-slate-800/50 rounded-xl p-1 border border-slate-700/50 shrink-0">
                        <Tooltip content="Slider View">
                          <button onClick={() => setViewMode('slider')} className={cn("p-1.5 md:p-2 rounded-lg transition-colors", viewMode === 'slider' ? "bg-slate-700 text-cyan-400 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800")}>
                            <Columns className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Toggle View">
                          <button onClick={() => setViewMode('toggle')} className={cn("p-1.5 md:p-2 rounded-lg transition-colors", viewMode === 'toggle' ? "bg-slate-700 text-cyan-400 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800")}>
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </div>

                      {viewMode === 'toggle' && (
                        <div className="flex items-center bg-slate-800/50 rounded-xl p-1 border border-slate-700/50 shrink-0">
                          <button onClick={() => setToggleState('original')} className={cn("px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-medium rounded-lg transition-colors", toggleState === 'original' ? "bg-slate-700 text-cyan-400 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800")}>Before</button>
                          <button onClick={() => setToggleState('upscaled')} className={cn("px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-medium rounded-lg transition-colors", toggleState === 'upscaled' ? "bg-slate-700 text-cyan-400 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800")}>After</button>
                        </div>
                      )}

                      <div className="h-6 md:h-8 w-px bg-slate-700 mx-0.5 md:mx-1 shrink-0"></div>
                      <Tooltip content="Zoom Out">
                        <button onClick={() => setZoom(z => Math.max(z - 0.5, 1))} disabled={zoom <= 1} className="p-2 md:p-2.5 hover:bg-slate-800 disabled:opacity-50 rounded-xl text-slate-300 transition-colors shrink-0">
                          <ZoomOut className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </Tooltip>
                      <div className="text-[10px] md:text-xs font-mono text-slate-400 w-8 md:w-10 text-center select-none shrink-0">
                        {Math.round(zoom * 100)}%
                      </div>
                      <Tooltip content="Zoom In">
                        <button onClick={() => setZoom(z => Math.min(z + 0.5, 4))} disabled={zoom >= 4} className="p-2 md:p-2.5 hover:bg-slate-800 disabled:opacity-50 rounded-xl text-slate-300 transition-colors shrink-0">
                          <ZoomIn className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Reset Zoom">
                        <button onClick={() => setZoom(1)} disabled={zoom === 1} className="p-2 md:p-2.5 hover:bg-slate-800 disabled:opacity-50 rounded-xl text-slate-300 transition-colors shrink-0">
                          <Maximize className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </Tooltip>
                      
                      {resultUrl && (
                        <>
                          <div className="h-6 md:h-8 w-px bg-slate-700 mx-0.5 md:mx-1 shrink-0"></div>
                          <Tooltip content="Download Result">
                            <button onClick={handleDownload} className="p-2 md:p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-colors flex items-center gap-1 md:gap-2 px-3 md:px-4 shrink-0">
                              <Download className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="font-medium text-[10px] md:text-sm hidden sm:inline">Save</span>
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
