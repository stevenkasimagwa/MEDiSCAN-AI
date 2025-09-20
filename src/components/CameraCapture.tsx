import { useRef, useState, useCallback } from 'react';
import { Camera as CameraPro } from 'react-camera-pro';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Circle, RotateCcw, Upload, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/apiService';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void; // Called after image is captured & confirmed (Blob)
}

export const CameraCapture = ({ onCapture }: CameraCaptureProps) => {
  const camera = useRef<CameraPro>(null);
  const [numberOfCameras, setNumberOfCameras] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleTakePhoto = useCallback(() => {
    if (!camera.current) {
      toast({ title: 'Camera not ready', description: 'Camera is not initialized or accessible', variant: 'destructive' });
      return;
    }
    try {
      const photo = camera.current.takePhoto();
      setCapturedImage(photo);
    } catch (err) {
      console.error('Take photo failed', err);
      toast({ title: 'Camera Error', description: String((err as any).message || err || 'Failed to take photo'), variant: 'destructive' });
    }
  }, []);

  const handleRetake = () => setCapturedImage(null);

    const handleUsePhoto = async () => {
      if (!capturedImage) return;
      setUploading(true);

      try {
        // Convert data URL to Blob
        const res = await fetch(capturedImage);
        const blob = await res.blob();

  // Hand the captured blob to parent; parent will perform the single upload.
  onCapture(blob);
        toast({ title: 'Image ready', description: 'Image captured and ready for processing' });
      } catch (error) {
        console.error(error);
        toast({ title: 'Upload Failed', description: 'Could not process the image', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    };

  const handleSwitchCamera = () => {
    if (camera.current && numberOfCameras > 1) {
      camera.current.switchCamera();
    }
  };

  // If a photo is captured, show preview
  if (capturedImage) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Review Captured Image
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-auto rounded-lg border max-h-96 object-contain"
            />
          </div>

          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={handleRetake} disabled={uploading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Retake
            </Button>
            <Button onClick={handleUsePhoto} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Use This Photo'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" /> Capture Medical Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
          <CameraPro
            ref={camera}
            aspectRatio={4 / 3}
            numberOfCamerasCallback={setNumberOfCameras}
            errorMessages={{
              noCameraAccessible: 'No camera accessible. Connect a camera or try a different browser.',
              permissionDenied: 'Permission denied. Allow camera access to take photos.',
              switchCamera: 'Camera switch is not supported.',
              canvas: 'Canvas is not supported.',
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button onClick={handleTakePhoto} className="sm:col-span-2" disabled={numberOfCameras === 0}>
            <Circle className="mr-2 h-4 w-4" /> {numberOfCameras === 0 ? 'No Camera' : 'Take Photo'}
          </Button>

          {numberOfCameras > 1 && (
            <Button variant="outline" onClick={handleSwitchCamera}>
              <RotateCcw className="mr-2 h-4 w-4" /> Switch
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>• Position the medical record clearly in the camera view</p>
          <p>• Ensure good lighting and avoid shadows</p>
          <p>• Keep the document flat and avoid glare</p>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Or alternatively, upload an image file</p>
          {/* Hidden file input triggered by the single Upload button so no extra UI is needed */}
          <input type="file" accept="image/*,.pdf" className="hidden" id="__md_upload_input" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploading(true);
            try {
              // Call parent with the File directly (Blob is acceptable)
              onCapture(f as Blob);
              toast({ title: 'Image ready', description: 'Image selected and ready for processing' });
            } catch (err) {
              console.error(err);
              toast({ title: 'Upload Failed', description: 'Could not process the image', variant: 'destructive' });
            } finally {
              setUploading(false);
            }
          }} />
          <label htmlFor="__md_upload_input">
            <Button asChild variant="outline">
              <span><Upload className="mr-2 h-4 w-4" /> Upload Image Instead</span>
            </Button>
          </label>
        </div>
      </CardContent>
    </Card>
  );
};
