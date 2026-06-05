declare module "world-atlas/countries-110m.json" {
  const value: unknown;
  export default value;
}

declare module "react-simple-maps" {
  import * as React from "react";

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }
  export const ComposableMap: React.FC<ComposableMapProps>;

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    onMoveStart?: (args: { coordinates: [number, number]; zoom: number }) => void;
    onMove?: (args: { x: number; y: number; k: number; dragging: boolean }) => void;
    onMoveEnd?: (args: { coordinates: [number, number]; zoom: number }) => void;
    children?: React.ReactNode;
  }
  export const ZoomableGroup: React.FC<ZoomableGroupProps>;

  export interface GeographiesProps {
    geography: string | object;
    children: (args: { geographies: Geography[] }) => React.ReactNode;
  }
  export const Geographies: React.FC<GeographiesProps>;

  export interface Geography {
    rsmKey: string;
    id: string | number;
    properties: Record<string, unknown>;
  }

  export interface GeographyStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
    cursor?: string;
  }

  export interface GeographyProps {
    geography: Geography;
    style?: { default?: GeographyStyle; hover?: GeographyStyle; pressed?: GeographyStyle };
    onClick?: (event: React.MouseEvent) => void;
    onMouseMove?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
  }
  export const Geography: React.FC<GeographyProps>;
}
