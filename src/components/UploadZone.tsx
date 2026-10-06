import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Camera,
  Sparkles,
  Image as ImageIcon,
  ClipboardPaste,
  Keyboard,
  Monitor,
  Trash2,
  Check,
  Building2,
  FolderUp,
  Layers,
} from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[], sourceLabel?: string) => void;
  isAnalyzing: boolean;
  onPasteFromClipboard?: () => void;
  currentRoom?: string;
  onUpdateRoom?: (room: string) => void;
  onOpenDirectScreenCapture?: () => void;
}

const COMMON_ROOMS = [
  'Accuprep 분주실',
  '무균충전실',
  '조제실',
  '무균시험실',
  '세척실',
  '원료칭량실',
  '배양실',
];

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  isAnalyzing,
  onPasteFromClipboard,
  currentRoom = 'Accuprep 분주실',
  onUpdateRoom,
  onOpenDirectScreenCapture,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotFileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Staged captures for multi-capture tray
  const [stagedFiles, setStagedFiles] = useState<{ id: string; file: File; preview: string }[]>([]);
  const [autoUploadImmediate, setAutoUploadImmediate] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const addFilesToStaging = (files: File[], source: string = '캡쳐본') => {
    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (autoUploadImmediate) {
      onFilesSelected(validFiles, source);
      return;
    }

    const newEntries = validFiles.map((file, idx) => ({
      id: `staged-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setStagedFiles((prev) => [...prev, ...newEntries]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files) as File[];
      addFilesToStaging(fileList, '드래그 파일');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, sourceLabel: string) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      addFilesToStaging(fileList, sourceLabel);
      e.target.value = '';
    }
  };

  const handleManualClipboardRead = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const pastedFiles: File[] = [];
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File(
              [blob],
              `capture_${Date.now()}.${imageType.split('/')[1] || 'png'}`,
              { type: imageType }
            );
            pastedFiles.push(file);
          }
        }
        if (pastedFiles.length > 0) {
          addFilesToStaging(pastedFiles, '클립보드 캡쳐본');
          return;
        }
      }
    } catch (err) {
      console.warn('Direct clipboard read failed or permission denied, using event paste fallback:', err);
    }
    if (onPasteFromClipboard) {
      onPasteFromClipboard();
    }
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAllStaged = () => {
    stagedFiles.forEach((item) => URL.revokeObjectURL(item.preview));
    setStagedFiles([]);
  };

  const handleBatchSubmit = () => {
    if (stagedFiles.length === 0) return;
    const files = stagedFiles.map((item) => item.file);
    stagedFiles.forEach((item) => URL.revokeObjectURL(item.preview));
    setStagedFiles([]);
    onFilesSelected(files, '스크린 캡쳐 다중');
  };

  return (
    <div className="space-y-4">
      {/* 1. Dedicated 실(Room) 입력 란 Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <label htmlFor="room-input-zone" className="font-bold text-slate-900 text-sm sm:text-base">
                  실 (Room / 작업실) 입력
                </label>
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  시험 장소 지정
                </span>
              </div>
              <p className="text-xs text-slate-500">
                캡쳐/업로드할 배지가 채취된 실(작업실)을 입력하세요.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-1 sm:max-w-xs">
            <input
              id="room-input-zone"
              type="text"
              value={currentRoom}
              onChange={(e) => onUpdateRoom && onUpdateRoom(e.target.value)}
              placeholder="예: Accuprep 분주실"
              className="w-full px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
            />
          </div>
        </div>

        {/* Room Presets */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center flex-wrap gap-1.5 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">빠른 선택:</span>
          {COMMON_ROOMS.map((room) => {
            const isSelected = currentRoom === room;
            return (
              <button
                key={room}
                type="button"
                onClick={() => onUpdateRoom && onUpdateRoom(room)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {room}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Upload & Multi-Screen Capture Drag Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 transition-all text-center ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/70 scale-[0.998]'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileChange(e, '사진 파일')}
          className="hidden"
        />
        <input
          ref={screenshotFileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileChange(e, '스크린 캡쳐 파일')}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileChange(e, '카메라 사진')}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
            스크린 캡쳐 및 배지 사진 한 번에 여러 장 업로드
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed max-w-lg">
            <strong>Win+Shift+S</strong>로 캡쳐 후 브라우저에서 <strong>Ctrl+V</strong>를 연속으로 누르거나,
            캡쳐된 이미지 파일들을 한꺼번에 선택하여 드래그하세요.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {/* Multi-Screenshot File Picker */}
            <button
              type="button"
              onClick={() => screenshotFileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all disabled:opacity-50"
            >
              <FolderUp className="w-4 h-4 text-blue-200" />
              <span>🖥️ 스크린 캡쳐 여러 장 선택</span>
            </button>

            {/* Clipboard Paste */}
            <button
              type="button"
              onClick={handleManualClipboardRead}
              disabled={isAnalyzing}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all disabled:opacity-50"
              title="클립보드에 복사된 캡쳐 이미지를 붙여넣습니다"
            >
              <ClipboardPaste className="w-4 h-4 text-blue-300" />
              <span>클립보드 붙여넣기</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-200 rounded">
                Ctrl+V
              </kbd>
            </button>

            {/* Direct Window/Screen Share Grabber */}
            {onOpenDirectScreenCapture && (
              <button
                type="button"
                onClick={onOpenDirectScreenCapture}
                disabled={isAnalyzing}
                className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all disabled:opacity-50"
              >
                <Monitor className="w-4 h-4 text-indigo-600" />
                <span>📸 화면/창 실시간 캡쳐</span>
              </button>
            )}

            {/* General Files */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-slate-500" />
              <span>일반 사진 파일</span>
            </button>

            {/* Camera */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isAnalyzing}
              className="inline-flex items-center space-x-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">카메라 촬영</span>
            </button>
          </div>

          {/* Quick Win+Shift+S Pro Tip Banner */}
          <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl w-full text-xs text-blue-900 flex items-start space-x-2 text-left">
            <Keyboard className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>💡 여러 장 연속 캡쳐 팁:</strong> 윈도우에서 <kbd className="font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">Win + Shift + S</kbd> 로 캡쳐하고, 브라우저에서 <kbd className="font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">Ctrl + V</kbd>를 누르면 누르는 족족 차곡차곡 모아져 <strong>한 번에 일괄 분석</strong>됩니다.
            </div>
          </div>
        </div>
      </div>

      {/* 3. Staged Multi-Captures Tray (차곡차곡 모아진 캡쳐본 목록) */}
      {stagedFiles.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h4 className="font-bold text-sm sm:text-base text-white">
                수집된 스크린 캡쳐 대기 보관함
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white">
                {stagedFiles.length}장 대기 중
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleClearAllStaged}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center space-x-1 px-2 py-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>모두 비우기</span>
              </button>

              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={isAnalyzing}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>🚀 {stagedFiles.length}장 한 번에 AI 일괄 분석 & 등록</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            계속해서 <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px]">Ctrl+V</kbd>를 누르면 새 캡쳐본이 추가됩니다. 준비가 완료되면 [한 번에 AI 일괄 분석]을 클릭하세요.
          </p>

          {/* Staged Thumbnails Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 pt-1">
            {stagedFiles.map((item, idx) => (
              <div
                key={item.id}
                className="group relative rounded-xl overflow-hidden border border-slate-700 aspect-video bg-slate-950 shadow-sm"
              >
                <img
                  src={item.preview}
                  alt={`Capture ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute top-1 left-1 bg-slate-900/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                  #{idx + 1}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStaged(item.id)}
                  className="absolute top-1 right-1 p-1 bg-rose-600/90 hover:bg-rose-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
