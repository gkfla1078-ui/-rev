import React, { useState } from 'react';
import { Building2, Check, Plus, Edit2, Layers, MapPin } from 'lucide-react';

interface RoomSelectorBarProps {
  currentRoom: string;
  onUpdateRoom: (room: string) => void;
  onApplyRoomToAllPlates?: (room: string) => void;
  onAddManualPlate?: (room: string) => void;
  platesCount: number;
}

const COMMON_GMP_ROOMS = [
  'Accuprep 분주실',
  '무균충전실',
  '조제실',
  '무균시험실',
  '세척실',
  '원료칭량실',
  'QC 미생물시험실',
  '배양실',
  '101호 청정실',
];

export const RoomSelectorBar: React.FC<RoomSelectorBarProps> = ({
  currentRoom,
  onUpdateRoom,
  onApplyRoomToAllPlates,
  onAddManualPlate,
  platesCount,
}) => {
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [customInputValue, setCustomInputValue] = useState(currentRoom);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSelectPreset = (room: string) => {
    setCustomInputValue(room);
    onUpdateRoom(room);
    showNotification(`실(Room)이 "${room}"(으)로 설정되었습니다.`);
  };

  const handleApplyToAll = () => {
    const roomToApply = customInputValue.trim() || currentRoom;
    onUpdateRoom(roomToApply);
    if (onApplyRoomToAllPlates) {
      onApplyRoomToAllPlates(roomToApply);
      showNotification(`현재 등록된 모든 배지(${platesCount}건)의 실이 "${roomToApply}"(으)로 변경되었습니다.`);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInputValue.trim();
    if (trimmed) {
      onUpdateRoom(trimmed);
      setIsCustomEditing(false);
      showNotification(`실(Room)이 "${trimmed}"(으)로 설정되었습니다.`);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header & Room Input */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-1.5">
                <span>실 (작업실 / 청정실) 입력란</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                GMP 시험 장소
              </span>
            </div>
            <p className="text-xs text-slate-500">
              배지 사진이 채취된 작업실(호실)을 입력하면 표준 양식 및 보고서에 자동 반영됩니다.
            </p>
          </div>
        </div>

        {/* Input & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Input Field */}
          <form onSubmit={handleCustomSubmit} className="flex items-center space-x-1.5 flex-1 sm:flex-initial">
            <div className="relative flex-1 sm:w-64">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customInputValue}
                onChange={(e) => {
                  setCustomInputValue(e.target.value);
                  onUpdateRoom(e.target.value);
                }}
                placeholder="실 이름 직접 입력 (예: Accuprep 분주실)"
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
              />
            </div>
          </form>

          {/* Apply to All Plates Button */}
          {platesCount > 0 && onApplyRoomToAllPlates && (
            <button
              type="button"
              onClick={handleApplyToAll}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs"
              title="현재 입력된 실 명칭을 등록된 모든 배지에 일괄 적용합니다"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>전체 배지에 일괄 적용 ({platesCount}건)</span>
            </button>
          )}

          {/* Manual Entry Button */}
          {onAddManualPlate && (
            <button
              type="button"
              onClick={() => onAddManualPlate(customInputValue.trim() || currentRoom)}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs"
              title="사진 없이 수동으로 실과 측정위치 행을 추가합니다"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>+ 실/위치 직접 수동 입력</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Chips */}
      <div className="pt-2 border-t border-slate-100 flex items-center flex-wrap gap-1.5 text-xs">
        <span className="text-slate-400 font-medium mr-1 text-[11px]">자주 쓰는 실(Room) 프리셋:</span>
        {COMMON_GMP_ROOMS.map((room) => {
          const isSelected = currentRoom === room;
          return (
            <button
              key={room}
              type="button"
              onClick={() => handleSelectPreset(room)}
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
  );
};
