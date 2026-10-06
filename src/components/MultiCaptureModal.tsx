import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Play, Check, Trash2, Monitor, AlertCircle } from 'lucide-react';

interface MultiCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCaptures: (files: File[]) => void;
}

export const MultiCaptureModal: React.FC<MultiCaptureModalProps> = ({
  isOpen,
  onClose,
  onConfirmCaptures,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [capturedSnaps, setCapturedSnaps] = useState<{ id: string; dataUrl: string }[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Stop screen stream when closing or unmounting
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsSharing(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedSnaps([]);
      setStreamError(null);
    }
  }, [isOpen]);

  const handleStartCaptureStream = async () => {
    try {
      setStreamError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('현재 브라우저 환경에서 화면 캡쳐 API를 지원하지 않습니다.');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsSharing(true);

      // Handle stream end when user clicks standard browser "stop sharing"
      stream.getVideoTracks()[0].onended = () => {
        setIsSharing(false);
      };
    } catch (err: any) {
      console.warn('Screen share cancelled or failed:', err);
      if (err.name !== 'NotAllowedError') {
        setStreamError(err?.message || '화면 공유 권한이 거부되었거나 오류가 발생했습니다.');
      }
    }
  };

  const handleSnapCurrentFrame = () => {
    if (!videoRef.current || !isSharing) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');

    setCapturedSnaps((prev) => [
      ...prev,
      {
        id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        dataUrl,
      },
    ]);
  };

  const handleDeleteSnap = (id: string) => {
    setCapturedSnaps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleConfirmAndUpload = async () => {
    if (capturedSnaps.length === 0) return;

    const files: File[] = [];
    for (let i = 0; i < capturedSnaps.length; i++) {
      const snap = capturedSnaps[i];
      const res = await fetch(snap.dataUrl);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `screen_snap_${i + 1}_${Date.now()}.png`,
        { type: 'image/png' }
      );
      files.push(file);
    }

    stopStream();
    onConfirmCaptures(files);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                화면/창 실시간 스크린 캡쳐 도구
              </h3>
              <p className="text-xs text-slate-500">
                원하는 창이나 모니터를 선택한 후, [캡쳐 찍기]를 눌러 여러 장을 연속으로 촬영할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {streamError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{streamError}</span>
            </div>
          )}

          {/* Video Stream Stage or Prompt */}
          <div className="relative aspect-video max-h-[380px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${isSharing ? 'block' : 'hidden'}`}
            />

            {!isSharing && (
              <div className="text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                  <Monitor className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-white font-bold text-base">
                    캡쳐할 창 또는 화면을 연결하세요
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md">
                    현미경 뷰어, 검사 프로그램, 사진 폴더 창을 선택하면 실시간으로 연속 스냅샷을 캡쳐할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartCaptureStream}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition-all"
                >
                  <Play className="w-4 h-4" />
                  <span>화면 / 창 선택 시작하기</span>
                </button>
              </div>
            )}

            {isSharing && (
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-xs px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-semibold">실시간 화면 연결 중</span>
              </div>
            )}
          </div>

          {/* Actions during active stream */}
          {isSharing && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
              <div className="text-xs text-blue-900 font-medium">
                💡 원하는 장면에서 <strong>[📸 지금 화면 캡쳐]</strong>를 클릭하세요. 여러 번 클릭하여 연속으로 모을 수 있습니다.
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSnapCurrentFrame}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-md transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>📸 지금 화면 캡쳐 (+1장)</span>
                </button>
              </div>
            </div>
          )}

          {/* Staged Snaps Strip */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <span>수집된 스크린 캡쳐본</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-white">
                  {capturedSnaps.length}장
                </span>
              </span>
              {capturedSnaps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCapturedSnaps([])}
                  className="text-xs text-slate-400 hover:text-rose-600 flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>모두 지우기</span>
                </button>
              )}
            </div>

            {capturedSnaps.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                아직 캡쳐된 사진이 없습니다. 화면을 연결하고 [지금 화면 캡쳐] 버튼을 누르세요.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {capturedSnaps.map((snap, idx) => (
                  <div
                    key={snap.id}
                    className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 shadow-2xs"
                  >
                    <img
                      src={snap.dataUrl}
                      alt={`Snap ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnap(snap.id)}
                      className="absolute top-1 right-1 p-1 bg-rose-600/90 hover:bg-rose-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            총 <strong>{capturedSnaps.length}장</strong>의 스크린 캡쳐가 준비되었습니다.
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmAndUpload}
              disabled={capturedSnaps.length === 0}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              <span>{capturedSnaps.length}장 한 번에 업로드 & AI 분석</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
