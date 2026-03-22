declare module '@yesdevs/react-native-perspective-image-cropper' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  export interface CropperProps extends ViewProps {
    image: string;
    initialImage?: string;
    onCrop?: (data: { image: string }) => void;
    // Add other props as needed based on library docs
  }

  export default class Cropper extends Component<CropperProps> {
    static crop: (path: string, points?: any) => Promise<string>;
  }
}

declare module 'vision-camera-ocr' {
  export function scanOCR(frame: any): any;
}
