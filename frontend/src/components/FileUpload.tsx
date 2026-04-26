import { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, X, ImageIcon, CheckCircle, Sparkles, Zap } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp'];
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.bmp';
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

const FileUpload = ({ onFileSelect, isLoading }: FileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please upload an image file (PNG, JPG, JPEG, GIF, or BMP)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 16MB';
    }
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all duration-300 ${
          dragActive
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-[1.01] shadow-lg'
            : error
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-slate-200 hover:border-blue-300 hover:bg-gradient-to-br hover:from-slate-50 hover:to-blue-50/30'
        } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          boxShadow: dragActive ? '0 0 40px rgba(59, 130, 246, 0.15)' : undefined,
        }}
      >
        <input
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          capture="environment"
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isLoading}
          aria-label="Upload lab report image"
        />

        <div className="flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 ${
              dragActive
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200'
                : 'bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200'
            }`}
          >
            <Upload
              className={`w-9 h-9 transition-all duration-300 ${
                dragActive ? 'text-white scale-110' : 'text-slate-400'
              }`}
            />
          </div>

          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            Upload your lab report
          </h3>
          <p className="text-slate-500 mb-5 max-w-sm">
            Drag and drop your glucose report image here, or click to browse your files
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>PNG, JPG, GIF, BMP</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
              <Zap className="w-3.5 h-3.5" />
              <span>Max 16MB</span>
            </div>
          </div>

          <button
            type="button"
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            Choose File
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-gradient-to-r from-rose-50 to-rose-100 border border-rose-200 rounded-xl animate-fade-in-up">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
              <X className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-rose-800 mb-0.5">Upload Error</p>
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && !error && (
        <div className="mt-5 card-elevated overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-[300px]">
                    {selectedFile.name}
                  </p>
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                    Ready
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-2.5 hover:bg-white/80 rounded-xl transition-colors"
              disabled={isLoading}
              title="Remove file"
            >
              <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
            </button>
          </div>

          {/* Image Preview */}
          {previewUrl && (
            <div className="p-5 bg-gradient-to-b from-white to-slate-50">
              <div className="relative rounded-xl overflow-hidden border border-slate-100 shadow-inner bg-white">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-72 w-full object-contain"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                  <Sparkles className="w-3.5 h-3.5" />
                  Processing with OCR
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      <p className="mt-5 text-xs text-center text-slate-400 flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
        For best results, ensure the image is clear and glucose values are visible
      </p>
    </div>
  );
};

export default FileUpload;
