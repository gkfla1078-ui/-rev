import React, { useState } from 'react';
import { PlateItem, GmpReportConfig, GmpMonitoringType } from '../types';
import { groupPlatesToGmpRows, getMonitoringTitles, formatLocationWithRoomAndPoint } from '../utils/gmpMatcher';
import { Crop, FileText, Printer, Download, Check, Maximize2, X } from 'lucide-react';

interface GmpStandardTableViewProps {
  plates: PlateItem[];
  config: GmpReportConfig;
  onUpdateConfig: (updates: Partial<GmpReportConfig>) => void;
  onUpdatePlate: (id: string, updates: Partial<PlateItem>) => void;
  onOpenCropEditor: (plate: PlateItem) => void;
  onExportDocx: () => void;
  onPrint: () => void;
  isExportingDocx: boolean;
}

export const GmpStandardTableView: React.FC<GmpStandardTableViewProps> = ({
  plates,
  config,
  onUpdateConfig,
  onUpdatePlate: _onUpdatePlate,
  onOpenCropEditor,
  onExportDocx,
  onPrint,
  isExportingDocx,
}) => {
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const matchedRows = groupPlatesToGmpRows(plates);

  const monitoringTypes: GmpMonitoringType[] = ['낙하균', '부유균', '표면균'];

  const handleSelectMonitoring = (type: GmpMonitoringType) => {
    const titles = getMonitoringTitles(type);
    onUpdateConfig({
      monitoringType: type,
      journalTitle: titles.journalTitle,
      testItem: titles.testItem,
    });
  };

  return (
    <div className="space-y-6">
      {/* View Header with Dynamic Monitoring Selector & Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">
                  표준 양식 레이아웃 매칭 뷰
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-900 text-amber-300">
                  {config.formNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                동일 위치 코드별 [세균 TSA] + [진균 SDA] 3열 매칭 구조 ({matchedRows.length}개 위치)
              </p>
            </div>
          </div>

          {/* [1. 사용자 동적 선택 옵션: 낙하균 / 부유균 / 표면균] */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl space-x-1 sm:ml-4">
            <span className="text-[11px] font-bold text-slate-500 px-2">모니터링 종류:</span>
            {monitoringTypes.map((type) => {
              const isActive = config.monitoringType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelectMonitoring(type)}
                  className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {isActive && <Check className="w-3.5 h-3.5" />}
                  <span>{type}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>양식 인쇄</span>
          </button>
          <button
            type="button"
            onClick={onExportDocx}
            disabled={isExportingDocx}
            className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingDocx ? 'Word 생성중...' : 'Word (.docx) 다운로드'}</span>
          </button>
        </div>
      </div>

      {/* Official GMP Sheet Canvas Layout Container */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-6 sm:p-10 max-w-5xl mx-auto overflow-hidden">
        {/* [3. 최상단 머리글] (테이블 외부 좌/우 배치) */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-black font-sans">
            {config.companyLogo}
          </div>
          <div className="text-xs sm:text-sm font-bold text-black font-sans">
            {config.journalTitle} 1/1
          </div>
        </div>

        {/* [4. 상단 기본정보 테이블 구조] */}
        {/* 2열 구조 표, 경계선: 검은색 실선 (border: 1px solid #000) */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full border-collapse border border-black text-xs sm:text-sm">
            <tbody>
              <tr className="border-b border-black">
                <td className="w-1/4 bg-slate-100/90 px-3 py-2.5 font-bold text-center border-r border-black text-black">
                  시험 항목
                </td>
                <td className="px-3 py-1.5 font-semibold text-black">
                  <input
                    type="text"
                    value={config.testItem}
                    onChange={(e) => onUpdateConfig({ testItem: e.target.value })}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900 font-semibold"
                  />
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-1/4 bg-slate-100/90 px-3 py-2.5 font-bold text-center border-r border-black text-black">
                  시험 장소 (실)
                </td>
                <td className="px-3 py-1.5 font-medium text-black">
                  <input
                    type="text"
                    value={config.testLocation}
                    onChange={(e) => onUpdateConfig({ testLocation: e.target.value })}
                    placeholder="실 입력 (예: Accuprep 분주실)"
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900 font-bold"
                  />
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-1/4 bg-slate-100/90 px-3 py-2.5 font-bold text-center border-r border-black text-black">
                  <span>측정 일자</span>
                  <span className="block text-[11px] font-normal text-slate-500">(확인일자 작성 생략)</span>
                </td>
                <td className="px-3 py-1.5 font-medium text-black">
                  <input
                    type="text"
                    value={config.measurementPeriod}
                    onChange={(e) => onUpdateConfig({ measurementPeriod: e.target.value })}
                    placeholder="배지 측정일자 (예: 2026-10-06)"
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900 font-semibold"
                  />
                </td>
              </tr>
              <tr>
                <td className="w-1/4 bg-slate-100/90 px-3 py-2.5 font-bold text-center border-r border-black text-black">
                  측정 상태
                </td>
                <td className="px-3 py-1.5 font-medium text-black">
                  <input
                    type="text"
                    value={config.measurementStatus}
                    onChange={(e) => onUpdateConfig({ measurementStatus: e.target.value })}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* [5. 메인 결과 매칭 테이블 구조 (핵심)] */}
        {/* 1열: 측정위치 | 2열: 세균 (TSA 사진만) | 3열: 진균 (SDA/SDAC 사진만) */}
        {/* 셀 내부에는 불필요한 텍스트("판독결과", CFU, 식별문구) 설정을 거치지 않고 깔끔하게 크롭된 배지 사진만 보여주도록 처리 */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-black text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/90 border-b border-black text-center font-bold text-black">
                <th className="w-[20%] border-r border-black py-2.5 px-2">
                  측정위치
                </th>
                <th className="w-[40%] border-r border-black py-2.5 px-3">
                  <span>세균</span>
                  <span className="text-xs font-normal text-slate-600 ml-1">(TSA)</span>
                </th>
                <th className="w-[40%] py-2.5 px-3">
                  <span>진균</span>
                  <span className="text-xs font-normal text-slate-600 ml-1">(SDA/SDAC)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {matchedRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400">
                    등록된 배지 사진이 없습니다.
                  </td>
                </tr>
              ) : (
                matchedRows.map((row, idx) => {
                  const bac = row.bacteriaPlate;
                  const fun = row.fungiPlate;
                  const rowRoom = row.room || bac?.room || fun?.room || config.testLocation;
                  const rawLoc = row.locationCode;
                  const pointNum = bac?.pointNumber || fun?.pointNumber || row.pointNumber;
                  const dateStr = row.measuredDate || bac?.measuredDate || fun?.measuredDate || bac?.samplingDate || fun?.samplingDate;

                  // [입력한 실] + [손글씨 포인트 (예: -1, -2)]
                  const fullLocationTitle = formatLocationWithRoomAndPoint(rowRoom, pointNum, rawLoc);

                  return (
                    <tr key={row.locationCode || idx} className="border-b border-black">
                      {/* 1열: 측정위치 (입력한 실 + 손글씨 포인트 매칭) */}
                      <td className="border-r border-black p-3 text-center align-middle bg-slate-50/40">
                        <span className="font-bold text-sm sm:text-base text-black block">
                          {fullLocationTitle}
                        </span>
                        <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
                          {pointNum && (
                            <span className="inline-block px-1.5 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300">
                              손글씨 {pointNum}
                            </span>
                          )}
                          {dateStr && (
                            <span className="inline-block px-1.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-800 rounded border border-blue-200">
                              측정일: {dateStr}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2열: 세균 (TSA 배지 관찰 사진만 배치 - 고화질 원형 보존 및 object-contain) */}
                      <td className="border-r border-black p-3 sm:p-4 text-center align-middle">
                        {bac ? (
                          <div className="flex flex-col items-center justify-center">
                            <div
                              className="relative w-40 h-40 sm:w-56 sm:h-56 rounded-lg overflow-hidden bg-slate-950 border border-black flex items-center justify-center shadow-xs group"
                            >
                              <img
                                src={bac.croppedImage || bac.originalImage}
                                alt={`${fullLocationTitle} TSA`}
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setZoomImage({ url: bac.croppedImage || bac.originalImage, title: `${fullLocationTitle} (세균 TSA)` })}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-1 shadow-xs"
                                  title="고화질 확대 보기"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span>확대</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenCropEditor(bac)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center space-x-1 shadow-xs"
                                  title="크롭 영역 수정"
                                >
                                  <Crop className="w-3.5 h-3.5" />
                                  <span>크롭</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-12 text-center text-slate-300">
                            <span className="block text-2xl font-light">-</span>
                          </div>
                        )}
                      </td>

                      {/* 3열: 진균 (SDA/SDAC 배지 관찰 사진만 배치 - 고화질 원형 보존 및 object-contain) */}
                      <td className="p-3 sm:p-4 text-center align-middle">
                        {fun ? (
                          <div className="flex flex-col items-center justify-center">
                            <div
                              className="relative w-40 h-40 sm:w-56 sm:h-56 rounded-lg overflow-hidden bg-slate-950 border border-black flex items-center justify-center shadow-xs group"
                            >
                              <img
                                src={fun.croppedImage || fun.originalImage}
                                alt={`${fullLocationTitle} SDA`}
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setZoomImage({ url: fun.croppedImage || fun.originalImage, title: `${fullLocationTitle} (진균 SDA)` })}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-1 shadow-xs"
                                  title="고화질 확대 보기"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span>확대</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenCropEditor(fun)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center space-x-1 shadow-xs"
                                  title="크롭 영역 수정"
                                >
                                  <Crop className="w-3.5 h-3.5" />
                                  <span>크롭</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-12 text-center text-slate-300">
                            <span className="block text-2xl font-light">-</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* [3. 최하단 바닥글 필수 규칙] (테이블 외부 좌/중/우 배치) */}
        <div className="pt-3 border-t border-black flex items-center justify-between text-xs text-black font-medium">
          <div className="w-1/3 text-left font-mono font-semibold">
            {config.formNumber}
          </div>
          <div className="w-1/3 text-center">
            {config.revisionText}
          </div>
          <div className="w-1/3 text-right">
            {config.paperSize}
          </div>
        </div>
      </div>

      {/* High-Resolution Plate Image Lightbox Zoom Modal */}
      {zoomImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 border-b border-slate-700 text-white">
              <span className="font-bold text-sm tracking-tight">{zoomImage.title} - 고화질 원본 식별</span>
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black overflow-auto max-h-[80vh]">
              <img
                src={zoomImage.url}
                alt={zoomImage.title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
