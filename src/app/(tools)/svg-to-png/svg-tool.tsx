"use client";
import { usePlausible } from "next-plausible";
import { useEffect, useMemo, useState } from "react";

import { ChangeEvent } from "react";

type Scale = 1 | 2 | 4 | 8 | 16 | 32 | 64;

function scaleSvg(svgContent: string, scale: Scale, sWidth: number, sHeight: number) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgElement = svgDoc.documentElement;
  const width = parseInt(svgElement.getAttribute("width") || "300");
  const height = parseInt(svgElement.getAttribute("height") || "150");
  let scaledWidth = width;
  let scaledHeight = height;
  if (sWidth && sHeight) {
    scaledWidth = sWidth;
    scaledHeight = sHeight;
  } else {
    scaledWidth = width * scale;
    scaledHeight = height * scale;
  }
  svgElement.setAttribute("width", scaledWidth.toString());
  svgElement.setAttribute("height", scaledHeight.toString());

  console.log(scaledWidth, scaledHeight);
  return new XMLSerializer().serializeToString(svgDoc);
}

function useSvgConverter(props: {
  canvas: HTMLCanvasElement | null;
  svgContent: string;
  scale: Scale;
  sHeight: number;
  sWidth: number;
  fileName?: string;
  imageMetadata: { width: number; height: number; name: string };
}) {
  const { width, height, scaledSvg } = useMemo(() => {
    const scaledSvg = scaleSvg(props.svgContent, props.scale, props.sWidth, props.sHeight);

    return {
      width: props.imageMetadata.width * (props.sWidth || props.scale),
      height: props.imageMetadata.height * (props.sHeight || props.scale),
      scaledSvg,
    };
  }, [props.svgContent, props.scale, props.imageMetadata, props.sWidth, props.sHeight]);

  const convertToPng = async () => {
    const ctx = props.canvas?.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    // Trigger a "save image" of the resulting canvas content
    const saveImage = () => {
      if (props.canvas) {
        const dataURL = props.canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataURL;
        const svgFileName = props.imageMetadata.name ?? "svg_converted";

        // Remove the .svg extension
        props.sWidth == 0 ?
          link.download = `${svgFileName.replace(".svg", "")}-${props.scale}x.png` :
          link.download = `${svgFileName.replace(".svg", "")}-${props.sWidth}x${props.sHeight}.png`;
        link.click();
      }
    };

    const img = new Image();
    // Call saveImage after the image has been drawn
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      saveImage();
    };

    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scaledSvg)}`;
  };

  return {
    convertToPng,
    canvasProps: { width: props.sWidth || width, height: props.sHeight || height },
  };
}

export const useFileUploader = () => {
  const [svgContent, setSvgContent] = useState<string>("");

  const [imageMetadata, setImageMetadata] = useState<{
    width: number;
    height: number;
    name: string;
  } | null>(null);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;

        // Extract width and height from SVG content
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(content, "image/svg+xml");
        const svgElement = svgDoc.documentElement;
        const width = parseInt(svgElement.getAttribute("width") || "300");
        const height = parseInt(svgElement.getAttribute("height") || "150");

        setSvgContent(content);
        setImageMetadata({ width, height, name: file.name });
      };
      reader.readAsText(file);
    }
  };

  const cancel = () => {
    setSvgContent("");
    setImageMetadata(null);
  };

  return { svgContent, imageMetadata, handleFileUpload, cancel };
};

import React from "react";

interface SVGRendererProps {
  svgContent: string;
}

const SVGRenderer: React.FC<SVGRendererProps> = ({ svgContent }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = svgContent;
      const svgElement = containerRef.current.querySelector("svg");
      if (svgElement) {
        svgElement.setAttribute("width", "100%");
        svgElement.setAttribute("height", "auto");
      }
    }
  }, [svgContent]);

  return <div ref={containerRef} />;
};

function SaveAsPngButton({
  svgContent,
  scale,
  height,
  width,
  imageMetadata,
}: {
  svgContent: string;
  scale: Scale;
  height: number;
  width: number;
  imageMetadata: { width: number; height: number; name: string };
}) {
  const [canvasRef, setCanvasRef] = React.useState<HTMLCanvasElement | null>(
    null
  );
  const { convertToPng, canvasProps } = useSvgConverter({
    canvas: canvasRef,
    svgContent,
    scale,
    sHeight: height,
    sWidth: width,
    imageMetadata,
  });

  const plausible = usePlausible();

  return (
    <div>
      <canvas ref={setCanvasRef} {...canvasProps} hidden />
      <button
        onClick={() => {
          plausible("convert-svg-to-png");
          convertToPng();
        }}
        className="px-4 py-2 bg-green-700 text-sm text-white font-semibold rounded-lg shadow-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition-colors duration-200"
      >
        Save as PNG
      </button>
    </div>
  );
}

export function SVGTool() {
  const { svgContent, imageMetadata, handleFileUpload, cancel } =
    useFileUploader();

  const [isCustom, setCustom] = useState<boolean>(false);
  const [scale, setScale] = useState<Scale>(1);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);

  if (!imageMetadata)
    return (
      <div className="flex flex-col p-4 gap-4">
        <p className="text-center">
          Make SVGs into PNGs. Also makes them bigger. (100% free btw.)
        </p>
        <div className="flex justify-center">
          <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors duration-200 gap-2">
            <span>Upload SVG</span>
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".svg"
              className="hidden"
            />
          </label>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col p-4 gap-4 justify-center items-center text-2xl">
      <SVGRenderer svgContent={svgContent} />
      <p>{imageMetadata.name}</p>
      <p>
        Original size: {imageMetadata.width}px x {imageMetadata.height}px
      </p>
      <p>
        Scaled size: {imageMetadata.width * scale}px x{" "}
        {imageMetadata.height * scale}px
      </p>
      {isCustom && (
        <div className="flex gap-2">
          <div>
            <label>Width: </label>
            <input className="text-black w-20 border-none outline-none p-2 h-9 rounded-md" value={width} onChange={(e) => {
              if (!isNaN(Number(e.target.value))) {
                setWidth(Number(e.target.value));
              }
            }} /> px
          </div>
          <div>
            <label>Height: </label>
            <input className="text-black w-20 border-none outline-none p-2 h-9 rounded-md" value={height} onChange={(e) => {
              if (!isNaN(Number(e.target.value))) {
                setHeight(Number(e.target.value));
              }
            }} /> px
          </div>
        </div>)
      }

      {!isCustom && (
        <div className="flex gap-2">
          {([1, 2, 4, 8, 16, 32, 64] as Scale[]).map((value) => (
            <button
              key={value}
              onClick={() => { setScale(value); setHeight(0); setWidth(0) }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${scale === value
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
            >
              {value}x
            </button>
          ))}
        </div>)
      }
      <div className="flex gap-2">
        <button
          onClick={() => setCustom(!isCustom)}
          className="px-3 py-1 rounded-md text-sm font-medium bg-blue-700 text-white hover:bg-blue-800 transition-colors"
        >
          {!isCustom ? "Custom scale" : "Exponential Scale"}
        </button>
        <SaveAsPngButton
          svgContent={svgContent}
          scale={scale}
          height={height}
          width={width}
          imageMetadata={imageMetadata}
        />
        <button
          onClick={cancel}
          className="px-3 py-1 rounded-md text-sm font-medium bg-red-700 text-white hover:bg-red-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>

  );
}
